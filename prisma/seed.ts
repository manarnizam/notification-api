import { NotificationChannelType, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { NotificationStatus, NotificationType } from 'src/common/dto/notification.dto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {},
    create: {
      email: 'admin@school.com',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
      emailEnabled: true,
      inAppEnabled: true,
    },
  });

  // Create teacher user
  const teacherPasswordHash = await bcrypt.hash('teacher123', 10);
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@school.com' },
    update: {},
    create: {
      email: 'teacher@school.com',
      name: 'John Teacher',
      role: 'TEACHER',
      passwordHash: teacherPasswordHash,
      emailEnabled: true,
      inAppEnabled: true,
    },
  });

  // Create student users
  const student1PasswordHash = await bcrypt.hash('student123', 10);
  const student1 = await prisma.user.upsert({
    where: { email: 'student1@school.com' },
    update: {},
    create: {
      email: 'student1@school.com',
      name: 'Alice Student',
      role: 'STUDENT',
      passwordHash: student1PasswordHash,
      emailEnabled: true,
      inAppEnabled: true,
    },
  });

  const student2PasswordHash = await bcrypt.hash('student123', 10);
  const student2 = await prisma.user.upsert({
    where: { email: 'student2@school.com' },
    update: {},
    create: {
      email: 'student2@school.com',
      name: 'Bob Student',
      role: 'STUDENT',
      passwordHash: student2PasswordHash,
      emailEnabled: false,
      inAppEnabled: true,
    },
  });

  // Create sample notification channels
  const channels = [
    {
      userId: student1.id,
      type: 'EMAIL',
      value: 'student1@school.com',
      isActive: true,
      isVerified: true,
      metadata: { verifiedAt: new Date() },
    },
    {
      userId: student1.id,
      type: 'FCM',
      value: 'fcm_token_student1_that_is_long_enough_to_pass_validation_140_chars_minimum_required_for_fcm_tokens_to_be_valid',
      isActive: true,
      isVerified: true,
      metadata: { deviceId: 'android_device_1', platform: 'android' },
    },
    {
      userId: student2.id,
      type: 'EMAIL',
      value: 'student2@school.com',
      isActive: false,
      isVerified: false,
      metadata: {},
    },
    {
      userId: teacher.id,
      type: 'EMAIL',
      value: 'teacher@school.com',
      isActive: true,
      isVerified: true,
      metadata: { verifiedAt: new Date() },
    },
    {
      userId: admin.id,
      type: 'EMAIL',
      value: 'admin@school.com',
      isActive: true,
      isVerified: true,
      metadata: { verifiedAt: new Date() },
    },
  ];

  for (const channelData of channels) {
    await prisma.notificationChannel.upsert({
      where: {
        userId_type_value: {
          userId: channelData.userId,
          type: channelData.type as NotificationChannelType,
          value: channelData.value,
        },
      },
      update: {},
      create: {
        userId: channelData.userId,
        type: channelData.type as NotificationChannelType,
        value: channelData.value,
        isActive: channelData.isActive,
        isVerified: channelData.isVerified,
        metadata: channelData.metadata,
      },
    });
  }

  // Create sample notifications
  const notifications = [
    {
      title: 'Welcome to the New Semester!',
      message: 'Welcome back! We hope you had a great break. Classes start next Monday.',
      type: 'ANNOUNCEMENT',
      senderId: admin.id,
      recipientId: student1.id,
      status: 'SENT',
    },
    {
      title: 'Math Assignment Due',
      message: 'Please complete the algebra homework by Friday. Submit through the online portal.',
      type: 'ASSIGNMENT',
      senderId: teacher.id,
      recipientId: student1.id,
      status: 'SENT',
    },
    {
      title: 'Science Quiz Results',
      message: 'Great job on the chemistry quiz! You scored 95%.',
      type: 'GRADE',
      senderId: teacher.id,
      recipientId: student1.id,
      status: 'READ',
    },
    {
      title: 'School Event Reminder',
      message: 'Don\'t forget about the science fair this weekend!',
      type: 'ANNOUNCEMENT',
      senderId: admin.id,
      recipientId: student2.id,
      status: 'PENDING',
    },
  ];

  for (const notificationData of notifications) {
    await prisma.notification.upsert({
      where: {
        id: `${notificationData.type}_${notificationData.recipientId}_${Date.now()}`,
      },
      update: {},
      create: {
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type as NotificationType,
        senderId: notificationData.senderId,
        recipientId: notificationData.recipientId,
        status: notificationData.status as NotificationStatus,
      },
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log('\n📋 Sample Users:');
  console.log(`   Admin: admin@school.com / admin123`);
  console.log(`   Teacher: teacher@school.com / teacher123`);
  console.log(`   Student 1: student1@school.com / student123`);
  console.log(`   Student 2: student2@school.com / student123`);
  console.log('\n🔔 Sample notifications have been created for testing.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 