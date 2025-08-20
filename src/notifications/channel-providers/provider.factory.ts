import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannelType } from '../../common/dto/notification.dto';
import { ChannelProvider, NotificationPayload, DeliveryResult } from './base.provider';
import { EmailProvider } from './email.provider';
import { FcmProvider } from './fcm.provider';

@Injectable()
export class NotificationProviderFactory {
  private readonly logger = new Logger(NotificationProviderFactory.name);
  private readonly providers = new Map<NotificationChannelType, ChannelProvider>();

  constructor(
    private readonly emailProvider: EmailProvider,
    private readonly fcmProvider: FcmProvider,
  ) {
    this.registerProviders();
  }

  private registerProviders(): void {
    this.providers.set(NotificationChannelType.EMAIL, this.emailProvider);
    this.providers.set(NotificationChannelType.FCM, this.fcmProvider);
    
    this.logger.log(`Registered ${this.providers.size} notification providers`);
  }

  getProvider(type: NotificationChannelType): ChannelProvider | null {
    const provider = this.providers.get(type);
    if (!provider) {
      this.logger.warn(`No provider found for channel type: ${type}`);
    }
    return provider || null;
  }

  getAllProviders(): ChannelProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableTypes(): NotificationChannelType[] {
    return Array.from(this.providers.keys());
  }

  async sendNotification(
    type: NotificationChannelType,
    channelValue: string,
    payload: NotificationPayload,
    metadata?: Record<string, any>,
  ): Promise<DeliveryResult> {
    const provider = this.getProvider(type);
    if (!provider) {
      return {
        success: false,
        status: 'FAILED' as any,
        errorMessage: `No provider available for channel type: ${type}`,
      };
    }

    try {
      return await provider.send(channelValue, payload, metadata);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send notification via ${type}: ${errorMsg}`);
      
      return {
        success: false,
        status: 'FAILED' as any,
        errorMessage: errorMsg,
      };
    }
  }

  async sendToMultipleChannels(
    channels: Array<{ type: NotificationChannelType; value: string }>,
    payload: NotificationPayload,
    metadata?: Record<string, any>,
  ): Promise<Map<NotificationChannelType, DeliveryResult[]>> {
    const results = new Map<NotificationChannelType, DeliveryResult[]>();
    
    // Group by channel type for batch processing
    const groupedChannels = this.groupChannelsByType(channels);
    
    for (const [type, values] of groupedChannels) {
      const provider = this.getProvider(type);
      if (!provider) {
        const failedResults = values.map(() => ({
          success: false,
          status: 'FAILED' as any,
          errorMessage: `No provider available for channel type: ${type}`,
        }));
        results.set(type, failedResults);
        continue;
      }

      const typeResults: DeliveryResult[] = [];
      
      // Send to each channel value
      for (const value of values) {
        try {
          const result = await provider.send(value, payload, metadata);
          typeResults.push(result);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          typeResults.push({
            success: false,
            status: 'FAILED' as any,
            errorMessage: errorMsg,
          });
        }
      }
      
      results.set(type, typeResults);
    }
    
    return results;
  }

  async testAllProviders(): Promise<Map<NotificationChannelType, boolean>> {
    const results = new Map<NotificationChannelType, boolean>();
    
    for (const [type, provider] of this.providers) {
      try {
        // Use a test value for each provider type
        const testValue = this.getTestValueForType(type);
        const isHealthy = await provider.testConnection(testValue);
        results.set(type, isHealthy);
        
        this.logger.log(`Provider ${type} health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      } catch (error) {
        this.logger.error(`Provider ${type} health check failed: ${error}`);
        results.set(type, false);
      }
    }
    
    return results;
  }

  async validateChannelValue(type: NotificationChannelType, value: string): Promise<boolean> {
    const provider = this.getProvider(type);
    if (!provider) {
      return false;
    }
    
    return provider.validateChannelValue(value);
  }

  getProviderMetadata(type: NotificationChannelType, value: string): Record<string, any> | null {
    const provider = this.getProvider(type);
    if (!provider) {
      return null;
    }
    
    return provider.getMetadata(value);
  }

  private groupChannelsByType(
    channels: Array<{ type: NotificationChannelType; value: string }>,
  ): Map<NotificationChannelType, string[]> {
    const grouped = new Map<NotificationChannelType, string[]>();
    
    for (const channel of channels) {
      if (!grouped.has(channel.type)) {
        grouped.set(channel.type, []);
      }
      grouped.get(channel.type)!.push(channel.value);
    }
    
    return grouped;
  }

  private getTestValueForType(type: NotificationChannelType): string {
    switch (type) {
      case NotificationChannelType.EMAIL:
        return 'test@example.com';
      case NotificationChannelType.FCM:
        return 'test_fcm_token_that_is_long_enough_to_pass_validation_140_chars_minimum_required_for_fcm_tokens_to_be_valid';
      case NotificationChannelType.WEBHOOK:
        return 'https://webhook.site/test';
      case NotificationChannelType.SMS:
        return '+1234567890';
      case NotificationChannelType.SLACK:
        return 'https://hooks.slack.com/services/test';
      case NotificationChannelType.DISCORD:
        return 'https://discord.com/api/webhooks/test';
      case NotificationChannelType.TELEGRAM:
        return '123456789:test_bot_token';
      default:
        return 'test_value';
    }
  }

  getProviderInfo(): Array<{ type: NotificationChannelType; name: string; available: boolean }> {
    return Array.from(this.providers.entries()).map(([type, provider]) => ({
      type,
      name: provider.name,
      available: true,
    }));
  }
} 