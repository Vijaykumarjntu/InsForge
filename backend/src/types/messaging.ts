// Match the Postgres Enums we created earlier
export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH';
export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';

export interface SendMessageOptions {
  recipientId: string;       // Internal InsForge user ID
  channel: NotificationChannel;
  to: string;                // target destination: email, phone, or token
  body: string;              // content body
  subject?: string;          // optional, for emails
  title?: string;            // optional, for push notifications
}

export interface MessagingResult {
  success: boolean;
  providerMessageId?: string; // Tracking ID from the carrier (Twilio/SendGrid etc)
  error?: string;            // Error message if things break
}

// Layout blueprint of what a row looks like when reading from the database
export interface MessagingLogEntry {
  id: string;
  recipientId: string;
  channel: NotificationChannel;
  provider: string;
  status: NotificationStatus;
  recipientAddress: string;
  subject?: string;
  body: string;
  providerMessageId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}