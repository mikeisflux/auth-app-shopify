# Deployment Guide - Collectible Tracker

This guide walks you through deploying your Shopify app to production.

## Pre-Deployment Checklist

- [ ] All development and testing completed
- [ ] Database schema finalized
- [ ] Privacy Policy and Terms of Service updated with your information
- [ ] Environment variables documented
- [ ] Backup and disaster recovery plan in place
- [ ] Monitoring and logging configured

## Deployment Options

### Option 1: AWS (Recommended)

#### Step 1: Set Up AWS Services

**1. RDS PostgreSQL (Production Database)**
```bash
# Create production RDS instance
- Instance type: db.t3.small or larger
- Multi-AZ deployment: Yes (for high availability)
- Automated backups: Enabled (7-30 days retention)
- Encryption at rest: Enabled
- Public accessibility: No
- VPC Security Group: Configure to allow only your app server
```

**2. EC2 or ECS (Application Server)**

**Using EC2:**
```bash
# Launch EC2 instance
- Instance type: t3.medium or larger
- AMI: Amazon Linux 2 or Ubuntu 20.04
- Security group: Allow HTTPS (443), HTTP (80), SSH (22)

# Connect and setup
ssh -i your-key.pem ec2-user@your-instance-ip

# Install Node.js
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Clone your repository
git clone your-repo-url
cd collectible-tracker
npm install

# Set up environment variables
sudo nano /etc/environment
# Add your production environment variables

# Start the app with PM2
pm2 start npm --name "collectible-tracker" -- start
pm2 startup
pm2 save
```

**Using ECS (Docker):**
```dockerfile
# Create Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**3. Set Up Load Balancer**
```bash
# Create Application Load Balancer
- Target type: Instance or IP
- Health check path: /healthcheck
- SSL certificate: Use AWS Certificate Manager
```

**4. Configure Domain and SSL**
```bash
# Route 53
- Create hosted zone for your domain
- Point domain to Load Balancer

# ACM (Certificate Manager)
- Request SSL certificate
- Validate domain ownership
- Attach to Load Balancer
```

#### Step 2: Database Migration

```bash
# Connect to production database
DATABASE_URL=postgresql://user:pass@prod-rds.amazonaws.com:5432/db

# Run migration
npm run db:migrate
```

#### Step 3: Environment Variables

Set all production environment variables:

```bash
# Application
SHOPIFY_API_KEY=your_production_key
SHOPIFY_API_SECRET=your_production_secret
HOST=https://your-app-domain.com
SHOPIFY_APP_URL=https://your-app-domain.com

# Database
AWS_DB_HOST=your-prod-rds.endpoint.rds.amazonaws.com
AWS_DB_PORT=5432
AWS_DB_NAME=collectibles_prod
AWS_DB_USER=admin
AWS_DB_PASSWORD=secure_password

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Security
SESSION_SECRET=generate_secure_random_string
NODE_ENV=production
```

#### Step 4: Shopify App Configuration

Update in Shopify Partner Dashboard:

1. **App URL:** `https://your-app-domain.com`
2. **Allowed redirection URLs:**
   ```
   https://your-app-domain.com/auth/callback
   https://your-app-domain.com/auth/shopify/callback
   https://your-app-domain.com/api/auth/callback
   ```
3. **App proxy:**
   - Subpath: `collectibles`
   - Proxy URL: `https://your-app-domain.com`
4. **GDPR webhooks:** (automatic with your webhook handlers)

### Option 2: Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Set environment variables
heroku config:set SHOPIFY_API_KEY=your_key
heroku config:set SHOPIFY_API_SECRET=your_secret
heroku config:set HOST=https://your-app-name.herokuapp.com
# ... set all other env vars

# Deploy
git push heroku main

# Run migrations
heroku run npm run db:migrate

# Scale dyno
heroku ps:scale web=1
```

### Option 3: Vercel/Netlify

Note: These platforms are optimized for static/serverless apps. For this full-stack app with database, AWS or Heroku are better choices.

## Post-Deployment

### 1. Verify Deployment

```bash
# Check app is running
curl https://your-app-domain.com

# Test database connection
# Monitor logs for any errors

# Install on test store
# Complete full user flow
```

### 2. Set Up Monitoring

**CloudWatch (AWS):**
```bash
# Set up CloudWatch alarms for:
- CPU utilization > 80%
- Memory utilization > 80%
- Database connections > 80%
- Application errors
- API response time > 1s
```

**Application Monitoring:**
```bash
# Install monitoring tools
npm install @sentry/node @sentry/remix

