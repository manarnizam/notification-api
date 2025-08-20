# Notification API for Educational Platform

A comprehensive notification system built with NestJS, PostgreSQL, and Prisma for educational platforms. This API allows users to register, login, receive notifications (in-app + email), and manage their notification preferences.

## 🚀 Features

- **User Authentication**: JWT-based authentication with role-based access control
- **Notification System**: Create, fetch, and mark notifications as read
- **Multi-Channel Notifications**: Support for Email, FCM (Firebase), Webhooks, SMS, Slack, Discord, Telegram
- **User Preferences**: Control email and in-app notification settings
- **Role-based Access**: Admin, Teacher, and Student roles with different permissions
- **Health Monitoring**: Comprehensive health checks for database and notification providers
- **API Documentation**: Swagger/OpenAPI documentation
- **Database**: PostgreSQL with Prisma ORM
- **TypeScript**: Full type safety and modern development experience

## 🛠 Tech Stack

- **Backend**: NestJS (Node.js + TypeScript)
- **Database**: PostgreSQL + Prisma
- **Authentication**: JWT
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator + class-transformer

## 📋 API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user (returns JWT token)

### Users
- `GET /users/me` - Get current user profile
- `PATCH /users/preferences` - Update notification preferences

### Notifications
- `POST /notifications` - Create a notification (admin/teacher only)
- `GET /notifications` - List user's notifications (with filtering)
- `PATCH /notifications/:id/read` - Mark notification as read

### Notification Channels
- `POST /notifications/channels` - Create a notification channel
- `GET /notifications/channels` - Get user's notification channels
- `PATCH /notifications/channels/:id` - Update notification channel
- `DELETE /notifications/channels/:id` - Delete notification channel
- `POST /notifications/channels/:id/test` - Test notification channel

### System
- `GET /health` - Comprehensive health check (database + notifications)
- `GET /health/db` - Database connectivity check
- `GET /health/notifications` - Notification provider connectivity check
- `GET /api/docs` - Swagger documentation

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd notification-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your database and JWT configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/notification_api?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_EXPIRES_IN="7d"
   PORT=3000
   NODE_ENV="development"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed the database with sample data
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

Once the server is running, you can access the interactive API documentation at:
- **Swagger UI**: `http://localhost:3000/api/docs`

## 🧪 Testing the API

### Sample Users (created by seed script)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@school.com | admin123 |
| Teacher | teacher@school.com | teacher123 |
| Student 1 | student1@school.com | student123 |
| Student 2 | student2@school.com | student123 |

### Example API Calls

1. **Register a new user**
   ```bash
   curl -X POST http://localhost:3000/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "newstudent@school.com",
       "name": "New Student",
       "password": "password123",
       "role": "STUDENT"
     }'
   ```

2. **Login**
   ```bash
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "student1@school.com",
       "password": "student123"
     }'
   ```

3. **Get user profile (with JWT token)**
   ```bash
   curl -X GET http://localhost:3000/users/me \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

4. **Create a notification (teacher/admin only)**
   ```bash
   curl -X POST http://localhost:3000/notifications \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "New Assignment",
       "message": "Please complete the homework by Friday",
       "type": "ASSIGNMENT",
       "recipientId": "student-id-here"
     }'
   ```

5. **Get notifications**
   ```bash
   curl -X GET "http://localhost:3000/notifications?status=SENT&type=ASSIGNMENT" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

6. **Create notification channel (Email)**
   ```bash
   curl -X POST http://localhost:3000/notifications/channels \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "EMAIL",
       "value": "user@example.com",
       "isActive": true
     }'
   ```

7. **Create notification channel (FCM)**
   ```bash
   curl -X POST http://localhost:3000/notifications/channels \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "FCM",
       "value": "your_fcm_token_here_140_chars_minimum",
       "isActive": true,
       "metadata": {
         "deviceId": "android_device_1",
         "platform": "android"
       }
     }'
   ```

8. **Send notification to specific channels**
   ```bash
   curl -X POST http://localhost:3000/notifications \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Multi-channel Test",
       "message": "This notification will be sent via email and FCM",
       "type": "ANNOUNCEMENT",
       "recipientId": "user-id-here",
       "channels": ["EMAIL", "FCM"]
     }'
   ```

9. **Test notification channel**
   ```bash
   curl -X POST http://localhost:3000/notifications/channels/channel-id-here/test \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## 🗄️ Database Schema

### Users Table
- `id` - Unique identifier
- `email` - User email (unique)
- `name` - User's full name
- `role` - User role (STUDENT, TEACHER, ADMIN)
- `passwordHash` - Hashed password
- `emailEnabled` - Email notification preference
- `inAppEnabled` - In-app notification preference
- `createdAt` - Account creation timestamp
- `updatedAt` - Last update timestamp

### Notifications Table
- `id` - Unique identifier
- `title` - Notification title
- `message` - Notification content
- `type` - Notification type (ANNOUNCEMENT, ASSIGNMENT, GRADE, REMINDER, SYSTEM)
- `senderId` - ID of the user who sent the notification
- `recipientId` - ID of the user who receives the notification
- `status` - Notification status (PENDING, SENT, READ, FAILED)
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Notification Channels Table
- `id` - Unique identifier
- `userId` - ID of the user who owns the channel
- `type` - Channel type (EMAIL, FCM, WEBHOOK, SMS, SLACK, DISCORD, TELEGRAM)
- `value` - Channel value (email address, FCM token, webhook URL, etc.)
- `isActive` - Whether the channel is active
- `isVerified` - Whether the channel has been verified
- `metadata` - Additional channel-specific data
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Notification Deliveries Table
- `id` - Unique identifier
- `notificationId` - ID of the notification
- `channelId` - ID of the notification channel
- `status` - Delivery status (PENDING, SENT, DELIVERED, FAILED, RETRY)
- `sentAt` - When the notification was sent
- `deliveredAt` - When the notification was delivered
- `failedAt` - When the notification failed
- `errorMessage` - Error message if delivery failed
- `retryCount` - Number of retry attempts
- `metadata` - Additional delivery-specific data
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## 🔧 Development

### Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build the application
- `npm run start:prod` - Start production server
- `npm run test` - Run tests
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

### Health Monitoring

- `./scripts/health-check.sh` - Comprehensive health check script
- `./scripts/health-check.sh -u https://your-api.com` - Check remote API
- `./scripts/health-check.sh -t 60 -r 5` - Custom timeout and retries

### Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── jwt.strategy.ts
│   └── jwt-auth.guard.ts
├── users/               # Users module
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── notifications/       # Notifications module
│   ├── notifications.controller.ts
│   ├── notifications.service.ts
│   └── notifications.module.ts
├── health/             # Health check module
│   ├── health.controller.ts
│   └── health.module.ts
├── prisma/             # Database service
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── common/             # Shared DTOs and utilities
│   └── dto/
├── app.module.ts       # Main application module
└── main.ts            # Application entry point
```

## 🚀 Deployment

### Railway Deployment

1. **Create a Railway account** and install Railway CLI
2. **Initialize Railway project**
   ```bash
   railway login
   railway init
   ```
3. **Add PostgreSQL service** in Railway dashboard
4. **Set environment variables** in Railway dashboard
5. **Deploy**
   ```bash
   railway up
   ```

### Render Deployment

1. **Create a Render account**
2. **Connect your GitHub repository**
3. **Create a new Web Service**
4. **Configure environment variables**
5. **Deploy automatically on push**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues or have questions, please open an issue on GitHub. 