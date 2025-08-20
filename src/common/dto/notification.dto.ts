import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, IsBoolean, IsObject } from 'class-validator';

export enum NotificationType {
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  ASSIGNMENT = 'ASSIGNMENT',
  GRADE = 'GRADE',
  REMINDER = 'REMINDER',
  SYSTEM = 'SYSTEM',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum NotificationChannelType {
  EMAIL = 'EMAIL',
  FCM = 'FCM',
  WEBHOOK = 'WEBHOOK',
  SMS = 'SMS',
  SLACK = 'SLACK',
  DISCORD = 'DISCORD',
  TELEGRAM = 'TELEGRAM',
}

export enum NotificationDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETRY = 'RETRY',
}

export class CreateNotificationDto {
  @ApiProperty({ example: 'New Assignment Available' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Please complete the homework assignment by Friday.' })
  @IsString()
  message: string;

  @ApiProperty({ example: 'ASSIGNMENT', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ example: 'user-id-here' })
  @IsString()
  recipientId: string;

  @ApiProperty({
    example: ['EMAIL', 'FCM'],
    enum: NotificationChannelType,
    description: 'Channels to send the notification through'
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannelType, { each: true })
  channels?: NotificationChannelType[];
}

export class NotificationDeliveryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationChannelType })
  channelType: NotificationChannelType;

  @ApiProperty()
  channelValue: string;

  @ApiProperty({ enum: NotificationDeliveryStatus })
  status: NotificationDeliveryStatus;

  @ApiProperty()
  sentAt?: Date;

  @ApiProperty()
  deliveredAt?: Date;

  @ApiProperty()
  failedAt?: Date;

  @ApiProperty()
  errorMessage?: string;

  @ApiProperty()
  retryCount: number;
}

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ enum: NotificationStatus })
  status: NotificationStatus;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  recipientId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [NotificationDeliveryDto] })
  deliveries?: NotificationDeliveryDto[];
}

export class CreateNotificationChannelDto {
  @ApiProperty({ example: 'EMAIL', enum: NotificationChannelType })
  @IsEnum(NotificationChannelType)
  type: NotificationChannelType;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address, FCM token, webhook URL, etc.'
  })
  @IsString()
  value: string;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: { deviceId: 'device123', platform: 'android' },
    description: 'Additional channel-specific metadata'
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateNotificationChannelDto {
  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiProperty({
    example: { deviceId: 'device123', platform: 'android' },
    description: 'Additional channel-specific metadata'
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class NotificationChannelResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationChannelType })
  type: NotificationChannelType;

  @ApiProperty()
  value: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty()
  metadata?: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    example: ['EMAIL', 'FCM'],
    enum: NotificationChannelType,
    description: 'Active notification channels'
  })
  @IsArray()
  @IsEnum(NotificationChannelType, { each: true })
  activeChannels: NotificationChannelType[];

  @ApiProperty({
    example: ['ANNOUNCEMENT', 'ASSIGNMENT'],
    enum: NotificationType,
    description: 'Notification types to receive'
  })
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  notificationTypes: NotificationType[];

  @ApiProperty()
  emailEnabled: boolean;
  
  @ApiProperty()
  inAppEnabled: boolean;
} 