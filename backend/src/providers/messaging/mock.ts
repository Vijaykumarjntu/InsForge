import { SendMessageOptions, MessagingResult } from '@/types/messaging.js';

export class MockMessagingProvider {
  private channel: string;

  constructor(channel: string) {
    this.channel = channel;
  }

  async send(options: SendMessageOptions): Promise<MessagingResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    console.log(`\n========================================`);
    console.log(`[MOCK PROVIDER] Dispatched ${this.channel}`);
    console.log(`TO: ${options.to}`);
    console.log(`BODY: ${options.body}`);
    console.log(`========================================\n`);

    return {
      success: true,
      providerMessageId: `mock_${this.channel.toLowerCase()}_${Math.random().toString(36).substring(2, 11)}`
    };
  }
}