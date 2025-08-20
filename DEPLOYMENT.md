# Deployment Guide

This guide provides step-by-step instructions for deploying the Notification API to different platforms.

## 🚀 Quick Deployment Options

### Option 1: Railway (Recommended - Free Tier)

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy from GitHub**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will automatically detect it's a Node.js app

3. **Add PostgreSQL Database**
   - In your Railway project, click "New"
   - Select "Database" → "PostgreSQL"
   - Railway will provide a `DATABASE_URL`

4. **Set Environment Variables**
   - Go to your app's "Variables" tab
   - Add the following variables:
     ```
     DATABASE_URL=your_postgresql_url_from_railway
     JWT_SECRET=your-super-secret-jwt-key-here
     JWT_EXPIRES_IN=7d
     NODE_ENV=production
     PORT=3000
     ```

5. **Deploy**
   - Railway will automatically deploy on every push to main branch
   - Or manually trigger deployment from the dashboard

### Option 2: Render (Free Tier)

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Set build command: `npm install && npm run build`
   - Set start command: `npm run start:prod`

3. **Add PostgreSQL Database**
   - Create a new PostgreSQL service
   - Copy the connection string to your web service environment variables

4. **Set Environment Variables**
   ```
   DATABASE_URL=your_postgresql_connection_string
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=7d
   NODE_ENV=production
   ```

### Option 3: Heroku (Paid)

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Create Heroku App**
   ```bash
   heroku create your-app-name
   ```

3. **Add PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set JWT_SECRET=your-super-secret-jwt-key-here
   heroku config:set JWT_EXPIRES_IN=7d
   heroku config:set NODE_ENV=production
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

## 🐳 Docker Deployment

### Local Development with Docker

1. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Run Database Migrations**
   ```bash
   docker-compose exec app npm run db:push
   docker-compose exec app npm run db:seed
   ```

3. **Access the API**
   - API: http://localhost:3000
   - Swagger Docs: http://localhost:3000/api/docs
   - Health Check: http://localhost:3000/health

### Production Docker Deployment

1. **Build Docker Image**
   ```bash
   docker build -t notification-api .
   ```

2. **Run with Environment Variables**
   ```bash
   docker run -d \
     -p 3000:3000 \
     -e DATABASE_URL="your_database_url" \
     -e JWT_SECRET="your_jwt_secret" \
     -e JWT_EXPIRES_IN="7d" \
     -e NODE_ENV="production" \
     notification-api
   ```

## 🔧 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `JWT_SECRET` | Secret key for JWT tokens | Yes | - |
| `JWT_EXPIRES_IN` | JWT token expiration time | No | 7d |
| `PORT` | Application port | No | 3000 |
| `NODE_ENV` | Environment mode | No | development |

## 📊 Database Setup

### Automatic Setup (Recommended)

The application will automatically set up the database schema on first run:

```bash
npm run db:push
npm run db:seed
```

### Manual Setup

1. **Create Database**
   ```sql
   CREATE DATABASE notification_api;
   ```

2. **Run Migrations**
   ```bash
   npm run db:migrate
   ```

3. **Seed Data**
   ```bash
   npm run db:seed
   ```

## 🔍 Health Checks

All deployment platforms should use the health check endpoint:

- **URL**: `/health`
- **Method**: GET
- **Expected Response**: 200 OK with status information

## 📝 Post-Deployment Checklist

- [ ] Health check endpoint responds correctly
- [ ] Swagger documentation is accessible at `/api/docs`
- [ ] Database connection is working
- [ ] JWT authentication is functional
- [ ] Email notifications are being logged (check console)
- [ ] All API endpoints are responding
- [ ] CORS is configured correctly (if needed)

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `DATABASE_URL` format
   - Ensure database is accessible from deployment platform
   - Verify database credentials

2. **JWT Token Issues**
   - Ensure `JWT_SECRET` is set and secure
   - Check token expiration settings

3. **Build Failures**
   - Verify all dependencies are in `package.json`
   - Check Node.js version compatibility
   - Ensure TypeScript compilation succeeds

4. **Port Issues**
   - Most platforms use `PORT` environment variable
   - Ensure your app listens on the correct port

### Logs and Debugging

- **Railway**: View logs in the dashboard
- **Render**: Check logs in the service dashboard
- **Heroku**: Use `heroku logs --tail`
- **Docker**: Use `docker logs container_name`

## 🔒 Security Considerations

1. **Environment Variables**
   - Never commit `.env` files to version control
   - Use platform-specific secret management
   - Rotate JWT secrets regularly

2. **Database Security**
   - Use strong database passwords
   - Enable SSL connections when possible
   - Restrict database access to application only

3. **API Security**
   - Enable rate limiting in production
   - Use HTTPS in production
   - Implement proper CORS policies

## 📈 Monitoring

Consider adding monitoring for:
- Application performance
- Database connection health
- Error rates and logs
- API response times
- User authentication success rates 