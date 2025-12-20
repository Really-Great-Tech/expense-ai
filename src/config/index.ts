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
  keys: {
    privateKey: string;
    publicKey: string;
  };
}

/**
 * Legacy configuration factory for backward compatibility
 * New code should use appConfig or getAppConfig() instead
 */
export default (): Partial<iConfig> => {
  const config = getAppConfig();
  const rawPrivateKey = config.security.privateKey;
  const rawPublicKey = config.security.publicKey;

  return {
    env: config.nodeEnv,
    port: config.port,
    keys: {
      privateKey: rawPrivateKey ? rawPrivateKey.replace(/\\n/gm, '\n') : '',
      publicKey: rawPublicKey ? rawPublicKey.replace(/\\n/gm, '\n') : '',
    },
    database: dataSourceOptions,
  };
};
