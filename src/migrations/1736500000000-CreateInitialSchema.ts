import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInitialSchema1736500000000 implements MigrationInterface {
    name = 'CreateInitialSchema1736500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`datasources\` (\`id\` int NOT NULL AUTO_INCREMENT, \`type\` enum ('url', 'file', 'csv', 'docx') NOT NULL, \`source\` varchar(255) NOT NULL, \`content\` text NULL, \`country_id\` int NOT NULL, \`version_country_id\` int NOT NULL, \`version_id\` varchar(255) NOT NULL, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`versions\` (\`country_id\` int NOT NULL, \`version_id\` varchar(255) NOT NULL, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (\`country_id\`, \`version_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`country_policies\` (\`id\` int NOT NULL AUTO_INCREMENT, \`rules\` json NOT NULL, \`version_country_id\` int NOT NULL, \`version_id\` varchar(255) NOT NULL, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`countries\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`code\` varchar(10) NULL, \`active\` tinyint NOT NULL DEFAULT 1, \`active_policy_id\` int NULL, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX \`IDX_fe17adf17f279d71ae396089a2\` (\`active\`), INDEX \`IDX_b47cbb5311bad9c9ae17b8c1ed\` (\`code\`), UNIQUE INDEX \`IDX_fa1376321185575cf2226b1491\` (\`name\`), UNIQUE INDEX \`REL_d0e6754450c9d168179b59bbc5\` (\`active_policy_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`file_hashes\` (\`id\` int NOT NULL AUTO_INCREMENT, \`hash\` varchar(64) NOT NULL, \`original_filename\` varchar(255) NOT NULL, \`file_size\` bigint NOT NULL, \`mime_type\` varchar(255) NOT NULL, \`document_id\` varchar(255) NOT NULL, \`upload_count\` int NOT NULL DEFAULT '1', \`first_uploaded_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`last_uploaded_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_e02901ca296eea98c2b03d83d2\` (\`hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`document_references\` (\`id\` int NOT NULL AUTO_INCREMENT, \`source_document_id\` varchar(255) NOT NULL, \`target_document_id\` varchar(255) NOT NULL, \`reference_type\` enum ('CONTENT_DUPLICATE', 'USER_REFERENCE', 'METADATA_SIMILAR') NOT NULL, \`confidence\` decimal(3,2) NOT NULL, \`detection_method\` enum ('SHA256_HASH', 'METADATA_MATCH', 'USER_CHOICE') NOT NULL, \`created_by\` varchar(255) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`unique_document_reference\` (\`source_document_id\`, \`target_document_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`expense_documents\` (\`id\` varchar(36) NOT NULL, \`original_file_name\` varchar(255) NOT NULL, \`file_size\` bigint NOT NULL, \`mime_type\` varchar(255) NOT NULL, \`storage_key\` varchar(255) NOT NULL DEFAULT '', \`storage_bucket\` varchar(255) NOT NULL DEFAULT '', \`storage_type\` enum ('local', 's3') NOT NULL DEFAULT 'local', \`storage_url\` varchar(255) NULL, \`status\` enum ('UPLOADED', 'VALIDATION_COMPLETE', 'S3_STORED', 'PROCESSING', 'TEXTRACT_COMPLETE', 'BOUNDARY_DETECTION', 'SPLITTING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'UPLOADED', \`total_pages\` int NOT NULL DEFAULT '0', \`total_receipts\` int NOT NULL DEFAULT '0', \`uploaded_by\` varchar(255) NOT NULL, \`textract_job_id\` varchar(255) NULL, \`textract_result\` json NULL, \`processing_metadata\` json NULL, \`idempotency_key\` varchar(255) NOT NULL, \`country\` varchar(255) NOT NULL, \`icp\` varchar(255) NOT NULL, \`country_id\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_4df4b9b05600243b11c18b960b\` (\`idempotency_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`receipts\` (\`id\` varchar(36) NOT NULL, \`source_document_id\` varchar(255) NOT NULL, \`storage_key\` varchar(255) NOT NULL, \`storage_bucket\` varchar(255) NOT NULL, \`storage_type\` enum ('local', 's3') NOT NULL DEFAULT 'local', \`file_name\` varchar(255) NOT NULL, \`file_size\` bigint NOT NULL, \`storage_url\` varchar(255) NULL, \`status\` enum ('CREATED', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'CREATED', \`parsed_data\` json NULL, \`extracted_text\` text NULL, \`metadata\` json NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`receipt_processing_results\` (\`id\` varchar(36) NOT NULL, \`receipt_id\` varchar(255) NOT NULL, \`source_document_id\` varchar(255) NOT NULL, \`processing_job_id\` varchar(255) NOT NULL, \`classification_result\` json NULL, \`extracted_data\` json NULL, \`compliance_validation\` json NULL, \`quality_assessment\` json NULL, \`citation_data\` json NULL, \`processing_metadata\` json NULL, \`file_references\` json NULL, \`status\` enum ('QUEUED', 'PROCESSING', 'CLASSIFICATION', 'EXTRACTION', 'VALIDATION', 'QUALITY_ASSESSMENT', 'CITATION_GENERATION', 'COMPLETED', 'FAILED', 'RETRYING') NOT NULL DEFAULT 'QUEUED', \`processing_started_at\` datetime NULL, \`processing_completed_at\` datetime NULL, \`error_message\` text NULL, \`error_stack\` text NULL, \`version\` int NOT NULL DEFAULT '1', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_169504afd23c2366d1e97da62a\` (\`processing_job_id\`), INDEX \`IDX_3247e000278530ccf6169474ed\` (\`source_document_id\`, \`status\`), INDEX \`IDX_d332c059c8b5666e1e926a863b\` (\`receipt_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`datasources\` ADD CONSTRAINT \`FK_f9b8eb36e93867f2b33bcc908de\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`datasources\` ADD CONSTRAINT \`FK_155518e7a941a063a6b52e3c53c\` FOREIGN KEY (\`version_country_id\`, \`version_id\`) REFERENCES \`versions\`(\`country_id\`,\`version_id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`versions\` ADD CONSTRAINT \`FK_0dabc2f539149802f7e1639f20c\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`country_policies\` ADD CONSTRAINT \`FK_93f9645226e40ec7a16a5607070\` FOREIGN KEY (\`version_country_id\`, \`version_id\`) REFERENCES \`versions\`(\`country_id\`,\`version_id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`countries\` ADD CONSTRAINT \`FK_d0e6754450c9d168179b59bbc56\` FOREIGN KEY (\`active_policy_id\`) REFERENCES \`country_policies\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`file_hashes\` ADD CONSTRAINT \`FK_e6fe194c4951738497026395ba7\` FOREIGN KEY (\`document_id\`) REFERENCES \`expense_documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_references\` ADD CONSTRAINT \`FK_dc8a11bba20604aef601b0cd6d8\` FOREIGN KEY (\`source_document_id\`) REFERENCES \`expense_documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`document_references\` ADD CONSTRAINT \`FK_fdeca59563acc1de1b9365654df\` FOREIGN KEY (\`target_document_id\`) REFERENCES \`expense_documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`expense_documents\` ADD CONSTRAINT \`FK_57b3036dc4625d84b9fec7c370e\` FOREIGN KEY (\`country_id\`) REFERENCES \`countries\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`receipts\` ADD CONSTRAINT \`FK_c5929071977970fb67757f8a8ac\` FOREIGN KEY (\`source_document_id\`) REFERENCES \`expense_documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`receipt_processing_results\` ADD CONSTRAINT \`FK_4fe345916b6cb7c49ec4771a3c8\` FOREIGN KEY (\`receipt_id\`) REFERENCES \`receipts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`receipt_processing_results\` ADD CONSTRAINT \`FK_11ccefe55358994c72f5cdbe54f\` FOREIGN KEY (\`source_document_id\`) REFERENCES \`expense_documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`receipt_processing_results\` DROP FOREIGN KEY \`FK_11ccefe55358994c72f5cdbe54f\``);
        await queryRunner.query(`ALTER TABLE \`receipt_processing_results\` DROP FOREIGN KEY \`FK_4fe345916b6cb7c49ec4771a3c8\``);
        await queryRunner.query(`ALTER TABLE \`receipts\` DROP FOREIGN KEY \`FK_c5929071977970fb67757f8a8ac\``);
        await queryRunner.query(`ALTER TABLE \`expense_documents\` DROP FOREIGN KEY \`FK_57b3036dc4625d84b9fec7c370e\``);
        await queryRunner.query(`ALTER TABLE \`document_references\` DROP FOREIGN KEY \`FK_fdeca59563acc1de1b9365654df\``);
        await queryRunner.query(`ALTER TABLE \`document_references\` DROP FOREIGN KEY \`FK_dc8a11bba20604aef601b0cd6d8\``);
        await queryRunner.query(`ALTER TABLE \`file_hashes\` DROP FOREIGN KEY \`FK_e6fe194c4951738497026395ba7\``);
        await queryRunner.query(`ALTER TABLE \`countries\` DROP FOREIGN KEY \`FK_d0e6754450c9d168179b59bbc56\``);
        await queryRunner.query(`ALTER TABLE \`country_policies\` DROP FOREIGN KEY \`FK_93f9645226e40ec7a16a5607070\``);
        await queryRunner.query(`ALTER TABLE \`versions\` DROP FOREIGN KEY \`FK_0dabc2f539149802f7e1639f20c\``);
        await queryRunner.query(`ALTER TABLE \`datasources\` DROP FOREIGN KEY \`FK_155518e7a941a063a6b52e3c53c\``);
        await queryRunner.query(`ALTER TABLE \`datasources\` DROP FOREIGN KEY \`FK_f9b8eb36e93867f2b33bcc908de\``);
        await queryRunner.query(`DROP INDEX \`IDX_d332c059c8b5666e1e926a863b\` ON \`receipt_processing_results\``);
        await queryRunner.query(`DROP INDEX \`IDX_3247e000278530ccf6169474ed\` ON \`receipt_processing_results\``);
        await queryRunner.query(`DROP INDEX \`IDX_169504afd23c2366d1e97da62a\` ON \`receipt_processing_results\``);
        await queryRunner.query(`DROP TABLE \`receipt_processing_results\``);
        await queryRunner.query(`DROP TABLE \`receipts\``);
        await queryRunner.query(`DROP INDEX \`IDX_4df4b9b05600243b11c18b960b\` ON \`expense_documents\``);
        await queryRunner.query(`DROP TABLE \`expense_documents\``);
        await queryRunner.query(`DROP INDEX \`unique_document_reference\` ON \`document_references\``);
        await queryRunner.query(`DROP TABLE \`document_references\``);
        await queryRunner.query(`DROP INDEX \`IDX_e02901ca296eea98c2b03d83d2\` ON \`file_hashes\``);
        await queryRunner.query(`DROP TABLE \`file_hashes\``);
        await queryRunner.query(`DROP INDEX \`REL_d0e6754450c9d168179b59bbc5\` ON \`countries\``);
        await queryRunner.query(`DROP INDEX \`IDX_fa1376321185575cf2226b1491\` ON \`countries\``);
        await queryRunner.query(`DROP INDEX \`IDX_b47cbb5311bad9c9ae17b8c1ed\` ON \`countries\``);
        await queryRunner.query(`DROP INDEX \`IDX_fe17adf17f279d71ae396089a2\` ON \`countries\``);
        await queryRunner.query(`DROP TABLE \`countries\``);
        await queryRunner.query(`DROP TABLE \`country_policies\``);
        await queryRunner.query(`DROP TABLE \`versions\``);
        await queryRunner.query(`DROP TABLE \`datasources\``);
    }

}
