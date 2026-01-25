import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration to replace JSON rules with markdown policy document storage.
 * 
 * This migration:
 * 1. Adds new columns for markdown policy storage (policy_markdown, page_count, icps, policy_metadata)
 * 2. Removes the old 'rules' JSON column
 * 
 * Note: This is a breaking change - existing policies stored as JSON rules will be removed.
 * Policies must be re-ingested using the new policy ingestion endpoint.
 */
export class ReplacePolicyRulesWithMarkdown1737825000000 implements MigrationInterface {
    name = 'ReplacePolicyRulesWithMarkdown1737825000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns for markdown policy storage
        // Note: MySQL TEXT/BLOB/JSON columns cannot have default values in strict mode, so we use NULL
        await queryRunner.query(`
            ALTER TABLE \`country_policies\` 
            ADD COLUMN \`policy_markdown\` LONGTEXT NULL,
            ADD COLUMN \`page_count\` INT NOT NULL DEFAULT 0,
            ADD COLUMN \`icps\` JSON NULL,
            ADD COLUMN \`policy_metadata\` JSON NULL
        `);

        // Drop the old rules column
        await queryRunner.query(`
            ALTER TABLE \`country_policies\` 
            DROP COLUMN \`rules\`
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add the rules column
        await queryRunner.query(`
            ALTER TABLE \`country_policies\` 
            ADD COLUMN \`rules\` JSON NOT NULL
        `);

        // Remove the new markdown columns
        await queryRunner.query(`
            ALTER TABLE \`country_policies\` 
            DROP COLUMN \`policy_metadata\`,
            DROP COLUMN \`icps\`,
            DROP COLUMN \`page_count\`,
            DROP COLUMN \`policy_markdown\`
        `);
    }
}
