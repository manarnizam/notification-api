import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async getHealth(@Res() res: Response): Promise<any> {
    const startTime = Date.now();
    
    // Check database health
    const dbHealth = await this.checkDatabaseHealth();
    
    // Check notification provider health
    const notificationHealth = await this.checkNotificationHealth();
    
    const overallHealthy = dbHealth.healthy && notificationHealth.healthy;
    const responseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'Notification API',
      version: '1.0.0',
      responseTime,
      checks: {
        database: dbHealth,
        notifications: notificationHealth,
      },
      errors: [
        ...(dbHealth.healthy ? [] : [`Database: ${dbHealth.error}`]),
        ...(notificationHealth.healthy ? [] : [`Notifications: ${notificationHealth.error}`]),
      ],
    };

    const statusCode = overallHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(healthStatus);
  }

  @Get('db')
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  async getDatabaseHealth(@Res() res: Response) {
    const dbHealth = await this.checkDatabaseHealth();
    
    const response = {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'Database',
      responseTime: dbHealth.responseTime,
      ...(dbHealth.error && { error: dbHealth.error }),
      ...(dbHealth.details && { details: dbHealth.details }),
    };

    const statusCode = dbHealth.healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(response);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Notification provider health check' })
  @ApiResponse({ status: 200, description: 'Notification provider is healthy' })
  @ApiResponse({ status: 503, description: 'Notification provider is unhealthy' })
  async getNotificationHealth(@Res() res: Response) {
    const notificationHealth = await this.checkNotificationHealth();
    
    const response = {
      status: notificationHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'Notification Provider',
      responseTime: notificationHealth.responseTime,
      provider: notificationHealth.provider,
      ...(notificationHealth.error && { error: notificationHealth.error }),
      ...(notificationHealth.details && { details: notificationHealth.details }),
    };

    const statusCode = notificationHealth.healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(response);
  }

  private async checkDatabaseHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
    details?: any;
  }> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await (this.prisma as any).$queryRaw`SELECT 1 as test`;
      
      // Test if we can read from the database (try to count users)
      let userCount = 0;
      try {
        userCount = await (this.prisma as any).user?.count() || 0;
      } catch (e) {
        // If user table doesn't exist, that's okay for health check
        userCount = 0;
      }
      
      // Test transaction capability
      await (this.prisma as any).$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT 1 as write_test`;
      });

      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        responseTime,
        details: {
          connectionStatus: 'connected',
          userCount,
          transactionSupport: true,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      
      return {
        healthy: false,
        responseTime,
        error: errorMessage,
        details: {
          connectionStatus: 'failed',
          errorType: error?.code || 'unknown',
        },
      };
    }
  }

  private async checkNotificationHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
    provider: string;
    error?: string;
    details?: any;
  }> {
    const startTime = Date.now();
    
    try {
      const emailProvider = this.configService.get<string>('EMAIL_PROVIDER', 'console');
      const fcmServerKey = this.configService.get<string>('FCM_SERVER_KEY');
      
      // Check email provider configuration
      const emailHealthy = await this.testEmailProvider(emailProvider);
      
      // Check FCM configuration
      const fcmHealthy = fcmServerKey ? true : false;
      
      const responseTime = Date.now() - startTime;
      
      const details = {
        email: {
          provider: emailProvider,
          configured: emailHealthy,
        },
        fcm: {
          configured: fcmHealthy,
          hasServerKey: !!fcmServerKey,
        },
      };

      return {
        healthy: emailHealthy,
        responseTime,
        provider: emailProvider,
        details,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown notification error';
      
      return {
        healthy: false,
        responseTime,
        provider: 'unknown',
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
          const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
          if (!apiKey) return false;
          
          // Test SendGrid API connectivity
          const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          return response.ok;
          
        case 'aws-ses':
          const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
          const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
          const region = this.configService.get<string>('AWS_REGION');
          return !!(accessKeyId && secretAccessKey && region);
          
        case 'nodemailer':
          const smtpHost = this.configService.get<string>('SMTP_HOST');
          const smtpPort = this.configService.get<string>('SMTP_PORT');
          return !!(smtpHost && smtpPort);
          
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }
} 