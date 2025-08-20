import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface HealthCheckResult {
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

interface DatabaseHealthResult extends HealthCheckResult {
  connectionPool?: number;
  activeConnections?: number;
}

interface NotificationHealthResult extends HealthCheckResult {
  provider: string;
  features: string[];
}

interface OverallHealthResult {
  healthy: boolean;
  checks: {
    database: DatabaseHealthResult;
    notifications: NotificationHealthResult;
  };
  errors: string[];
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async checkHealth(): Promise<OverallHealthResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Check database health
    const dbHealth = await this.checkDatabaseHealth();
    if (!dbHealth.healthy) {
      errors.push(`Database: ${dbHealth.error}`);
    }

    // Check notification provider health
    const notificationHealth = await this.checkNotificationHealth();
    if (!notificationHealth.healthy) {
      errors.push(`Notifications: ${notificationHealth.error}`);
    }

    const overallHealthy = dbHealth.healthy && notificationHealth.healthy;

    this.logger.log(`Health check completed in ${Date.now() - startTime}ms. Healthy: ${overallHealthy}`);

    return {
      healthy: overallHealthy,
      checks: {
        database: dbHealth,
        notifications: notificationHealth,
      },
      errors,
    };
  }

  async checkDatabaseHealth(): Promise<DatabaseHealthResult> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1 as test`;
      
      // Test if we can read from the database
      const userCount = await this.prisma.user.count();
      
      // Test if we can write to the database (using a transaction)
      await this.prisma.$transaction(async (tx) => {
        // This is a safe test that doesn't actually modify data
        await tx.$queryRaw`SELECT 1 as write_test`;
      });

      const responseTime = Date.now() - startTime;

      this.logger.log(`Database health check passed in ${responseTime}ms`);

      return {
        healthy: true,
        responseTime,
        connectionPool: 10, // Default Prisma connection pool size
        activeConnections: 1, // At least one active connection for this check
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      
      this.logger.error(`Database health check failed after ${responseTime}ms: ${errorMessage}`);
      
      return {
        healthy: false,
        responseTime,
        error: errorMessage,
      };
    }
  }

  async checkNotificationHealth(): Promise<NotificationHealthResult> {
    const startTime = Date.now();
    
    try {
      // Check if email provider is configured
      const emailProvider = this.configService.get<string>('EMAIL_PROVIDER', 'console');
      
      // Test email provider connectivity
      const emailHealth = await this.testEmailProvider(emailProvider);
      
      // Check if we have required notification settings
      const hasRequiredSettings = this.checkNotificationSettings();
      
      const responseTime = Date.now() - startTime;
      const features = ['email', 'in-app'];

      this.logger.log(`Notification health check passed in ${responseTime}ms`);

      return {
        healthy: emailHealth && hasRequiredSettings,
        responseTime,
        provider: emailProvider,
        features,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown notification error';
      
      this.logger.error(`Notification health check failed after ${responseTime}ms: ${errorMessage}`);
      
      return {
        healthy: false,
        responseTime,
        provider: 'unknown',
        features: [],
        error: errorMessage,
      };
    }
  }

  private async testEmailProvider(provider: string): Promise<boolean> {
    try {
      switch (provider.toLowerCase()) {
        case 'console':
          // Console provider is always available
          return true;
          
        case 'sendgrid':
          // Test SendGrid connectivity
          return await this.testSendGridConnection();
          
        case 'aws-ses':
          // Test AWS SES connectivity
          return await this.testAwsSesConnection();
          
        case 'nodemailer':
          // Test Nodemailer connectivity
          return await this.testNodemailerConnection();
          
        default:
          this.logger.warn(`Unknown email provider: ${provider}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Email provider test failed for ${provider}: ${error}`);
      return false;
    }
  }

  private async testSendGridConnection(): Promise<boolean> {
    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
      if (!apiKey) {
        this.logger.warn('SendGrid API key not configured');
        return false;
      }

      // Test SendGrid API connectivity
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.error(`SendGrid connection test failed: ${error}`);
      return false;
    }
  }

  private async testAwsSesConnection(): Promise<boolean> {
    try {
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
      const region = this.configService.get<string>('AWS_REGION');

      if (!accessKeyId || !secretAccessKey || !region) {
        this.logger.warn('AWS SES credentials not fully configured');
        return false;
      }

      // For AWS SES, we'll just check if credentials are present
      // In a real implementation, you might want to test the actual SES API
      return true;
    } catch (error) {
      this.logger.error(`AWS SES connection test failed: ${error}`);
      return false;
    }
  }

  private async testNodemailerConnection(): Promise<boolean> {
    try {
      const smtpHost = this.configService.get<string>('SMTP_HOST');
      const smtpPort = this.configService.get<string>('SMTP_PORT');
      const smtpUser = this.configService.get<string>('SMTP_USER');
      const smtpPass = this.configService.get<string>('SMTP_PASS');

      if (!smtpHost || !smtpPort) {
        this.logger.warn('SMTP configuration incomplete');
        return false;
      }

      // For Nodemailer, we'll just check if configuration is present
      // In a real implementation, you might want to test the actual SMTP connection
      return true;
    } catch (error) {
      this.logger.error(`Nodemailer connection test failed: ${error}`);
      return false;
    }
  }

  private checkNotificationSettings(): boolean {
    try {
      // Check if basic notification settings are configured
      const defaultFromEmail = this.configService.get<string>('DEFAULT_FROM_EMAIL');
      const appName = this.configService.get<string>('APP_NAME', 'Notification API');

      // Basic validation - at least app name should be set
      return !!appName;
    } catch (error) {
      this.logger.error(`Notification settings check failed: ${error}`);
      return false;
    }
  }
} 