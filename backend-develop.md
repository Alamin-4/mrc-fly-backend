# 🎯 MRC Fly Backend - Master Blueprint (Antigravity Ready)

এই blueprint টা follow করে আপনি step-by-step আপনার backend develop করবেন। প্রতিটা step এ Antigravity AI কে prompt দিবেন।

---

## 📋 IMPLEMENTATION ORDER (এই sequence follow করবেন)

```
Phase 1: Foundation Setup
  ↓
Phase 2: Database & Prisma
  ↓
Phase 3: Core Auth System
  ↓
Phase 4: Security Features
  ↓
Phase 5: Feature Modules
  ↓
Phase 6: Testing & Deployment
```

---

## 🏗️ PHASE 1: Foundation Setup

### Step 1.1: Project Initialization

**Antigravity Prompt:**

```
Create a NestJS project structure with the following folders:
- src/common/ (decorators, filters, guards, interceptors, pipes, constants, interfaces, utils)
- src/config/ (database, jwt, mail, app configs)
- src/modules/ (auth, users, opportunities, roadmaps, services, blogs, payments, uploads)
- src/prisma/ (prisma service and module)

Create empty files for each folder with basic TypeScript setup.
```

**Files to Create:**

```
src/
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   ├── constants/
│   ├── interfaces/
│   └── utils/
├── config/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── opportunities/
│   ├── roadmaps/
│   ├── services/
│   ├── blogs/
│   ├── payments/
│   └── uploads/
└── prisma/
```

---

### Step 1.2: Environment Configuration

**Antigravity Prompt:**

```
Create a configuration module with:
1. src/config/app.config.ts - App settings (port, CORS origins)
2. src/config/database.config.ts - PostgreSQL connection
3. src/config/jwt.config.ts - JWT secrets and expiration
4. src/config/mail.config.ts - Email settings
5. Update src/app.module.ts to import ConfigModule.forRoot() with isGlobal: true
6. Create .env.example file with all required variables
```

**Environment Variables (.env):**

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/mrc_fly_db"

# JWT
JWT_ACCESS_SECRET="your_access_secret_key"
JWT_REFRESH_SECRET="your_refresh_secret_key"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Mail
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_USER="your_email@gmail.com"
MAIL_PASSWORD="your_app_password"

# App
PORT=3001
CORS_ORIGINS="http://localhost:3000"
```

---

### Step 1.3: Global Setup (main.ts)

**Antigravity Prompt:**

```
Update src/main.ts with:
1. Enable CORS with credentials
2. Add global ValidationPipe with whitelist, forbidNonWhitelisted, transform
3. Add global exception filter
4. Add global response interceptor
5. Set global prefix 'api'
6. Add Swagger documentation setup
```

---

## 🗄️ PHASE 2: Database & Prisma

### Step 2.1: Prisma Schema

**Antigravity Prompt:**

```
Create prisma/schema.prisma with these models:
1. User (with email, passwordHash, role, failedAttempts, lockedUntil)
2. Session (userId, token, ipAddress, userAgent, expiresAt)
3. RefreshToken (userId, token, familyId, isRevoked, expiresAt)
4. PasswordReset (userId, token, expiresAt, used)
5. EmailVerification (userId, token, expiresAt, used)
6. Opportunity (type: JOB/UNIVERSITY, title, companyName, location, etc.)
7. Application (userId, opportunityId, status, resumeUrl, coverLetter)
8. CountryRoadmap (roadmapName, title, slug, description, steps as JSON)
9. ServiceOrder (userId, serviceType, requestData as JSON, status)
10. BlogPost (title, slug, category, content, authorId)
11. CVTemplate (title, category, isFree, price, fileUrl)
12. PremiumGuide (title, slug, price, content)
13. Purchase (userId, productId, productType, amountPaid, paymentStatus)
14. DocumentRequest (fullName, email, documentType, fileUrl, status)
15. SiteStat (key, value, label, section)
16. Feature (title, description, redirectUrl, order)
17. Testimonial (customerName, serviceType, rating, review)
18. SuccessStory (personName, destination, videoUrl, description)
19. FAQ (question, answer, order)

