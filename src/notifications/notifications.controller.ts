import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { 
  CreateNotificationDto, 
  NotificationResponseDto, 
  NotificationStatus,
  CreateNotificationChannelDto,
  UpdateNotificationChannelDto,
  NotificationChannelResponseDto,
} from '../common/dto/notification.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new notification (admin/teacher only)' })
  @ApiResponse({ status: 201, description: 'Notification created successfully', type: NotificationResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async createNotification(
    @Request() req,
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    // Check if user has permission to create notifications
    if (!['TEACHER', 'ADMIN'].includes(req.user.role)) {
      throw new Error('Insufficient permissions to create notifications');
    }

    return this.notificationsService.createNotification(req.user.id, createNotificationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications with optional filtering' })
  @ApiQuery({ name: 'status', required: false, enum: NotificationStatus })
  @ApiQuery({ name: 'type', required: false, enum: ['ANNOUNCEMENT', 'ASSIGNMENT', 'GRADE', 'REMINDER', 'SYSTEM'] })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async getUserNotifications(
    @Request() req,
    @Query('status') status?: NotificationStatus,
    @Query('type') type?: string,
  ) {
    return this.notificationsService.getUserNotifications(req.user.id, status, type);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read', type: NotificationResponseDto })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Request() req,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  // Channel management endpoints
  @Post('channels')
  @ApiOperation({ summary: 'Create a new notification channel' })
  @ApiResponse({ status: 201, description: 'Channel created successfully', type: NotificationChannelResponseDto })
  async createNotificationChannel(
    @Request() req,
    @Body() createChannelDto: CreateNotificationChannelDto,
  ): Promise<NotificationChannelResponseDto> {
    return this.notificationsService.createNotificationChannel(req.user.id, createChannelDto);
  }

  @Get('channels')
  @ApiOperation({ summary: 'Get user notification channels' })
  @ApiResponse({ status: 200, description: 'Channels retrieved successfully', type: [NotificationChannelResponseDto] })
  async getUserChannels(@Request() req): Promise<NotificationChannelResponseDto[]> {
    return this.notificationsService.getUserChannels(req.user.id);
  }

  @Patch('channels/:id')
  @ApiOperation({ summary: 'Update notification channel' })
  @ApiResponse({ status: 200, description: 'Channel updated successfully', type: NotificationChannelResponseDto })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async updateNotificationChannel(
    @Request() req,
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateNotificationChannelDto,
  ): Promise<NotificationChannelResponseDto> {
    return this.notificationsService.updateNotificationChannel(req.user.id, id, updateChannelDto);
  }

  @Delete('channels/:id')
  @ApiOperation({ summary: 'Delete notification channel' })
  @ApiResponse({ status: 200, description: 'Channel deleted successfully' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async deleteNotificationChannel(
    @Request() req,
    @Param('id') id: string,
  ): Promise<void> {
    return this.notificationsService.deleteNotificationChannel(req.user.id, id);
  }

  @Post('channels/:id/test')
  @ApiOperation({ summary: 'Test notification channel' })
  @ApiResponse({ status: 200, description: 'Channel test completed' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async testChannel(
    @Request() req,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.notificationsService.testChannel(req.user.id, id);
    return {
      success,
      message: success ? 'Channel test successful' : 'Channel test failed',
    };
  }
} 