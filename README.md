# 🎯 ProWallet - Solana Token Exchange Platform

A full-stack token exchange platform built on Solana with Next.js frontend and Express API, powered by Turborepo monorepo architecture.

## 🚀 Quick Start

### Development Mode (Local)

```bash
# Install dependencies
pnpm install

# Start all services (API + Web)
npm run dev

# The apps will be available at:
# - Frontend: http://localhost:3000
# - API: http://localhost:3001
```

### Production Mode (Docker)

```bash
# 1. Create environment file
cp .env.docker.example .env.docker

# 2. Edit .env.docker with your secrets
nano .env.docker

# 3. Start with Docker Compose
docker-compose up --env-file .env.docker

# OR use the helper script
./docker-setup.sh up
```

## 📋 Project Structure

This is a **Turborepo monorepo** with the following structure:

```
prowallet/
├── apps/
│   ├── api/          # Express.js backend API (Solana integration)
│   └── web/          # Next.js frontend (React + Wallet integration)
├── packages/
│   ├── eslint-config/
│   ├── typescript-config/
│   ├── ui/           # Shared UI components
│   ├── solana-utils/ # Solana blockchain utilities
│   └── ts-sdk/       # TypeScript SDK
├── DOCKER_SETUP.md   # Docker deployment guide
└── AGENTS.md         # Development guidelines
```

## 🛠️ Development Commands

### Build

```bash
npm run build          # Build all apps for production
npm run build:api      # Build only API
npm run build:web      # Build only Web
```

### Development

```bash
npm run dev            # Start all services in dev mode
npm run dev:api        # Start only API
npm run dev:web        # Start only Web
```

### Testing

```bash
npm run test           # Run all tests
npm run test:api       # Run API tests (Vitest)
npm run test:web       # Run Web tests (Vitest)
```

### Linting & Formatting

```bash
npm run lint           # Run ESLint on all packages
npm run format         # Format code with Prettier
npm run check-types    # Full TypeScript type checking
```

## 🐳 Docker Deployment

### Quick Start with Docker

```bash
# Using the helper script (recommended)
./docker-setup.sh up-d    # Start in background
./docker-setup.sh logs    # View logs
./docker-setup.sh down    # Stop services

# Or use docker-compose directly
docker-compose up --env-file .env.docker
```

### Important: Environment Variables

**CRITICAL**: Always use the `--env-file` flag:

```bash
# ✅ CORRECT
docker-compose up --env-file .env.docker

# ❌ WRONG - will fail with DATABASE_URL errors
docker-compose up
```

See **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** for complete Docker configuration guide.

## 🏗️ Architecture

### Backend (API)

- **Framework**: Express.js
- **Database**: PostgreSQL (Prisma ORM)
- **Blockchain**: Solana (via Anchor/Web3.js)
- **Testing**: Vitest
- **Validation**: express-validator

### Frontend (Web)

- **Framework**: Next.js 14 (App Router)
- **UI**: React 19 + Shadcn UI
- **State**: React Context + Custom Hooks
- **Wallet**: Solana Wallet Adapter
- **Testing**: Vitest + React Testing Library

### Shared Packages

- `ui` - Reusable React components
- `solana-utils` - Blockchain utility functions
- `ts-sdk` - TypeScript SDK for API integration
- `eslint-config` - Shared ESLint configuration
- `typescript-config` - Shared TypeScript configuration

## 🔐 Environment Variables

### Required for Docker

See `.env.docker.example` for a complete list. Key variables:

**Database**

```
DATABASE_URL=postgresql://user:password@postgres:5432/prowallet
```

**Solana Network**

```
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

**Helius API**

```
HELIUS_API_KEY=YOUR_API_KEY
```

**Wallet & Auth**

```
TREASURY_PRIVATE_KEY=YOUR_PRIVATE_KEY
JWT_SECRET=YOUR_SECRET
```

## 📚 Documentation

- **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** - Docker deployment and configuration
- **[AGENTS.md](./AGENTS.md)** - Development guidelines and best practices
- **[README_MIGRACION.md](./README_MIGRACION.md)** - Database migration guide

## 🧪 Testing

### API Tests

```bash
cd apps/api
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- path/to/test   # Specific test file
```

### Web Tests

```bash
cd apps/web
npm test
npm test -- --watch
```

## 🚢 Deployment

### Production Build

```bash
# Build everything
npm run build

# Build specific app
npm run build:api
npm run build:web
```

### Docker Production

```bash
# Build and push to registry
docker build -f apps/api/Dockerfile.api -t your-registry/prowallet-api:latest .
docker build -f apps/web/Dockerfile.web -t your-registry/prowallet-web:latest .

# Deploy with production env file
docker-compose -f docker-compose.yaml up --env-file .env.docker
```

## 🤝 Contributing

### Code Style

- **Language**: TypeScript (strict mode)
- **Linter**: ESLint
- **Formatter**: Prettier
- **Naming**: snake_case for all identifiers
- **Pattern**: Separation of concerns, 200 lines max per file

### Before Committing

```bash
# Run checks
npm run lint
npm run format
npm run check-types
npm run test
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test
npm run test

# Commit with conventional message
git commit -m "feat: add new feature"
git push origin feature/my-feature

# Create pull request
```

## 🐛 Troubleshooting

### Docker Issues

**Error: `DATABASE_URL resolved to an empty string`**

```bash
# Solution: Always use --env-file flag
docker-compose up --env-file .env.docker
```

**Error: PostgreSQL connection refused**

```bash
# Solution: Wait for PostgreSQL to be ready
docker-compose logs postgres
docker-compose ps
```

### Development Issues

**Port already in use**

```bash
# Kill process on port 3000 (web) or 3001 (api)
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

**TypeScript errors**

```bash
# Check all types
npm run check-types

# Fix formatting
npm run format
```

## 📞 Support

For issues or questions:

1. Check existing documentation in [DOCKER_SETUP.md](./DOCKER_SETUP.md) and [AGENTS.md](./AGENTS.md)
2. Review the troubleshooting section above
3. Check API logs: `docker-compose logs api`
4. Check Web logs: `docker-compose logs web`

## 📄 License

© 2025 ProWallet. All rights reserved.
