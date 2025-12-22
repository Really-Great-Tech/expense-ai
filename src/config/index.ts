import { DataSourceOptions } from 'typeorm';
import { dataSourceOptions } from './database';
import appConfig, { AppConfigType, getAppConfig } from './app.config';

// Re-export centralized config
export { appConfig, AppConfigType, getAppConfig };
export { validateEnvironment, getConfigSummary, logConfigSummary } from './env-validation';

interface iConfig {
  env: string;
  port: number;
  database: DataSourceOptions;
}

/**
 * Legacy configuration factory for backward compatibility
 * New code should use appConfig or getAppConfig() instead
 */
export default (): Partial<iConfig> => {
  const config = getAppConfig();

  return {
    env: config.nodeEnv,
    port: config.port,
    database: dataSourceOptions,
  };
};
