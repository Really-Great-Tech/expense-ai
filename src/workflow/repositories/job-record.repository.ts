import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { JobRecord, JobType, JobStatus } from '../entities/job-record.entity';

export interface CreateJobRecordParams {
  bullmqJobId: string;
  type: JobType;
  documentId?: string;
  receiptId?: string;
  parentJobId?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class JobRecordRepository {
  private readonly logger = new Logger(JobRecordRepository.name);

  constructor(
    @InjectRepository(JobRecord)
    private readonly repository: Repository<JobRecord>,
  ) {}

  async create(params: CreateJobRecordParams): Promise<JobRecord> {
    const jobRecord = this.repository.create({
      id: uuidv4(),
      bullmqJobId: params.bullmqJobId,
      type: params.type,
      documentId: params.documentId || null,
      receiptId: params.receiptId || null,
      parentJobId: params.parentJobId || null,
      status: 'pending' as JobStatus,
      attemptsMade: 0,
      maxAttempts: params.maxAttempts ?? 3,
      metadata: params.metadata || null,
    });

    await this.repository.save(jobRecord);
    this.logger.debug(`Created job record: ${jobRecord.id} (bullmq: ${params.bullmqJobId}, type: ${params.type})`);

    return jobRecord;
  }

  async updateStatus(
    bullmqJobId: string,
    status: JobStatus,
    error?: string,
  ): Promise<void> {
    const updates: Partial<JobRecord> = { status };

    if (error) {
      updates.lastError = error;
    }

    await this.repository.update({ bullmqJobId }, updates);
    this.logger.debug(`Updated job record status: ${bullmqJobId} -> ${status}`);
  }

  async markStarted(bullmqJobId: string): Promise<void> {
    await this.repository.update(
      { bullmqJobId },
      {
        status: 'active' as JobStatus,
        startedAt: new Date(),
      },
    );
    this.logger.debug(`Marked job as started: ${bullmqJobId}`);
  }

  async markCompleted(bullmqJobId: string, processingTimeMs: number): Promise<void> {
    await this.repository.update(
      { bullmqJobId },
      {
        status: 'completed' as JobStatus,
        completedAt: new Date(),
        processingTimeMs,
      },
    );
    this.logger.debug(`Marked job as completed: ${bullmqJobId} (${processingTimeMs}ms)`);
  }

  async markFailed(bullmqJobId: string, error: string): Promise<void> {
    await this.repository.update(
      { bullmqJobId },
      {
        status: 'failed' as JobStatus,
        completedAt: new Date(),
        lastError: error,
      },
    );
    this.logger.debug(`Marked job as failed: ${bullmqJobId}`);
  }

  async markRetrying(bullmqJobId: string, error: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(JobRecord)
      .set({
        status: 'retrying' as JobStatus,
        lastError: error,
        attemptsMade: () => 'attemptsMade + 1',
      })
      .where('bullmqJobId = :bullmqJobId', { bullmqJobId })
      .execute();
    this.logger.debug(`Marked job as retrying: ${bullmqJobId}`);
  }

  async incrementAttempts(bullmqJobId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(JobRecord)
      .set({
        attemptsMade: () => 'attemptsMade + 1',
      })
      .where('bullmqJobId = :bullmqJobId', { bullmqJobId })
      .execute();
    this.logger.debug(`Incremented job attempts: ${bullmqJobId}`);
  }

  async findByBullmqJobId(bullmqJobId: string): Promise<JobRecord | null> {
    return this.repository.findOne({ where: { bullmqJobId } });
  }

  async findByDocumentId(documentId: string): Promise<JobRecord[]> {
    return this.repository.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByParentJobId(parentJobId: string): Promise<JobRecord[]> {
    return this.repository.find({
      where: { parentJobId },
      order: { createdAt: 'DESC' },
    });
  }

  async getStats(): Promise<{ type: JobType; status: JobStatus; count: number }[]> {
    const result = await this.repository
      .createQueryBuilder('job')
      .select('job.type', 'type')
      .addSelect('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('job.type')
      .addGroupBy('job.status')
      .getRawMany();

    return result.map((r) => ({
      type: r.type as JobType,
      status: r.status as JobStatus,
      count: parseInt(r.count, 10),
    }));
  }
}
