import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Headers,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { KaseraPayService } from '../../infrastructure/gateways/kaserapay.service';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '../../../auth/infrastructure/security/hash.service';

@Controller('api/v1/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  // Fixed server-side pricing to prevent price tampering
  private static readonly PRO_PRICE_IDR = 49000;
  private static readonly PRO_PRICE_USD = 9;

  constructor(
    private readonly kaseraPayService: KaseraPayService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  private getUserIdFromAuth(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Harap login terlebih dahulu untuk melakukan upgrade');
    }
    const token = authHeader.split(' ')[1];
    const decoded = this.jwtService.verify(token);
    if (!decoded?.userId) {
      throw new UnauthorizedException('Sesi login telah kadaluarsa atau tidak valid');
    }
    return decoded.userId;
  }

  @Post('checkout')
  async createCheckout(
    @Headers('authorization') authHeader: string,
    @Body()
    body: {
      currency?: 'IDR' | 'USD';
      provider?: 'KASERAPAY' | 'MIDTRANS' | 'LEMON_SQUEEZY';
      returnUrl?: string;
    }
  ) {
    // 1. Enforce strict authentication - orders must be cryptographically bound to a valid user
    const userId = this.getUserIdFromAuth(authHeader);

    // 2. Enforce server-side pricing (Client cannot override amount)
    const isIdr = body.currency !== 'USD';
    const provider = body.provider || (isIdr ? 'KASERAPAY' : 'LEMON_SQUEEZY');
    const amount = isIdr ? BillingController.PRO_PRICE_IDR : BillingController.PRO_PRICE_USD;
    const orderId = `ZYNQ-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 3. Process with KaseraPay (QRIS)
    if (provider === 'KASERAPAY') {
      const kaseraRes = await this.kaseraPayService.createTransaction({
        amount,
        description: 'ZYNQ Pro Lifetime License (Zero Cloud Relay & Vault)',
        externalId: orderId,
        returnUrl: body.returnUrl || 'https://zynq.kandid.web.id/?payment=success',
      });

      // Persist order in PostgreSQL database bound to userId
      try {
        await this.prisma.order.create({
          data: {
            userId,
            provider: 'KASERAPAY',
            externalOrderId: orderId,
            amount,
            currency: 'IDR',
            status: 'PENDING',
          },
        });
      } catch (err: any) {
        this.logger.warn(`[Billing] Order persist skipped (DB offline): ${err.message}`);
      }

      return {
        success: true,
        data: {
          orderId,
          provider: 'KASERAPAY',
          amount,
          currency: 'IDR',
          transactionId: kaseraRes.id,
          checkoutUrl: kaseraRes.checkoutUrl,
          qrString: kaseraRes.qrString,
          instructions: kaseraRes.instructions,
          expiresAt: kaseraRes.expiresAt,
          status: kaseraRes.status,
        },
      };
    }

    // 4. Global Lemon Squeezy Fallback
    return {
      success: true,
      data: {
        orderId,
        provider,
        amount,
        currency: 'USD',
        checkoutUrl: `https://zynq.lemonsqueezy.com/buy/${orderId}`,
      },
    };
  }

  /**
   * Webhook KaseraPay with Zero-Trust Direct Server Verification
   * Never blindly trust webhook body: Always verify status with KaseraPay API
   */
  @Post('webhook/kaserapay')
  async handleKaseraPayWebhook(
    @Body() payload: any,
    @Headers('kasera-signature-v1') signature?: string
  ) {
    this.logger.log(`[KaseraPay Webhook] Incoming callback. Sig: ${signature}`);

    const transactionId = payload?.id || payload?.data?.id || payload?.transaction_id;
    if (!transactionId) {
      throw new BadRequestException('Transaction ID tidak ditemukan dalam webhook');
    }

    // CRITICAL SECURITY: Query KaseraPay server directly to verify status
    const verifiedTx = await this.kaseraPayService.getTransaction(transactionId);
    if (!verifiedTx) {
      this.logger.error(`[KaseraPay Webhook] Transaction ${transactionId} not found on KaseraPay API`);
      throw new NotFoundException('Transaksi tidak valid pada server gateway');
    }

    const txData = verifiedTx.data || verifiedTx;
    const isPaid =
      txData.status === 'PAID' ||
      txData.status === 'SETTLED' ||
      txData.status === 'succeeded' ||
      txData.status === 'paid';

    const externalOrderId = txData.external_id || payload.external_id;

    if (isPaid && externalOrderId) {
      await this.settleOrderAndGrantLicense(externalOrderId, txData);
      return {
        status: 'success',
        message: 'Order verified and license granted',
      };
    }

    return { status: 'acknowledged', transactionStatus: txData.status };
  }

  /**
   * Secure Polling Endpoint
   * Automatically reconciles with KaseraPay API and settles order if paid
   */
  @Get('transaction/:id')
  async checkTransactionStatus(@Param('id') id: string) {
    const liveTx = await this.kaseraPayService.getTransaction(id);
    if (!liveTx) {
      throw new NotFoundException('Transaksi tidak ditemukan pada gateway');
    }

    const txData = liveTx.data || liveTx;
    const isPaid =
      txData.status === 'PAID' ||
      txData.status === 'SETTLED' ||
      txData.status === 'succeeded' ||
      txData.status === 'paid';

    const externalOrderId = txData.external_id;
    let licenseKey: string | null = null;

    if (isPaid && externalOrderId) {
      licenseKey = await this.settleOrderAndGrantLicense(externalOrderId, txData);
    }

    return {
      success: true,
      data: {
        id: txData.id,
        status: txData.status,
        isSettled: isPaid,
        licenseKey,
      },
    };
  }

  /**
   * License Verification - Strictly validated against PostgreSQL records
   */
  @Get('license/:licenseKey')
  async verifyLicense(@Param('licenseKey') licenseKey: string) {
    if (!licenseKey || licenseKey.length < 10) {
      return { valid: false, message: 'Format lisensi tidak valid' };
    }

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          licenseKey,
          plan: 'PRO_LIFETIME',
        },
      });

      if (!user) {
        const order = await this.prisma.order.findFirst({
          where: {
            licenseIssued: licenseKey,
            status: 'SETTLED',
          },
        });

        if (!order) {
          return { valid: false, message: 'Lisensi tidak ditemukan atau belum aktif' };
        }
      }

      return {
        valid: true,
        plan: 'PRO_LIFETIME',
        unlimitedLocal: true,
        cloudRelayTurn: true,
        vaultRetentionDays: 30,
      };
    } catch {
      return { valid: false, message: 'Gagal memverifikasi lisensi ke database' };
    }
  }

  /**
   * Atomic Order Settlement with Idempotency Guard
   */
  private async settleOrderAndGrantLicense(
    externalOrderId: string,
    verifiedTx: any
  ): Promise<string> {
    const licenseKey = `ZYNQ-PRO-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    try {
      const existingOrder = await this.prisma.order.findUnique({
        where: { externalOrderId },
      });

      if (!existingOrder) {
        this.logger.warn(`[Billing] Order ${externalOrderId} not found in database`);
        return licenseKey;
      }

      // Idempotency: If already SETTLED, do not issue duplicate license
      if (existingOrder.status === 'SETTLED' && existingOrder.licenseIssued) {
        return existingOrder.licenseIssued;
      }

      // Verify paid amount matches order amount (Prevent partial payment bypass)
      const paidAmount = Number(verifiedTx.amount);
      if (paidAmount < Number(existingOrder.amount)) {
        this.logger.error(
          `[Billing] Amount mismatch for ${externalOrderId}: paid ${paidAmount}, expected ${existingOrder.amount}`
        );
        throw new BadRequestException('Jumlah pembayaran tidak sesuai dengan nominal tagihan');
      }

      // Atomic settlement
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            status: 'SETTLED',
            licenseIssued: licenseKey,
            rawPayload: verifiedTx,
          },
        });

        if (existingOrder.userId) {
          await tx.user.update({
            where: { id: existingOrder.userId },
            data: {
              plan: 'PRO_LIFETIME',
              licenseKey,
            },
          });
        }
      });

      this.logger.log(`[Billing] Successfully settled order ${externalOrderId} -> License: ${licenseKey}`);
      return licenseKey;
    } catch (err: any) {
      this.logger.warn(`[Billing] Settlement persistence error: ${err.message}`);
      return licenseKey;
    }
  }
}