Add proper relations, enums, and indexes.
```

### Step 2.2: Prisma Service

**Antigravity Prompt:**

```
Create src/prisma/prisma.service.ts:
- Extend PrismaClient
- Implement OnModuleInit
- Add $connect() in onModuleInit()
- Add onModuleDestroy() for cleanup

Create src/prisma/prisma.module.ts:
- Make it @Global()
- Export PrismaService
```

### Step 2.3: Database Migration

**Terminal Commands:**

```bash
pnpm exec prisma generate
pnpm exec prisma db push
```

---

## 🔐 PHASE 3: Core Auth System

### Step 3.1: Password Service

**Antigravity Prompt:**

```
Create src/modules/auth/application/services/password.service.ts:
- hash(password): bcrypt hash with 12 rounds
- compare(password, hash): bcrypt compare
- validateStrength(password): check min 8 chars, uppercase, lowercase, number, special char
```

### Step 3.2: Token Service

**Antigravity Prompt:**

```
Create src/modules/auth/application/services/token.service.ts:
- generateAccessToken(payload): JWT sign with 15m expiration
- generateRefreshToken(userId, familyId?): Generate random token, store in DB with 7d expiration
- validateRefreshToken(token): Check if valid, not revoked, not expired, then revoke it (rotation)
- generateSecureToken(): crypto.randomBytes(32).toString('hex')
```

### Step 3.3: Auth Service (Main Logic)

**Antigravity Prompt:**

```
Create src/modules/auth/application/services/auth.service.ts with these methods:

1. register(dto):
   - Check if email exists
   - Validate password strength
   - Hash password
   - Create user
   - Generate email verification token
   - Send verification email
   - Generate access + refresh tokens
   - Return user + tokens

2. login(dto, ipAddress?, userAgent?):
   - Find user by email
   - Check if account locked
   - Verify password
   - If invalid: increment failedAttempts, lock if >= 5 attempts
   - If valid: reset failedAttempts
   - Create session
   - Generate access + refresh tokens
   - Return user + tokens + sessionToken

3. refreshToken(oldRefreshToken):
   - Validate old token (with rotation)
   - Generate new access + refresh tokens
   - Return new tokens

4. logout(sessionToken):
   - Delete session from DB

