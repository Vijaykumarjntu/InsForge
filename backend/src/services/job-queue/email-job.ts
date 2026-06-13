import { JobQueueService, JobType } from './job-queue.service.js';
import { EmailService } from '../email/email.service.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
import { AppError } from '@/utils/errors.js';

export class EmailJobs {
  private static queue = JobQueueService.getInstance();
  private static emailService = EmailService.getInstance();

  /**
   * Queue an email instead of sending synchronously
   */
  static async queueEmail(
    template: string,
    to: string,
    name: string,
    variables: Record<string, any> = {}
  ): Promise<string> {
    try {
      const jobId = await this.queue.addJob('SEND_EMAIL', {
        template,
        to,
        name,
        variables,
      });

      console.log(`📧 Email queued for ${to} (Job: ${jobId})`);
      return jobId;
    } catch (error) {
      console.error('Failed to queue email:', error);
      throw new AppError('Failed to queue email', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  }

  /**
   * This will be called by the job processor
   */
  static async processSendEmail(payload: any): Promise<void> {
    const { template, to, name, variables } = payload;
    console.log(`📧 Attempting to send email:`, { template, to, name, variables });
    try {
      await this.emailService.sendWithTemplate(template, to, name, variables);
      console.log(`✅ Email sent successfully to ${to}`);
    } catch (error) {
    //   console.error(`Failed to send email to ${to}:`, error);
    //   throw error; // Let the queue retry
      console.error(`❌ Failed to send email to ${to} with template ${template}:`, error);
      throw error; // Important for retry
    }
  }
}