import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { env } from './env';
import { logger } from '../middleware/requestLogger';

export interface AppSecrets {
  MONGODB_URI: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  AWS_SES_FROM_EMAIL: string;
  AWS_S3_BUCKET: string;
}

export async function fetchSecrets(): Promise<AppSecrets> {
  if (env.NODE_ENV !== 'production' || process.env.SECRETS_PROVIDER !== 'aws') {
    if (env.NODE_ENV === 'production') {
      const required = ['MONGODB_URI', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'CRON_SECRET'];
      const missing = required.filter(key => !process.env[key]);
      if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(', ')}`);
      for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CRON_SECRET']) {
        if (process.env[key]!.length < 32 || /replace|change-in-production|test-jwt|dev-jwt/.test(process.env[key]!)) {
          throw new Error(`${key} must be an independently generated random secret of at least 32 characters`);
        }
      }
      if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('JWT secrets must be different');
      if (!/^mongodb(\+srv)?:\/\//.test(process.env.MONGODB_URI!)) throw new Error('MONGODB_URI is invalid');
      if (!/^rediss:\/\//.test(process.env.REDIS_URL!)) throw new Error('Production REDIS_URL must use TLS (rediss://)');
    }
    // In development, secrets come from env vars directly
    return {
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/hms',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      JWT_SECRET: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production',
      AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL ?? 'noreply@hms.local',
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET ?? 'hms-dev-bucket',
    };
  }

  const client = new SecretsManagerClient({ region: env.AWS_REGION });
  const command = new GetSecretValueCommand({ SecretId: env.AWS_SECRET_NAME });

  try {
    const response = await client.send(command);
    if (!response.SecretString) throw new Error('Empty secret value');
    return JSON.parse(response.SecretString) as AppSecrets;
  } catch (err) {
    logger.error('Failed to fetch secrets from AWS Secrets Manager');
    throw err;
  }
}
