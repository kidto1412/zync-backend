import { Injectable, Logger } from '@nestjs/common';

export interface CreateKaseraTransactionDto {
  amount: number; // in IDR
  description: string;
  externalId: string;
  returnUrl?: string;
}

export interface KaseraTransactionResponse {
  id: string;
  status: string;
  amount: number;
  checkoutUrl?: string;
  qrString?: string;
  instructions?: {
    title: string;
    steps: string[];
  };
  expiresAt?: string;
}

@Injectable()
export class KaseraPayService {
  private readonly logger = new Logger(KaseraPayService.name);
  private readonly apiKey =
    process.env.KASERAPAY_API_KEY || 'kp_live_nEOg9eyXLjN_YKCXuHy5rmXx_-g2Xj8tbYYpZaoCLOs';
  private readonly baseUrl = process.env.KASERAPAY_BASE_URL || 'https://pay.kasera.id/v1';

  async createTransaction(dto: CreateKaseraTransactionDto): Promise<KaseraTransactionResponse> {
    const endpoint = `${this.baseUrl}/transactions`;
    const body = {
      amount: dto.amount,
      description: dto.description,
      external_id: dto.externalId,
      payment_methods: ['qris'],
      order_items: [
        {
          name: dto.description,
          price: dto.amount,
          quantity: 1,
        },
      ],
      return_url: dto.returnUrl || 'http://localhost:5173/?payment=success',
    };

    try {
      this.logger.log(`[KaseraPay] Requesting transaction for ${dto.externalId} amount IDR ${dto.amount}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Idempotency-Key': dto.externalId,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data) {
        this.logger.log(`[KaseraPay] Transaction created successfully: ${data.id}`);
        return {
          id: data.id,
          status: data.status || 'pending',
          amount: data.amount || dto.amount,
          checkoutUrl: data.checkout_url,
          qrString: data.payment?.qr_string,
          instructions: data.instructions,
          expiresAt: data.expires_at,
        };
      } else {
        this.logger.warn(`[KaseraPay] API error response: ${JSON.stringify(data)}`);
        throw new Error(data?.message || 'Gagal memproses pembayaran ke KaseraPay');
      }
    } catch (err: any) {
      this.logger.error(`[KaseraPay] Error: ${err.message}`);
      throw err;
    }
  }

  async getTransaction(transactionId: string): Promise<any> {
    const endpoint = `${this.baseUrl}/transactions/${transactionId}`;
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return await response.json();
    } catch (err: any) {
      this.logger.error(`[KaseraPay] Failed to get transaction: ${err.message}`);
      return null;
    }
  }
}
