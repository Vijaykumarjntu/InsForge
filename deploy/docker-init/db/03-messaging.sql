-- Create an Enum for our 3 delivery channels
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- Create an Enum to track the lifecycle of a message
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- The master tracking table
CREATE TABLE IF NOT EXISTS messaging_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL, -- Ties the message to a specific user profile
    channel notification_channel NOT NULL,
    provider VARCHAR(50) NOT NULL, -- e.g., 'twilio', 'sendgrid', 'fcm'
    status notification_status DEFAULT 'PENDING',
    recipient_address TEXT NOT NULL, -- The actual email, phone number, or device token
    subject TEXT, -- Optional (mostly for emails)
    body TEXT NOT NULL,
    provider_message_id TEXT, -- The ID the external service gives us back
    error_message TEXT, -- If it fails, why did it fail?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for performance (stops the Dashboard from lagging later)
CREATE INDEX IF NOT EXISTS idx_messaging_logs_recipient ON messaging_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messaging_logs_created_at ON messaging_logs(created_at);

-- Trigger to automatically update 'updated_at' column whenever a row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_messaging_logs_modtime
    BEFORE UPDATE ON messaging_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();