import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJobRecords1760520000000 implements MigrationInterface {
    name = 'CreateJobRecords1760520000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`job_records\` (
                \`id\` char(36) NOT NULL,
                \`bullmq_job_id\` varchar(255) NOT NULL,
                \`type\` enum('split-expense', 'process-receipt', 'process-expense') NOT NULL,
                \`document_id\` char(36) NULL,
                \`receipt_id\` char(36) NULL,
                \`parent_job_id\` varchar(255) NULL,
                \`status\` enum('pending', 'active', 'retrying', 'completed', 'failed') NOT NULL DEFAULT 'pending',
                \`attempts_made\` int NOT NULL DEFAULT 0,
                \`max_attempts\` int NOT NULL DEFAULT 3,
                \`last_error\` text NULL,
                \`metadata\` json NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`started_at\` timestamp NULL,
                \`completed_at\` timestamp NULL,
                \`processing_time_ms\` int NULL,
                PRIMARY KEY (\`id\`),
                UNIQUE INDEX \`IDX_job_records_bullmq_job_id\` (\`bullmq_job_id\`),
                INDEX \`IDX_job_records_document_id\` (\`document_id\`),
                INDEX \`IDX_job_records_receipt_id\` (\`receipt_id\`),
                INDEX \`IDX_job_records_type_status\` (\`type\`, \`status\`),
                INDEX \`IDX_job_records_parent_job_id\` (\`parent_job_id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`job_records\``);
    }

}
