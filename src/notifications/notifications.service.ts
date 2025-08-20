import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationProviderFactory } from './channel-providers/provider.factory';
import { 
  CreateNotificationDto, 
  NotificationResponseDto, 
  NotificationStatus,
  NotificationChannelType,
  NotificationDeliveryStatus,
  CreateNotificationChannelDto,
  UpdateNotificationChannelDto,
  NotificationChannelResponseDto,
  NotificationType,
} from '../common/dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private providerFactory: NotificationProviderFactory,
  ) {}

  async createNotification(senderId: string, createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const { title, message, type, recipientId, channels } = createNotificationDto;

    // Check if recipient exists
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      include: {
        notificationChannels: {
          where: { isActive: true },
        },
      },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    // Create notification
    const notification = await this.prisma.notification.create({
      data: {
        title,
        message,
        type,
        senderId,
        recipientId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Determine which channels to use
    const channelsToUse = channels || this.getDefaultChannels(recipient.notificationChannels);
    
    // Send notifications through each channel
    const deliveryResults = await this.sendToChannels(
      notification,
      recipient.notificationChannels.filter(channel => channelsToUse.includes(channel.type as NotificationChannelType)),
    );

    // Update notification status based on delivery results
    const hasSuccessfulDeliveries = deliveryResults.some(result => result.success);
    const hasFailedDeliveries = deliveryResults.some(result => !result.success);
    
    let notificationStatus: NotificationStatus;
    if (hasSuccessfulDeliveries && !hasFailedDeliveries) {
      notificationStatus = NotificationStatus.SENT;
    } else if (hasSuccessfulDeliveries && hasFailedDeliveries) {
      notificationStatus =  NotificationStatus.SENT;
    } else {
      notificationStatus =  NotificationStatus.FAILED;
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { status: notificationStatus },
    });

    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type as NotificationType,
      status: notificationStatus,
      senderId: notification.senderId,
      recipientId: notification.recipientId,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      deliveries: deliveryResults.map(result => ({
        id: result.deliveryId || '',
        channelType: result.channelType,
        channelValue: result.channelValue,
        status: result.status,
        sentAt: result.sentAt,
        deliveredAt: result.deliveredAt,
        failedAt: result.failedAt,
        errorMessage: result.errorMessage,
        retryCount: result.retryCount || 0,
      })),
    };
  }

  async getUserNotifications(userId: string, status?: NotificationStatus, type?: string) {
    const where: any = { recipientId: userId };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        deliveries: {
          include: {
            channel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      status: notification.status,
      senderId: notification.senderId,
      recipientId: notification.recipientId,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      sender: notification.sender,
      deliveries: notification.deliveries.map(delivery => ({
        id: delivery.id,
        channelType: delivery.channel.type,
        channelValue: delivery.channel.value,
        status: delivery.status,
        sentAt: delivery.sentAt,
        deliveredAt: delivery.deliveredAt,
        failedAt: delivery.failedAt,
        errorMessage: delivery.errorMessage,
        retryCount: delivery.retryCount,
      })),
    }));
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'READ' },
    });

    return {
      id: updatedNotification.id,
      title: updatedNotification.title,
      message: updatedNotification.message,
      type: updatedNotification.type as NotificationType,
      status: updatedNotification.status as NotificationStatus,
      senderId: updatedNotification.senderId,
      recipientId: updatedNotification.recipientId,
      createdAt: updatedNotification.createdAt,
      updatedAt: updatedNotification.updatedAt,
    };
  }

  // Channel management methods
  async createNotificationChannel(userId: string, createChannelDto: CreateNotificationChannelDto): Promise<NotificationChannelResponseDto> {
    // Validate channel value
    const isValid = await this.providerFactory.validateChannelValue(createChannelDto.type, createChannelDto.value);
    if (!isValid) {
      throw new Error(`Invalid ${createChannelDto.type} value format`);
    }

    const channel = await this.prisma.notificationChannel.create({
      data: {
        userId,
        type: createChannelDto.type,
        value: createChannelDto.value,
        isActive: createChannelDto.isActive ?? true,
        metadata: createChannelDto.metadata || {},
      },
    });

    return {
      id: channel.id,
      type: channel.type as NotificationChannelType,
      value: channel.value,
      isActive: channel.isActive,
      isVerified: channel.isVerified,
      metadata: channel.metadata as Record<string, any>,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    };
  }

  async updateNotificationChannel(userId: string, channelId: string, updateChannelDto: UpdateNotificationChannelDto): Promise<NotificationChannelResponseDto> {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: {
        id: channelId,
        userId,
      },
    });

    if (!channel) {
      throw new NotFoundException('Notification channel not found');
    }

    const updatedChannel = await this.prisma.notificationChannel.update({
      where: { id: channelId },
      data: {
        isActive: updateChannelDto.isActive,
        isVerified: updateChannelDto.isVerified,
        metadata: updateChannelDto.metadata,
      },
    });

    return {
      id: updatedChannel.id,
      type: updatedChannel.type as NotificationChannelType,
      value: updatedChannel.value,
      isActive: updatedChannel.isActive,
      isVerified: updatedChannel.isVerified,
      metadata: updatedChannel.metadata as Record<string, any>,
      createdAt: updatedChannel.createdAt,
      updatedAt: updatedChannel.updatedAt,
    };
  }

  async getUserChannels(userId: string): Promise<NotificationChannelResponseDto[]> {
    const channels = await this.prisma.notificationChannel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map(channel => ({
      id: channel.id,
      type: channel.type as NotificationChannelType,
      value: channel.value,
      isActive: channel.isActive,
      isVerified: channel.isVerified,
      metadata: channel.metadata as Record<string, any>,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
    }));
  }

  async deleteNotificationChannel(userId: string, channelId: string): Promise<void> {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: {
        id: channelId,
        userId,
      },
    });

    if (!channel) {
      throw new NotFoundException('Notification channel not found');
    }

    await this.prisma.notificationChannel.delete({
      where: { id: channelId },
    });
  }

  async testChannel(userId: string, channelId: string): Promise<boolean> {
    const channel = await this.prisma.notificationChannel.findFirst({
      where: {
        id: channelId,
        userId,
      },
    });

    if (!channel) {
      throw new NotFoundException('Notification channel not found');
    }

    const provider = this.providerFactory.getProvider(channel.type as NotificationChannelType);
    if (!provider) {
      throw new Error(`No provider available for channel type: ${channel.type}`);
    }

    return await provider.testConnection(channel.value);
  }

  private getDefaultChannels(userChannels: any[]): NotificationChannelType[] {
    // Return all active channel types the user has configured
    return userChannels.map(channel => channel.type);
  }

  private async sendToChannels(notification: any, channels: any[]): Promise<any[]> {
    const deliveryResults = [];

    for (const channel of channels) {
      try {
        const payload = {
          title: notification.title,
          message: notification.message,
          type: notification.type,
          metadata: {
            senderName: notification.sender.name,
            senderEmail: notification.sender.email,
          },
        };

        const result = await this.providerFactory.sendNotification(
          channel.type,
          channel.value,
          payload,
          channel.metadata,
        );

        // Create delivery record
        const delivery = await this.prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channelId: channel.id,
            status: result.status,
            sentAt: result.success ? new Date() : null,
            deliveredAt: result.status === 'DELIVERED' ? new Date() : null,
            failedAt: !result.success ? new Date() : null,
            errorMessage: result.errorMessage,
            metadata: result.metadata,
          },
        });

        deliveryResults.push({
          ...result,
          deliveryId: delivery.id,
          channelType: channel.type,
          channelValue: channel.value,
          retryCount: delivery.retryCount,
        });
      } catch (error) {
        // Create failed delivery record
        const delivery = await this.prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channelId: channel.id,
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        deliveryResults.push({
          success: false,
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          deliveryId: delivery.id,
          channelType: channel.type,
          channelValue: channel.value,
          retryCount: delivery.retryCount,
        });
      }
    }

    return deliveryResults;
  }
} 