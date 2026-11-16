import { Controller, Post, Body, Get, Param, Headers, Logger } from '@nestjs/common';
import { KaseraPayService } from '../../infrastructure/gateways/kaserapay.service';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Controller('api/v1/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);
  private readonly issuedLicenses = new Map<string, { plan: string; active: boolean }>();

  constructor(
    private readonly kaseraPayService: KaseraPayService,
    private readonly prisma: PrismaService
  ) {}

  @Post('checkout')
  async createCheckout(
    @Body()
    body: {
      userId?: string;
      currency?: 'IDR' | 'USD';
      provider?: 'KASERAPAY' | 'MIDTRANS' | 'LEMON_SQUEEZY';
      returnUrl?: string;
    }
  ) {
    const isIdr = body.currency !== 'USD';
    const provider = body.provider || (isIdr ? 'KASERAPAY' : 'LEMON_SQUEEZY');
    const orderId = `UB-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const amount = isIdr ? 49000 : 9;

    // 1. KaseraPay Processing (Direct QRIS & Hosted Checkout)
    if (provider === 'KASERAPAY') {
      const kaseraRes = await this.kaseraPayService.createTransaction({
        amount,
        description: 'UniBeam Pro Lifetime License (Zero Cloud Relay & Vault)',
        externalId: orderId,
        returnUrl: body.returnUrl || 'http://localhost:5173/?payment=success',
      });

      // Save order in database
      try {
        await this.prisma.order.create({
          data: {
            userId: body.userId,
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
          earlyBirdRemaining: 42,
        },
      };
    }

    // 2. Global / Lemon Squeezy Fallback
    return {
      success: true,
      data: {
        orderId,
        provider,
        amount,
        currency: body.currency || 'USD',
        checkoutUrl: `https://zynq.lemonsqueezy.com/buy/${orderId}`,
        earlyBirdRemaining: 42,
      },
    };
  }

  @Post('webhook/kaserapay')
  async handleKaseraPayWebhook(
    @Body() payload: any,
    @Headers('kasera-signature-v1') signature?: string
  ) {
    this.logger.log(`[KaseraPay Webhook] Received payload: ${JSON.stringify(payload)} | Sig: ${signature}`);

    const externalId = payload.external_id || payload.data?.external_id;
    const status = payload.status || payload.event || payload.data?.status;

    if (status === 'succeeded' || status === 'payment.paid' || status === 'paid') {
      const licenseKey = `UNIBEAM-PRO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      if (externalId) {
        this.issuedLicenses.set(externalId, { plan: 'PRO_LIFETIME', active: true });

        // Update database order and user
        try {
          const order = await this.prisma.order.update({
            where: { externalOrderId: externalId },
            data: {
              status: 'SETTLED',
              licenseIssued: licenseKey,
              rawPayload: payload,
            },
          });

          if (order.userId) {
            await this.prisma.user.update({
              where: { id: order.userId },
              data: {
                plan: 'PRO_LIFETIME',
                licenseKey,
              },
            });
          }
        } catch (err: any) {
          this.logger.warn(`[KaseraPay Webhook] DB update skipped: ${err.message}`);
        }
      }

      return {
        status: 'success',
        message: 'License issued',
        licenseKey,
      };
    }

    return { status: 'acknowledged' };
  }

  @Get('transaction/:id')
  async checkTransactionStatus(@Param('id') id: string) {
    const res = await this.kaseraPayService.getTransaction(id);
    return {
      success: true,
      data: res,
    };
  }

  @Get('license/:licenseKey')
  async verifyLicense(@Param('licenseKey') licenseKey: string) {
    return {
      valid: true,
      plan: 'PRO_LIFETIME',
      unlimitedLocal: true,
      cloudRelayTurn: true,
      vaultRetentionDays: 30,
    };
  }
}
