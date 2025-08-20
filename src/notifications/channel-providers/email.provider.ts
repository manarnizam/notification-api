import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannelType, NotificationDeliveryStatus } from '../../common/dto/notification.dto';
import { ChannelProvider, NotificationPayload, DeliveryResult } from './base.provider';

@Injectable()
export class EmailProvider implements ChannelProvider {
  readonly type = NotificationChannelType.EMAIL;
  readonly name = 'Email Provider';
  
  private readonly logger = new Logger(EmailProvider.name);
  private readonly provider: string;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('EMAIL_PROVIDER', 'console');
    this.defaultFrom = this.configService.get<string>('DEFAULT_FROM_EMAIL', 'noreply@notification-api.com');
  }

  async send(channelValue: string, payload: NotificationPayload, metadata?: Record<string, any>): Promise<DeliveryResult> {
    const startTime = Date.now();
    
    try {
      if (!this.validateChannelValue(channelValue)) {
        return {
          success: false,
          status: NotificationDeliveryStatus.FAILED,
          errorMessage: 'Invalid email address format',
        };
      }

      let success = false;
      let messageId: string | undefined;
      let errorMessage: string | undefined;

      switch (this.provider.toLowerCase()) {
        case 'console':
          success = await this.sendViaConsole(channelValue, payload);
          messageId = `console_${Date.now()}`;
          break;
        case 'sendgrid':
          const sendGridResult = await this.sendViaSendGrid(channelValue, payload);
          success = sendGridResult.success;
          messageId = sendGridResult.messageId;
          errorMessage = sendGridResult.errorMessage;
          break;
        case 'aws-ses':
          const awsResult = await this.sendViaAwsSes(channelValue, payload);
          success = awsResult.success;
          messageId = awsResult.messageId;
          errorMessage = awsResult.errorMessage;
          break;
        case 'nodemailer':
          const smtpResult = await this.sendViaNodemailer(channelValue, payload);
          success = smtpResult.success;
          messageId = smtpResult.messageId;
          errorMessage = smtpResult.errorMessage;
          break;
        default:
          this.logger.warn(`Unknown email provider: ${this.provider}, falling back to console`);
          success = await this.sendViaConsole(channelValue, payload);
          messageId = `console_${Date.now()}`;
      }

      const responseTime = Date.now() - startTime;
      
      if (success) {
        this.logger.log(`Email sent successfully via ${this.provider} in ${responseTime}ms`);
        return {
          success: true,
          status: NotificationDeliveryStatus.DELIVERED,
          messageId,
          metadata: { provider: this.provider, responseTime },
        };
      } else {
        this.logger.error(`Failed to send email via ${this.provider} after ${responseTime}ms: ${errorMessage}`);
        return {
          success: false,
          status: NotificationDeliveryStatus.FAILED,
          errorMessage,
          metadata: { provider: this.provider, responseTime },
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Email sending failed after ${responseTime}ms: ${errorMsg}`);
      
      return {
        success: false,
        status: NotificationDeliveryStatus.FAILED,
        errorMessage: errorMsg,
        metadata: { provider: this.provider, responseTime },
      };
    }
  }

  async testConnection(channelValue: string): Promise<boolean> {
    try {
      switch (this.provider.toLowerCase()) {
        case 'console':
          return true;
        case 'sendgrid':
          return await this.testSendGridConnection();
        case 'aws-ses':
          return await this.testAwsSesConnection();
        case 'nodemailer':
          return await this.testNodemailerConnection();
        default:
          return false;
      }
    } catch (error) {
      this.logger.error(`Email provider test failed for ${this.provider}: ${error}`);
      return false;
    }
  }

  validateChannelValue(channelValue: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(channelValue);
  }

  getMetadata(channelValue: string): Record<string, any> {
    return {
      provider: this.provider,
      domain: channelValue.split('@')[1],
      type: 'email',
    };
  }

  private async sendViaConsole(channelValue: string, payload: NotificationPayload): Promise<boolean> {
    console.log('\n📧 === EMAIL NOTIFICATION ===');
    console.log(`From: ${this.defaultFrom}`);
    console.log(`To: ${channelValue}`);
    console.log(`Subject: ${payload.title}`);
    console.log(`Message: ${payload.message}`);
    console.log(`Type: ${payload.type}`);
    if (payload.metadata) {
      console.log(`Metadata: ${JSON.stringify(payload.metadata)}`);
    }
    console.log('=== END EMAIL ===\n');
    
    return true;
  }

  private async sendViaSendGrid(channelValue: string, payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; errorMessage?: string }> {
    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
      if (!apiKey) {
        return { success: false, errorMessage: 'SendGrid API key not configured' };
      }

      const emailData = {
        personalizations: [
          {
            to: [{ email: channelValue }],
            subject: payload.title,
          },
        ],
        from: { email: this.defaultFrom },
        content: [
          {
            type: 'text/plain',
            value: payload.message,
          },
        ],
      };

      if (payload.metadata?.html) {
        emailData.content.push({
          type: 'text/html',
          value: payload.metadata.html,
        });
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, errorMessage: `SendGrid API error: ${response.status} - ${errorText}` };
      }

      const messageId = `sg_${Date.now()}`;
      return { success: true, messageId };
    } catch (error) {
      return { success: false, errorMessage: `SendGrid error: ${error}` };
    }
  }

  private async sendViaAwsSes(channelValue: string, payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; errorMessage?: string }> {
    try {
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
      const region = this.configService.get<string>('AWS_REGION');

      if (!accessKeyId || !secretAccessKey || !region) {
        return { success: false, errorMessage: 'AWS SES credentials not fully configured' };
      }

      // TODO: Implement actual AWS SES sending using @aws-sdk/client-ses
      this.logger.log(`Would send email via AWS SES to ${channelValue}: ${payload.title}`);
      
      const messageId = `ses_${Date.now()}`;
      return { success: true, messageId };
    } catch (error) {
      return { success: false, errorMessage: `AWS SES error: ${error}` };
    }
  }

  private async sendViaNodemailer(channelValue: string, payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; errorMessage?: string }> {
    try {
      const smtpHost = this.configService.get<string>('SMTP_HOST');
      const smtpPort = this.configService.get<string>('SMTP_PORT');

      if (!smtpHost || !smtpPort) {
        return { success: false, errorMessage: 'SMTP configuration incomplete' };
      }

      // TODO: Implement actual SMTP sending using nodemailer
      this.logger.log(`Would send email via SMTP (${smtpHost}:${smtpPort}) to ${channelValue}: ${payload.title}`);
      
      const messageId = `smtp_${Date.now()}`;
      return { success: true, messageId };
    } catch (error) {
      return { success: false, errorMessage: `SMTP error: ${error}` };
    }
  }

  private async testSendGridConnection(): Promise<boolean> {
    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
      if (!apiKey) {
        return false;
      }

      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async testAwsSesConnection(): Promise<boolean> {
    try {
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
      const region = this.configService.get<string>('AWS_REGION');

      return !!(accessKeyId && secretAccessKey && region);
    } catch (error) {
      return false;
    }
  }

  private async testNodemailerConnection(): Promise<boolean> {
    try {
      const smtpHost = this.configService.get<string>('SMTP_HOST');
      const smtpPort = this.configService.get<string>('SMTP_PORT');

      return !!(smtpHost && smtpPort);
    } catch (error) {
      return false;
    }
  }
} 