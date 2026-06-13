import { AppError } from '@/utils/errors.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
export type JobType = 'SEND_EMAIL' | 'PASSWORD_RESET' | 'AUDIT_LOG' | 'AI_USAGE_TRACK';
import {EmailJobs} from './email-job';

export interface Job {
  id: string;
  type: JobType;
  payload: any;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  nextRunAt: Date;
}

export class JobQueueService {
  private static instance: JobQueueService;
  private queue: Job[] = [];
  private isProcessing = false;
  private readonly MAX_CONCURRENT = 5;
  private processingCount = 0;

  private constructor() {
    // Start background processor
    setInterval(() => this.processQueue(), 2000);
  }

  public static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService();
    }
    return JobQueueService.instance;
  }

  async addJob(type: JobType, payload: any, delayMs = 0): Promise<string> {
    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      nextRunAt: new Date(Date.now() + delayMs),
    };

    this.queue.push(job);
    console.log(`📋 Job queued: ${type} (${job.id})`);

    return job.id;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    // Sort by nextRunAt
    this.queue.sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime());

    while (this.queue.length > 0 && this.processingCount < this.MAX_CONCURRENT) {
      const job = this.queue[0];

      if (job.nextRunAt > new Date()) break;

      this.queue.shift();
      this.processingCount++;

      try {
        await this.executeJob(job);
        console.log(`✅ Job completed: ${job.type} (${job.id})`);
      } catch (error) {
        await this.handleJobFailure(job, error);
      } finally {
        this.processingCount--;
      }
    }

    this.isProcessing = false;
  }

  private async executeJob(job: Job) {
    switch (job.type) {
      case 'SEND_EMAIL':
        // We'll connect this to EmailService later
        console.log(`📧 Sending email:`, job.payload);
        await EmailJobs.processSendEmail(job.payload);
        break;

      default:
        console.log(`⚡ Executing job ${job.type}:`, job.payload);
    }
  }

  private async handleJobFailure(job: Job, error: any) {
    job.attempts++;
    console.error(`❌ Job failed (${job.attempts}/${job.maxAttempts}):`, error);

    if (job.attempts < job.maxAttempts) {
      // Exponential backoff
      const backoffMs = Math.pow(2, job.attempts) * 5000;
      job.nextRunAt = new Date(Date.now() + backoffMs);
      this.queue.push(job);
      console.log(`🔄 Requeued job ${job.id} for retry in ${backoffMs}ms`);
    } else {
      console.error(`💀 Job ${job.id} failed permanently after ${job.maxAttempts} attempts`);
      // TODO: Add dead letter queue later
    }
  }

  // For debugging
  getQueueLength(): number {
    return this.queue.length;
  }

  getPendingJobs(): Job[] {
    return [...this.queue];
  }
}