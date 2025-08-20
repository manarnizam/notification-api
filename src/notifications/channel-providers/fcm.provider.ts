import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannelType, NotificationDeliveryStatus } from '../../common/dto/notification.dto';
import { ChannelProvider, NotificationPayload, DeliveryResult } from './base.provider';

@Injectable()
export class FcmProvider implements ChannelProvider {
  readonly type = NotificationChannelType.FCM;
  readonly name = 'Firebase Cloud Messaging Provider';
  
  private readonly logger = new Logger(FcmProvider.name);
  private readonly serverKey: string;
  private readonly projectId: string;

  constructor(private readonly configService: ConfigService) {
    this.serverKey = this.configService.get<string>('FCM_SERVER_KEY', '');
    this.projectId = this.configService.get<string>('FCM_PROJECT_ID', '');
  }

  async send(channelValue: string, payload: NotificationPayload, metadata?: Record<string, any>): Promise<DeliveryResult> {
    const startTime = Date.now();
    
    try {
      if (!this.validateChannelValue(channelValue)) {
        return {
          success: false,
          status: NotificationDeliveryStatus.FAILED,
          errorMessage: 'Invalid FCM token format',
        };
      }

      if (!this.serverKey) {
        return {
          success: false,
          status: NotificationDeliveryStatus.FAILED,
          errorMessage: 'FCM server key not configured',
        };
      }

      const fcmPayload = {
        to: channelValue,
        notification: {
          title: payload.title,
          body: payload.message,
          sound: 'default',
          badge: '1',
        },
        data: {
          type: payload.type,
          ...payload.metadata,
          ...metadata,
        },
        priority: 'high',
        android: {
          priority: 'high',
          notification: {
            channel_id: 'default',
            priority: 'high',
            default_sound: true,
            default_vibrate_timings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              category: payload.type,
            },
          },
        },
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      });

      const responseData = await response.json();
      const responseTime = Date.now() - startTime;

      if (response.ok && responseData.success === 1) {
        this.logger.log(`FCM notification sent successfully in ${responseTime}ms`);
        return {
          success: true,
          status: NotificationDeliveryStatus.DELIVERED,
          messageId: responseData.results?.[0]?.message_id || `fcm_${Date.now()}`,
          metadata: { 
            provider: 'fcm', 
            responseTime,
            success: responseData.success,
            failure: responseData.failure,
          },
        };
      } else {
        const errorMessage = responseData.results?.[0]?.error || 'FCM API error';
        this.logger.error(`FCM notification failed after ${responseTime}ms: ${errorMessage}`);
        
        return {
          success: false,
          status: NotificationDeliveryStatus.FAILED,
          errorMessage,
          metadata: { 
            provider: 'fcm', 
            responseTime,
            success: responseData.success,
            failure: responseData.failure,
          },
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`FCM sending failed after ${responseTime}ms: ${errorMsg}`);
      
      return {
        success: false,
        status: NotificationDeliveryStatus.FAILED,
        errorMessage: errorMsg,
        metadata: { provider: 'fcm', responseTime },
      };
    }
  }

  async testConnection(channelValue: string): Promise<boolean> {
    try {
      if (!this.serverKey) {
        return false;
      }

      // Send a test notification to verify connectivity
      const testPayload: NotificationPayload = {
        title: 'Test Notification',
        message: 'This is a test notification to verify FCM connectivity',
        type: 'SYSTEM',
      };

      const result = await this.send(channelValue, testPayload);
      return result.success;
    } catch (error) {
      this.logger.error(`FCM connection test failed: ${error}`);
      return false;
    }
  }

  validateChannelValue(channelValue: string): boolean {
    // FCM tokens are typically 140+ characters and contain alphanumeric characters and some special chars
    const fcmTokenRegex = /^[A-Za-z0-9:_-]{140,}$/;
    return fcmTokenRegex.test(channelValue);
  }

  getMetadata(channelValue: string): Record<string, any> {
    return {
      provider: 'fcm',
      tokenLength: channelValue.length,
      type: 'push_notification',
      projectId: this.projectId,
    };
  }

  async sendToMultipleTokens(tokens: string[], payload: NotificationPayload, metadata?: Record<string, any>): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];
    
    // FCM allows sending to multiple tokens in a single request (up to 500)
    const batchSize = 500;
    const batches = this.chunkArray(tokens, batchSize);
    
    for (const batch of batches) {
      const batchResult = await this.sendBatch(batch, payload, metadata);
      results.push(...batchResult);
    }
    
    return results;
  }

  private async sendBatch(tokens: string[], payload: NotificationPayload, metadata?: Record<string, any>): Promise<DeliveryResult[]> {
    const startTime = Date.now();
    
    try {
      if (!this.serverKey) {
        return tokens.map(() => ({
          success: false,
          status: NotificationDeliveryStatus.FAILED,
          errorMessage: 'FCM server key not configured',
        }));
      }

      const fcmPayload = {
        registration_ids: tokens,
        notification: {
          title: payload.title,
          body: payload.message,
          sound: 'default',
          badge: '1',
        },
        data: {
          type: payload.type,
          ...payload.metadata,
          ...metadata,
        },
        priority: 'high',
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      });

      const responseData = await response.json();
      const responseTime = Date.now() - startTime;

      if (response.ok && responseData.results) {
        return responseData.results.map((result: any, index: number) => {
          if (result.message_id) {
            return {
              success: true,
              status: NotificationDeliveryStatus.DELIVERED,
              messageId: result.message_id,
              metadata: { 
                provider: 'fcm', 
                responseTime,
                tokenIndex: index,
              },
            };
          } else {
            return {
              success: false,
              status: NotificationDeliveryStatus.FAILED,
              errorMessage: result.error || 'Unknown FCM error',
              metadata: { 
                provider: 'fcm', 
                responseTime,
                tokenIndex: index,
              },
            };
          }
        });
      } else {
        const errorMessage = 'FCM batch API error';
        return tokens.map(() => ({
          success: false,
          status: NotificationDeliveryStatus.FAILED,
          errorMessage,
          metadata: { provider: 'fcm', responseTime },
        }));
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      return tokens.map(() => ({
        success: false,
        status: NotificationDeliveryStatus.FAILED,
        errorMessage: errorMsg,
        metadata: { provider: 'fcm', responseTime },
      }));
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
} 