import { DatabaseManager } from '@/infra/database/database.manager.js';
import { NotificationChannel, SendMessageOptions, MessagingResult } from '@/types/messaging.js';
import { MockMessagingProvider } from '@/providers/messaging/mock.js';


export class MessagingService {
  private static instance: MessagingService;
  private dbManager = DatabaseManager.getInstance();

  private constructor() {}

  public static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }

  private getProvider(channel: NotificationChannel): MockMessagingProvider {
    switch (channel) {
      case 'EMAIL': return new MockMessagingProvider('EMAIL');
      case 'SMS': return new MockMessagingProvider('SMS');
      case 'PUSH': return new MockMessagingProvider('PUSH');
      default: throw new Error(`Channel ${channel} is currently unsupported.`);
    }
  }

  async dispatch(options: SendMessageOptions): Promise<MessagingResult> {
    const provider = this.getProvider(options.channel);
    const pool = this.dbManager.getPool();
    let logId: string | null = null;

    // 1. Create database tracking row entry set to 'PENDING'
    try {
      const insertQuery = `
        INSERT INTO messaging_logs (recipient_id, channel, provider, recipient_address, subject, body, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
        RETURNING id;
      `;
      const insertParams = [
        options.recipientId,
        options.channel,
        'mock_provider',
        options.to,
        options.subject || null,
        options.body
      ];

      const result = await pool.query(insertQuery, insertParams);
      logId = result.rows[0].id;
      console.log(`[MessagingService] Saved initial log entry. Internal ID: ${logId}`);
    } catch (dbErr) {
      console.error('[MessagingService] Database failed to create tracking entry:', dbErr);
    }

    // 2. Fire the message provider action loop
    try {
      const deliveryResult = await provider.send(options);

      if (deliveryResult.success && logId) {
        // 3a. Success Case -> Update status row to SENT
        await pool.query(
          `UPDATE messaging_logs SET status = 'SENT', provider_message_id = $1 WHERE id = $2`,
          [deliveryResult.providerMessageId, logId]
        );
        console.log(`[MessagingService] Log row updated to SENT.`);
      } else if (logId) {
        // 3b. Failure Case -> Update status row to FAILED
        await pool.query(
          `UPDATE messaging_logs SET status = 'FAILED', error_message = $1 WHERE id = $2`,
          [deliveryResult.error || 'Provider rejected request', logId]
        );
        console.log(`[MessagingService] Log row updated to FAILED.`);
      }

      return deliveryResult;
    } catch (error: any) {
      console.error(`[MessagingService] Exception caught during delivery loop:`, error);
      
      if (logId) {
        await pool.query(
          `UPDATE messaging_logs SET status = 'FAILED', error_message = $1 WHERE id = $2`,
          [error.message || 'Fatal loop execution crash', logId]
        );
      }
      
      return {
        success: false,
        error: error.message || 'Fatal execution error'
      };
    }
  }
}

export const messagingService = new MessagingService();