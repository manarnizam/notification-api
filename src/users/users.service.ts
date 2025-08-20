import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from '../common/dto/notification.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailEnabled: true,
        inAppEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updatePreferences(userId: string, preferencesDto: UpdateNotificationPreferencesDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailEnabled: preferencesDto.emailEnabled,
        inAppEnabled: preferencesDto.inAppEnabled,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailEnabled: true,
        inAppEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }
} 