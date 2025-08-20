import { NotificationChannelType, NotificationDeliveryStatus } from '../../common/dto/notification.dto';

export interface NotificationPayload {
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, any>;
}

export interface DeliveryResult {
  success: boolean;
  status: NotificationDeliveryStatus;
  messageId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface ChannelProvider {
  readonly type: NotificationChannelType;
  readonly name: string;
  
  /**
   * Send a notification through this channel
   */
  send(channelValue: string, payload: NotificationPayload, metadata?: Record<string, any>): Promise<DeliveryResult>;
  
  /**
   * Test the channel connectivity
   */
  testConnection(channelValue: string): Promise<boolean>;
  
  /**
   * Validate the channel value format
   */
  validateChannelValue(channelValue: string): boolean;
  
  /**
   * Get provider-specific metadata
   */
  getMetadata(channelValue: string): Record<string, any>;
} 