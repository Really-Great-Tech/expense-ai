import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { dataSourceOptions } from './database';

interface iConfig {
  env: string;
  port: number;
  database: DataSourceOptions;
  keys: {
    privateKey: string;
    publicKey: string;
  };
}

const configService = new ConfigService();

export default (): Partial<iConfig> => {
  const env = configService.get<string>('NODE_ENV', 'development');
  const port = parseInt(configService.get<string>('PORT', '3000'), 10);
  const rawPrivateKey = configService.get<string>('PRIVATE_KEY');
  const rawPublicKey = configService.get<string>('PUBLIC_KEY');

  return {
    env,
    port,
    keys: {
      privateKey: rawPrivateKey ? rawPrivateKey.replace(/\\n/gm, '\n') : '',
      publicKey: rawPublicKey ? rawPublicKey.replace(/\\n/gm, '\n') : '',
    },
    database: dataSourceOptions,
  };
};
