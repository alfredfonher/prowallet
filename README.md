# ProWallet

A full-stack Solana token exchange platform with a Next.js frontend, Express API, and blockchain integration — built as a Turborepo monorepo.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 19, shadcn/ui |
| API | Express.js, Prisma ORM, PostgreSQL |
| Blockchain | Solana (Anchor, Web3.js, Wallet Adapter) |
| Monorepo | Turborepo + pnpm workspaces |
| Testing | Vitest |
| Deployment | Docker Compose |

## Quick Start

```bash
pnpm install
pnpm dev
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`

### Docker

```bash
cp .env.docker.example .env.docker
# edit .env.docker with your secrets
docker compose up --env-file .env.docker
```

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   Next.js Web       │     │   Express API       │
│   (port 3000)       │────▶│   (port 3001)       │
│   React 19 + shadcn │     │   Prisma + JWT      │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   PostgreSQL     │
                              └─────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   Solana RPC     │
                              │   (Helius)       │
                              └─────────────────┘
```

## Project Structure

```
prowallet/
├── apps/
│   ├── api/              # Express.js backend
│   └── web/              # Next.js frontend
├── packages/
│   ├── ui/               # Shared React components
│   ├── solana-utils/     # Blockchain utilities
│   ├── ts-sdk/           # TypeScript SDK
│   ├── eslint-config/    # Shared ESLint config
│   └── typescript-config/# Shared TS config
├── docker-compose.yml
└── turbo.json
```

## Commands

```bash
pnpm dev          # Start all services
pnpm build        # Production build
pnpm test         # Run all tests
pnpm lint         # Lint all packages
pnpm check-types  # Type check
```

Per-app commands:

```bash
pnpm --filter api dev     # API only
pnpm --filter web dev     # Web only
pnpm --filter api test    # API tests
pnpm --filter web test    # Web tests
```

## Contributing

- TypeScript strict mode, snake_case for identifiers
- Max 100 lines per function, 200 lines per file
- All user-facing messages in Spanish
- Run `pnpm lint && pnpm check-types && pnpm test` before committing

## License

MIT
