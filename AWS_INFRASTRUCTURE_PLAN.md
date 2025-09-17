# AWS Infrastructure Plan for Tabletop Army Manager Web App

## Cost-Optimized Architecture

### Core Services (Minimal Cost Setup)

#### 1. **Frontend Hosting**
- **Service**: S3 + CloudFront
- **Purpose**: Static React app hosting with global CDN
- **Cost**: ~$1-3/month
  - S3 storage: $0.023/GB
  - CloudFront: $0.085/GB for first 10TB

#### 2. **Backend API**
- **Service**: AWS Lambda + API Gateway
- **Purpose**: Serverless backend for army management and combat calculations
- **Cost**: ~$0-5/month (with free tier)
  - Lambda: 1M free requests/month, then $0.20 per 1M requests
  - API Gateway: 1M free requests/month, then $3.50 per 1M requests

#### 3. **Real-time Communication**
- **Service**: API Gateway WebSocket
- **Purpose**: Live collaboration between players
- **Cost**: ~$1-3/month
  - WebSocket connections: $0.25 per 1M connection minutes
  - Messages: $1.00 per 1M messages

#### 4. **Database**
- **Service**: DynamoDB
- **Purpose**: Store army data, game sessions, user preferences
- **Cost**: ~$0-2/month
  - 25GB free storage
  - 25 read/write capacity units free

#### 5. **Authentication** (Optional)
- **Service**: AWS Cognito
- **Purpose**: User accounts and session management
- **Cost**: ~$0/month
  - 50,000 MAU free tier

#### 6. **File Storage**
- **Service**: S3 (separate bucket)
- **Purpose**: User-uploaded army files, game logs
- **Cost**: ~$0.50/month
  - $0.023/GB storage

## Alternative Budget Architecture

### **Ultra-Low Cost Option** (~$2-5/month)
```
Frontend: Netlify/Vercel (Free tier)
Backend: Railway/Render (Free tier + $5/month)
Database: PlanetScale (Free tier)
Real-time: Socket.io on backend server
```

### **Scalable AWS Option** (~$5-15/month)
```
Frontend: S3 + CloudFront
Backend: ECS Fargate (1 small instance)
Database: RDS PostgreSQL (t3.micro)
Real-time: ElastiCache Redis + WebSocket API
```

## Cost Estimates for Weekly Game Sessions

### **Scenario**: 2-4 players, 3-hour sessions weekly

#### **Minimal AWS Setup** (~$3-8/month)
- **S3 + CloudFront**: $2/month
- **Lambda + API Gateway**: $1/month (well within free tier)
- **WebSocket API**: $2/month (3 hours × 4 weeks × 4 players)
- **DynamoDB**: $1/month
- **Domain + SSL**: $12/year (~$1/month)

#### **Usage Breakdown**:
- **API Calls**: ~1,000 per session (loading armies, combat calculations)
- **WebSocket Messages**: ~500 per hour per player (unit selections, dice rolls)
- **Data Storage**: <1GB (army files, session history)
- **Bandwidth**: <10GB/month (minimal for turn-based game)

#### **Annual Cost**: $36-96/year ($3-8/month)

## Recommended Minimal Viable Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   API Gateway    │    │   DynamoDB      │
│   (Frontend)    │───▶│   + Lambda       │───▶│   (Game Data)   │
│   $2/month      │    │   $1/month       │    │   $1/month      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  WebSocket API   │
                       │  (Real-time)     │
                       │  $2/month        │
                       └──────────────────┘
```

**Total: ~$6/month for reliable, scalable infrastructure**

## Implementation Phases

### **Phase 1: MVP** ($3-5/month)
- Static frontend on S3
- Lambda functions for core features
- DynamoDB for basic data storage
- Simple WebSocket for real-time updates

### **Phase 2: Enhanced** ($6-10/month)
- CloudFront CDN
- User authentication
- Advanced real-time features
- Monitoring and logging

### **Phase 3: Production** ($10-20/month)
- Multiple environments (dev/staging/prod)
- Backup and disaster recovery
- Enhanced monitoring
- Custom domain with SSL

## Cost Optimization Strategies

1. **Use Free Tiers**: AWS provides generous free tiers for most services
2. **Serverless First**: Lambda scales to zero when not in use
3. **Efficient Data Models**: Minimize DynamoDB read/write operations
4. **CDN Caching**: Reduce origin requests with proper caching headers
5. **Connection Pooling**: Reuse WebSocket connections efficiently

## Monitoring and Alerts

- **CloudWatch**: Free basic monitoring
- **Cost Alerts**: Set billing alerts at $5, $10, $20 thresholds
- **Usage Tracking**: Monitor API calls and storage growth

This architecture can easily handle 10-20 concurrent players with room for growth, while keeping costs under $10/month for typical usage patterns.
