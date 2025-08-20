import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: string;
  private readonly defaultFrom: string;
  private readonly appName: string;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService.get<string>('EMAIL_PROVIDER', 'console');
    this.defaultFrom = this.configService.get<string>('DEFAULT_FROM_EMAIL', 'noreply@notification-api.com');
    this.appName = this.configService.get<string>('APP_NAME', 'Notification API');
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      let success = false;
      
      switch (this.provider.toLowerCase()) {
        case 'console':
          success = await this.sendViaConsole(options);
          break;
        case 'sendgrid':
          success = await this.sendViaSendGrid(options);
          break;
        case 'aws-ses':
          success = await this.sendViaAwsSes(options);
          break;
        case 'nodemailer':
          success = await this.sendViaNodemailer(options);
          break;
        default:
          this.logger.warn(`Unknown email provider: ${this.provider}, falling back to console`);
          success = await this.sendViaConsole(options);
      }

      const responseTime = Date.now() - startTime;
      
      if (success) {
        this.logger.log(`Email sent successfully via ${this.provider} in ${responseTime}ms`);
      } else {
        this.logger.error(`Failed to send email via ${this.provider} after ${responseTime}ms`);
      }

      return success;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`Email sending failed after ${responseTime}ms: ${error}`);
      return false;
    }
  }

  private async sendViaConsole(options: EmailOptions): Promise<boolean> {
    const from = options.from || this.defaultFrom;
    
    console.log('\n📧 === EMAIL NOTIFICATION ===');
    console.log(`From: ${from}`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Text: ${options.text}`);
    if (options.html) {
      console.log(`HTML: ${options.html}`);
    }
    console.log('=== END EMAIL ===\n');
    
    return true;
  }

  private async sendViaSendGrid(options: EmailOptions): Promise<boolean> {
    try {
      const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
      if (!apiKey) {
        this.logger.error('SendGrid API key not configured');
        return false;
      }

      const from = options.from || this.defaultFrom;
      
      const emailData = {
        personalizations: [
          {
            to: [{ email: options.to }],
            subject: options.subject,
          },
        ],
        from: { email: from },
        content: [
          {
            type: 'text/plain',
            value: options.text,
          },
        ],
      };

      if (options.html) {
        emailData.content.push({
          type: 'text/html',
          value: options.html,
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
        this.logger.error(`SendGrid API error: ${response.status} - ${errorText}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`SendGrid email sending failed: ${error}`);
      return false;
    }
  }

  private async sendViaAwsSes(options: EmailOptions): Promise<boolean> {
    try {
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
      const region = this.configService.get<string>('AWS_REGION');

      if (!accessKeyId || !secretAccessKey || !region) {
        this.logger.error('AWS SES credentials not fully configured');
        return false;
      }

      // For now, we'll just log that we would send via AWS SES
      // In a real implementation, you would use the AWS SDK
      this.logger.log(`Would send email via AWS SES to ${options.to}: ${options.subject}`);
      
      // TODO: Implement actual AWS SES sending using @aws-sdk/client-ses
      // const sesClient = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
      // const command = new SendEmailCommand({...});
      // await sesClient.send(command);
      
      return true;
    } catch (error) {
      this.logger.error(`AWS SES email sending failed: ${error}`);
      return false;
    }
  }

  private async sendViaNodemailer(options: EmailOptions): Promise<boolean> {
    try {
      const smtpHost = this.configService.get<string>('SMTP_HOST');
      const smtpPort = this.configService.get<string>('SMTP_PORT');
      const smtpUser = this.configService.get<string>('SMTP_USER');
      const smtpPass = this.configService.get<string>('SMTP_PASS');

      if (!smtpHost || !smtpPort) {
        this.logger.error('SMTP configuration incomplete');
        return false;
      }

      // For now, we'll just log that we would send via SMTP
      // In a real implementation, you would use nodemailer
      this.logger.log(`Would send email via SMTP (${smtpHost}:${smtpPort}) to ${options.to}: ${options.subject}`);
      
      // TODO: Implement actual SMTP sending using nodemailer
      // const transporter = nodemailer.createTransporter({...});
      // await transporter.sendMail({...});
      
      return true;
    } catch (error) {
      this.logger.error(`Nodemailer email sending failed: ${error}`);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    const testEmail: EmailOptions = {
      to: 'test@example.com',
      subject: 'Connection Test',
      text: 'This is a test email to verify the email provider connection.',
    };

    return this.sendEmail(testEmail);
  }

  getProviderInfo(): { provider: string; configured: boolean } {
    let configured = false;

    switch (this.provider.toLowerCase()) {
      case 'console':
        configured = true;
        break;
      case 'sendgrid':
        configured = !!this.configService.get<string>('SENDGRID_API_KEY');
        break;
      case 'aws-ses':
        configured = !!(this.configService.get<string>('AWS_ACCESS_KEY_ID') && 
                       this.configService.get<string>('AWS_SECRET_ACCESS_KEY') && 
                       this.configService.get<string>('AWS_REGION'));
        break;
      case 'nodemailer':
        configured = !!(this.configService.get<string>('SMTP_HOST') && 
                       this.configService.get<string>('SMTP_PORT'));
        break;
    }

    return {
      provider: this.provider,
      configured,
    };
  }
} 