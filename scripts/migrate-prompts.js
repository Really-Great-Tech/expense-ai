#!/usr/bin/env node

/**
 * Simple script to run the prompt migration
 */

const { execSync } = require('child_process');
const path = require('path');
const { Logger } = require('@nestjs/common');

const logger = new Logger('PromptMigrationScript');

logger.log('🚀 Starting prompt migration to Langfuse...');

try {
  // Run the TypeScript migration script
  const scriptPath = path.join(__dirname, '..', 'scripts', 'migrate-prompts-to-langfuse.ts');
  execSync(`npx ts-node ${scriptPath}`, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  logger.log('✅ Prompt migration completed successfully!');
} catch (error) {
  logger.error(`❌ Prompt migration failed: ${error instanceof Error ? error.message : error}`, error instanceof Error ? error.stack : undefined);
  process.exit(1);
}
