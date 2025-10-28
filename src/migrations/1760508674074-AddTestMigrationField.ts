import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTestMigrationField1760508674074 implements MigrationInterface {
    name = 'AddTestMigrationField1760508674074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`receipts\` ADD \`test_migration_field\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`receipts\` DROP COLUMN \`test_migration_field\``);
    }

}