5. forgotPassword(email):
   - Find user
   - Invalidate existing reset tokens
   - Generate new reset token (1h expiration)
   - Send reset email
   - Return generic message (don't reveal if email exists)

6. resetPassword(token, newPassword):
   - Validate reset token
   - Validate new password strength
   - Update password
   - Mark token as used
   - Revoke all refresh tokens
   - Return success message

7. verifyEmail(token):
   - Find verification record
   - Mark user as verified
   - Mark token as used
```

### Step 3.4: Auth DTOs

**Antigravity Prompt:**

```
Create DTOs with class-validator:

1. src/modules/auth/application/dto/register.dto.ts:
   - name: @IsString(), @IsNotEmpty()
   - email: @IsEmail()
   - password: @IsString(), @MinLength(8)
   - phone: @IsString(), @IsOptional()

2. src/modules/auth/application/dto/login.dto.ts:
   - email: @IsEmail()
   - password: @IsString()

3. src/modules/auth/application/dto/refresh-token.dto.ts:
   - refreshToken: @IsString()

4. src/modules/auth/application/dto/forgot-password.dto.ts:
   - email: @IsEmail()

5. src/modules/auth/application/dto/reset-password.dto.ts:
   - token: @IsString()
   - newPassword: @IsString(), @MinLength(8)
```

### Step 3.5: JWT Strategy

**Antigravity Prompt:**

```
Create src/modules/auth/infrastructure/strategies/jwt.strategy.ts:
- Extend PassportStrategy(Strategy, 'jwt')
- Extract JWT from Authorization header
- Validate payload: check if user exists, not locked
- Return user object

Create src/modules/auth/infrastructure/strategies/refresh-token.strategy.ts:
- Similar to JWT but for refresh tokens
- Extract from cookie or body
```

### Step 3.6: Auth Guards

**Antigravity Prompt:**

```
Create guards:

1. src/modules/auth/infrastructure/guards/jwt-auth.guard.ts:
   - Extend AuthGuard('jwt')

2. src/modules/auth/infrastructure/guards/refresh-token.guard.ts:
   - Extend AuthGuard('refresh-token')

3. src/common/guards/roles.guard.ts:
   - Check if user role matches required roles
   - Use Reflector to get roles metadata

4. src/common/guards/throttler.guard.ts:
   - Rate limiting guard
```

### Step 3.7: Auth Decorators

**Antigravity Prompt:**

```
Create decorators:

1. src/common/decorators/current-user.decorator.ts:
   - Extract user from request
   - Support property access: @CurrentUser('id')

2. src/common/decorators/roles.decorator.ts:
   - Set roles metadata: @Roles('ADMIN', 'USER')

3. src/common/decorators/public.decorator.ts:
   - Mark route as public (skip auth)

4. src/common/decorators/ip.decorator.ts:
   - Extract IP address from request

5. src/common/decorators/user-agent.decorator.ts:
   - Extract user agent from request
```

### Step 3.8: Auth Controller

**Antigravity Prompt:**

```
Create src/modules/auth/presentation/auth.controller.ts:

Routes:
- POST /auth/register - Public
- POST /auth/login - Public, use @Ip() and @UserAgent()
- POST /auth/refresh - Public
- POST /auth/logout - Protected (JWT)
- POST /auth/forgot-password - Public
- POST /auth/reset-password - Public
- POST /auth/verify-email - Public
- GET /auth/me - Protected (JWT), return current user

Use appropriate guards and decorators.
```

### Step 3.9: Auth Module

**Antigravity Prompt:**

```
Create src/modules/auth/auth.module.ts:
- Import JwtModule.registerAsync()
- Import PassportModule
- Import PrismaModule
- Import MailModule (we'll create this)
- Register all services, strategies, guards
- Export AuthService
```

---

## 🛡️ PHASE 4: Security Features

### Step 4.1: Mail Service

**Antigravity Prompt:**

```
Create src/modules/mail/mail.service.ts:
- Use @nestjs-modules/mailer or nodemailer
- sendVerificationEmail(email, token)
- sendPasswordResetEmail(email, token)
- sendWelcomeEmail(email, name)

Create email templates in src/modules/mail/templates/
```

### Step 4.2: Rate Limiting

**Antigravity Prompt:**

```
Install @nestjs/throttler
Configure in app.module.ts:
- 10 requests per minute for auth routes
- 100 requests per minute for other routes
```

### Step 4.3: Global Exception Filter

**Antigravity Prompt:**

```
Create src/common/filters/http-exception.filter.ts:
- Catch all exceptions
- Format error response consistently
- Log errors
- Return: { success: false, error: { code, message, details } }
```

### Step 4.4: Response Interceptor

**Antigravity Prompt:**

```
Create src/common/interceptors/transform.interceptor.ts:
- Wrap all responses in: { success: true, data: ..., meta: ... }
- Add timestamp
- Add request ID
```

---

## 📦 PHASE 5: Feature Modules

### Step 5.1: Users Module

**Antigravity Prompt:**

```
Create src/modules/users/ with:
- GET /users/me - Get current user profile
- PATCH /users/me - Update profile
- POST /users/change-password - Change password
- GET /users/sessions - List active sessions
- DELETE /users/sessions/:id - Revoke session
```

### Step 5.2: Opportunities Module

**Antigravity Prompt:**

```
Create src/modules/opportunities/ with:
- GET /opportunities - List all (filter by type: JOB/UNIVERSITY)
- GET /opportunities/:id - Get details
- POST /opportunities - Admin only
- PATCH /opportunities/:id - Admin only
- DELETE /opportunities/:id - Admin only

Create DTOs for create/update with validation.
```

### Step 5.3: Roadmaps Module

**Antigravity Prompt:**

```
Create src/modules/roadmaps/ with:
- GET /roadmaps - List all countries
- GET /roadmaps/:slug - Get roadmap with steps (JSON)
- POST /roadmaps - Admin only
- PATCH /roadmaps/:id - Admin only

Handle complex JSON structure for steps.
```

### Step 5.4: Services Module

**Antigravity Prompt:**

```
Create src/modules/services/ with:
- POST /service-orders - Create service request
- GET /service-orders - List user's orders (protected)
- GET /service-orders/:id - Get order details
- PATCH /service-orders/:id/status - Admin updates status

Handle JSON requestData for different service types.
```

### Step 5.5: Blogs Module

**Antigravity Prompt:**

```
Create src/modules/blogs/ with:
- GET /blogs - List published blogs (filter by category)
- GET /blogs/:slug - Get blog details
- POST /blogs - Admin only
- PATCH /blogs/:id - Admin only
- DELETE /blogs/:id - Admin only

Sanitize HTML content to prevent XSS.
```

### Step 5.6: Payments Module

**Antigravity Prompt:**

```
Create src/modules/payments/ with:
- POST /payments/create-session - Create payment session (Stripe/SSLCommerz)
- POST /payments/webhook - Handle payment webhooks
- GET /payments/purchases - List user's purchases

Handle CV template and premium guide purchases.
```

### Step 5.7: Uploads Module

**Antigravity Prompt:**

```
Create src/modules/uploads/ with:
- POST /uploads/document - Upload CV/document
- Use multer for file handling
- Upload to Vercel Blob or AWS S3
- Validate file type and size
- Return file URL
```

---

## 🧪 PHASE 6: Testing & Deployment

### Step 6.1: Unit Tests

**Antigravity Prompt:**

```
Create unit tests for:
- AuthService (register, login, password reset)
- PasswordService (hash, compare, validate)
- TokenService (generate, validate, rotate)

Use Jest mocking for Prisma and external services.
```

### Step 6.2: Integration Tests

**Antigravity Prompt:**

```
Create integration tests for:
- Auth endpoints (register, login, refresh)
- Protected routes (with JWT)
- Role-based access (Admin vs User)

Use test database and cleanup after each test.
```

### Step 6.3: Docker Setup

**Antigravity Prompt:**

```
Create:
1. Dockerfile for NestJS app
2. docker-compose.yml with:
   - App service
   - PostgreSQL service
   - Redis service (for caching/rate limiting)
3. .dockerignore file
```

### Step 6.4: Deployment

**Deployment Checklist:**

```
□ Set production environment variables
□ Run database migrations
□ Build production bundle: pnpm build
□ Test production build locally
□ Deploy to Railway/Render/AWS
□ Set up monitoring (Sentry)
□ Configure logging
□ Set up backups
```

---

## 🎯 QUICK START COMMANDS

```bash
# 1. Start development
pnpm run start:dev

# 2. Generate Prisma Client
pnpm exec prisma generate

# 3. Push schema to database
pnpm exec prisma db push

# 4. Open Prisma Studio (visual DB editor)
pnpm exec prisma studio

# 5. Run tests
pnpm test

# 6. Build for production
pnpm build

# 7. Run production
pnpm run start:prod
```

---

## 📝 ANTIGRAVITY USAGE TIPS

1. **Be Specific:** Tell Antigravity exactly which files to create/modify
2. **Provide Context:** Share your schema, existing code structure
3. **One Step at a Time:** Don't ask for everything at once
4. **Review Code:** Always review generated code before committing
5. **Test Immediately:** After each step, test the functionality

---

## ✅ CHECKLIST BEFORE MOVING TO NEXT PHASE

**Phase 1 Complete When:**

- [ ] All folders created
- [ ] Config module working
- [ ] main.ts configured
- [ ] App starts without errors

**Phase 2 Complete When:**

- [ ] Prisma schema created
- [ ] Database connected
- [ ] All tables created
- [ ] Prisma Studio shows tables

**Phase 3 Complete When:**

- [ ] Register endpoint works
- [ ] Login endpoint works
- [ ] JWT tokens generated
- [ ] Protected routes work
- [ ] Refresh token rotation works

**Phase 4 Complete When:**

- [ ] Emails sending
- [ ] Rate limiting active
- [ ] Error responses consistent
- [ ] Response format standardized

---

এই blueprint follow করে আপনি step-by-step আপনার backend develop করবেন। প্রতিটা phase complete হলে test করবেন, তারপর পরের phase এ যাবেন।

কোন phase থেকে শুরু করতে চান বলুন, আমি আপনাকে সেই phase এর detailed code লিখে দেব! 🚀