# Configure in your app
import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
  tracesSampleRate: 1.0,
});
```

### 3. Set Up Logging

```javascript
// Use Winston or similar
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

### 4. Configure Backups

**Database Backups:**
```bash
# AWS RDS automatic backups (already enabled)
# Manual backup schedule:
0 2 * * * pg_dump -h your-rds-endpoint -U user -d db > backup_$(date +\%Y\%m\%d).sql
```

**Application Backups:**
```bash
# Store in S3
aws s3 sync /app/backups s3://your-backup-bucket/
```

### 5. Set Up CI/CD

**.github/workflows/deploy.yml:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Deploy to production
        run: |
          # Your deployment commands
          ssh user@server 'cd /app && git pull && npm install && pm2 restart all'
        env:
          SSH_KEY: ${{ secrets.SSH_KEY }}
```

## Security Hardening

### 1. Firewall Rules

```bash
# Only allow necessary ports
- Port 443 (HTTPS) - open to internet
- Port 80 (HTTP) - redirect to 443
- Port 22 (SSH) - your IP only
- Database port - app server only
```

### 2. Environment Security

```bash
# Never commit .env files
# Use secret management services
- AWS Secrets Manager
- HashiCorp Vault
- Environment variables in hosting platform
```

### 3. Rate Limiting

```javascript
// Add rate limiting to verify endpoint
import rateLimit from 'express-rate-limit';

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many verification attempts, please try again later.'
});

app.post('/apps/collectibles/verify', verifyLimiter, handler);
```

### 4. HTTPS Enforcement

```javascript
// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

## Performance Optimization

### 1. Database Indexing

Already included in schema.sql, but verify:
```sql
-- Check existing indexes
SELECT * FROM pg_indexes WHERE schemaname = 'public';
```

### 2. Caching

```javascript
// Add Redis for session caching
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache frequently accessed data
async function getCategoryWithCache(categoryId) {
  const cacheKey = `category:${categoryId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const category = await CategoryModel.findById(categoryId);
  await redis.setex(cacheKey, 3600, JSON.stringify(category));
  
  return category;
}
```

### 3. CDN Configuration

```bash
# Use CloudFront for static assets
- Create CloudFront distribution
- Point to your S3 bucket or app server
- Configure caching rules
- Update image URLs to use CDN
```

## Maintenance

### Regular Tasks

**Daily:**
- Monitor error logs
- Check application performance metrics
- Review verification activity

**Weekly:**
- Review database performance
- Check backup integrity
- Update dependencies (security patches)

**Monthly:**
- Full security audit
- Performance optimization review
- Cost optimization review
- Database maintenance (VACUUM, ANALYZE)

### Updating the App

```bash
# Create staging environment first
# Test all changes thoroughly
# Deploy during low-traffic periods

# Deployment steps:
1. Git pull latest changes
2. npm install (for new dependencies)
3. Run database migrations (if any)
4. Restart application
5. Monitor for errors
6. Rollback if issues detected
```

## Troubleshooting Production Issues

### Common Issues

**High CPU Usage:**
```bash
# Check running processes
pm2 list
pm2 monit

# Optimize database queries
# Add caching layer
# Scale horizontally (multiple instances)
```

**Database Connection Errors:**
```bash
# Check connection pool settings
# Verify security group rules
# Check RDS instance status
# Review connection limits
```

**Slow Response Times:**
```bash
# Enable query logging
# Identify slow queries
# Add appropriate indexes
# Implement caching
```

## Rollback Procedure

If deployment fails:

```bash
# Revert to previous version
git revert HEAD
git push

# Or rollback to specific commit
git reset --hard <previous-commit-hash>
git push --force

# Restore database if needed
pg_restore -h your-rds-endpoint -U user -d db backup_file.sql
```

## Support and Monitoring

**Set up alerts for:**
- Application errors (> 10/min)
- API response time (> 2s)
- Database connection failures
- Disk space (> 80%)
- Memory usage (> 80%)
- SSL certificate expiration (30 days before)

**Monitoring Dashboard:**
- AWS CloudWatch
- Grafana + Prometheus
- New Relic or Datadog
- Uptime monitoring (Pingdom, UptimeRobot)

---

## Final Production Checklist

- [ ] SSL certificate installed and valid
- [ ] All environment variables set
- [ ] Database migrated successfully
- [ ] Webhooks registered and tested
- [ ] App proxy configured
- [ ] Privacy policy and terms accessible
- [ ] Monitoring and alerts configured
- [ ] Backups automated
- [ ] Error logging functional
- [ ] Performance tested under load
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Support email configured
- [ ] Billing webhooks tested

**Your app is ready for production! 🚀**