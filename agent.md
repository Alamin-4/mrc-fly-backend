mrc-backend/
├── src/
│ ├── common/ # 🧰 Shared Utilities
│ │ ├── decorators/
│ │ │ ├── current-user.decorator.ts
│ │ │ ├── roles.decorator.ts
│ │ │ └── public.decorator.ts # @Public() route skip auth
│ │ │
│ │ ├── filters/
│ │ │ └── http-exception.filter.ts # Global error handler
│ │ │
│ │ ├── guards/
│ │ │ ├── jwt-auth.guard.ts
│ │ │ └── roles.guard.ts
│ │ │
│ │ ├── interceptors/
│ │ │ ├── transform.interceptor.ts # Response wrapper
│ │ │ └── logging.interceptor.ts
│ │ │
│ │ ├── pipes/
│ │ │ └── parse-file.pipe.ts
│ │ │
│ │ ├── constants/
│ │ │ ├── roles.constant.ts
│ │ │ └── error-messages.constant.ts
│ │ │
│ │ ├── interfaces/
│ │ │ ├── user-payload.interface.ts
│ │ │ └── jwt-payload.interface.ts
│ │ │
│ │ └── utils/
│ │ ├── hash.util.ts # bcrypt wrapper
│ │ ├── token.util.ts # JWT wrapper
│ │ └── date.util.ts
│ │
│ ├── config/ # ⚙️ Configuration
│ │ ├── config.module.ts
│ │ ├── database.config.ts
│ │ ├── jwt.config.ts
│ │ ├── mail.config.ts
│ │ └── app.config.ts
│ │
│ ├── modules/ # 📦 Feature Modules
│ │ │
│ │ ├── auth/ # 🔐 Custom Auth System
│ │ │ ├── domain/ # Domain Layer
│ │ │ │ ├── entities/
│ │ │ │ │ └── user.entity.ts
│ │ │ │ └── interfaces/
│ │ │ │ ├── auth-service.interface.ts
│ │ │ │ └── token-service.interface.ts
│ │ │ │
│ │ │ ├── application/ # Application Layer
│ │ │ │ ├── services/
│ │ │ │ │ ├── auth.service.ts
│ │ │ │ │ ├── token.service.ts
│ │ │ │ │ ├── password.service.ts
│ │ │ │ │ └── session.service.ts
│ │ │ │ └── dto/
│ │ │ │ ├── register.dto.ts
│ │ │ │ ├── login.dto.ts
│ │ │ │ ├── refresh-token.dto.ts
│ │ │ │ └── forgot-password.dto.ts
│ │ │ │
│ │ │ ├── infrastructure/ # Infrastructure Layer
│ │ │ │ ├── strategies/
│ │ │ │ │ ├── jwt.strategy.ts
│ │ │ │ │ ├── refresh-token.strategy.ts
│ │ │ │ │ └── local.strategy.ts
│ │ │ │ ├── repositories/
│ │ │ │ │ └── user.repository.ts
│ │ │ │ └── guards/
│ │ │ │ ├── jwt-auth.guard.ts
│ │ │ │ └── refresh-token.guard.ts
│ │ │ │
│ │ │ ├── presentation/ # Presentation Layer
│ │ │ │ ├── auth.controller.ts
│ │ │ │ └── responses/
│ │ │ │ └── auth-response.dto.ts
│ │ │ │
│ │ │ └── auth.module.ts
│ │ │
│ │ ├── users/ # 👤 User Management
│ │ │ ├── domain/
│ │ │ ├── application/
│ │ │ ├── infrastructure/
│ │ │ └── presentation/
│ │ │
│ │ ├── opportunities/ # 💼 Jobs & Universities
│ │ ├── roadmaps/ # 🗺️ Country Roadmaps
│ │ ├── services/ # 🛠️ Service Orders
│ │ ├── blogs/ # 📝 Blog Posts
│ │ ├── payments/ # 💳 Payment Gateway
│ │ ├── uploads/ # 📤 File Uploads
│ │ └── analytics/ # 📊 BCC Email Tracking
│ │
│ ├── prisma/ # 🔗 Database Layer
│ │ ├── prisma.module.ts
│ │ ├── prisma.service.ts
│ │ └── repositories/ # Repository Pattern
│ │ └── base.repository.ts
│ │
│ ├── app.module.ts
│ └── main.ts
│
├── prisma/
│ ├── schema.prisma
│ ├── migrations/
│ └── seed.ts
│
├── test/ # 🧪 Testing
│ ├── unit/
│ ├── integration/
│ └── e2e/
│
├── docker/
│ ├── Dockerfile
│ └── docker-compose.yml
│
├── .env
├── .env.example
└── package.json
