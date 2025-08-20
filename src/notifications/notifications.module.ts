import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailProvider } from './channel-providers/email.provider';
import { FcmProvider } from './channel-providers/fcm.provider';
import { NotificationProviderFactory } from './channel-providers/provider.factory';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService, 
    EmailProvider,
    FcmProvider,
    NotificationProviderFactory,
  ],
  exports: [NotificationsService, NotificationProviderFactory],
})
export class NotificationsModule {} 