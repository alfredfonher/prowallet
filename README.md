# ProWallet

ProWallet is an experimental Solana wallet and token-purchase platform. The repository combines a Next.js web application, an Express API, PostgreSQL/Prisma persistence, Redis-backed services, and Solana transaction integrations in a pnpm/Turborepo monorepo.

> **Safety status:** this codebase is an MVP under active development, not a production-ready custody or payment system. Some paths use mocks, fallback values, optional infrastructure, or incomplete integrations. Review authentication, key management, payment, database, and transaction code before any real deployment.
>
> **Mainnet warning:** files under `apps/api/scripts/` can sign and submit Solana transactions. In particular, `real-purchase.js`, `debug-send-tx.js`, and `setup-test-wallets.ts` require explicit human review before use. Never run transaction-capable scripts casually, point them at mainnet without verification, or provide production credentials to an unreviewed command.

## Capabilities

- Email/password authentication with access and refresh tokens.
- Solana wallet registration, token purchase, transfer, and transaction flows.
- Configurable Solana network, RPC, program, mint, treasury, and authority settings.
- Optional Stripe, CoinGate, NOWPayments, email, webhook, and Redis integrations.
- PostgreSQL models through Prisma, plus older database paths that still reference `MONGODB_URI`.
- Next.js dashboard and wallet UI with Socket.IO-backed updates.

These capabilities describe code present in the repository. They are not a guarantee that every integration is complete, tested end to end, or safe for production funds.

## Stack

Versions below come from the current package manifests.

| Area | Technology |
| --- | --- |
| Workspace | pnpm 10.24.0, Turborepo 2.6.x, Node.js 18 or newer |
| Web | Next.js 16.0.3, React 19.2.0, TypeScript 5.x, Tailwind CSS 4.1.x, Zustand |
| API | Express 5.1.x, TypeScript 5.9.x, Prisma 5.22.x, PostgreSQL, Redis 4.7.x, Socket.IO 4.8.x |
| Solana | `@solana/web3.js` 1.98.x, SPL Token 0.4.x, Anchor 0.31.x |
| Validation and tests | ESLint 9.39.x, Vitest 1.x, Zod, Joi, Supertest |

## Monorepo

| Path | Package name | Responsibility |
| --- | --- | --- |
| `apps/api` | `prowallet-api` | Express API, Prisma models, authentication, payments, Solana services, workers, and scripts |
| `apps/web` | `exchange-web-ui` | Next.js App Router web client |
| `packages/ui` | `@repo/ui` | Shared React UI exports |
| `packages/eslint-config` | `@repo/eslint-config` | Shared ESLint configuration |
| `packages/typescript-config` | `@repo/typescript-config` | Shared TypeScript configuration metadata |
| `packages/solana-utils` | `packages-solana-utils` | Shared Solana utilities |
| `packages/ts-sdk` | `packages-ts-sdk` | Shared TypeScript SDK code |

## Quick Start

Use pnpm only. The root manifest pins pnpm 10.24.0.

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Fill every required blank or placeholder before starting the applications. With `NODE_ENV` initially unset, the API loads `apps/api/.env`; Next.js reads `apps/web/.env.local`.

### Ports

| Service | Local development | Docker publication |
| --- | ---: | ---: |
| Web | `http://localhost:3000` | `http://localhost:3006` maps to container port 3000 |
| API | `http://localhost:3001` | `http://localhost:3005` maps to container port 3001 |
| PostgreSQL | Local installation-specific | Container port 5432; host publication is currently commented out |
| Redis | Local installation-specific | Container port 6379; host publication is currently commented out |

## Environment Setup

Tracked templates contain placeholders and non-secret local defaults. Local environment files are ignored and must never be committed.

### Local devnet

```bash
cp apps/api/.env.example apps/api/.env.devnet
cp apps/web/.env.example apps/web/.env.devnet
cp apps/api/.env.devnet apps/api/.env
cp apps/web/.env.devnet apps/web/.env.local
```

Set both Solana network variables to `devnet`, use a reviewed devnet RPC, and use devnet-only program, mint, wallet, and keypair material.

### Local mainnet

```bash
cp apps/api/.env.example apps/api/.env.mainnet
cp apps/web/.env.example apps/web/.env.mainnet
cp apps/api/.env.mainnet apps/api/.env
cp apps/web/.env.mainnet apps/web/.env.local
```

Mainnet configuration is intentionally not prefilled. Set the network to `mainnet-beta` only after reviewing every transaction path, disabling test modes, confirming program and mint addresses, and moving secrets to an appropriate secret manager. Never reuse devnet keys or casually run scripts with funded credentials.

### Docker template

```bash
cp .env.docker.example .env.docker
```

`docker-compose.yaml` currently contains literal environment assignments and does not consistently interpolate `.env.docker`. The copy above prepares a local reference file but does **not** override or sanitize those Compose values. Do not treat the current Compose configuration as production-safe; update Compose to explicit `${VARIABLE}` references in a separate reviewed code-sanitization change before deployment.

### Variable Reference

`Required` means the application should not be trusted in that area without an explicit value, even where source code currently supplies an insecure or development fallback. `Conditional` variables are required only when the named integration or transaction path is enabled.

| Group | Variables | Requirement | Safe example |
| --- | --- | --- | --- |
| API | `PORT`, `NODE_ENV`, `API_PREFIX`, `ALLOWED_ORIGINS`, `FRONTEND_URL` | Required | `3001`, `development`, `/api`, `http://localhost:3000` |
| Database | `DATABASE_URL` | Required for Prisma/PostgreSQL | `postgresql://prowallet:<password>@localhost:5432/prowallet` |
| Database | `REDIS_URL`, `MONGODB_URI` | Conditional; Redis cache and legacy database path | `redis://localhost:6379`, leave legacy URI blank when unused |
| Solana | `SOLANA_NETWORK`, `SOLANA_RPC_URL`, `FALLBACK_SOLANA_RPC_URL` | Required for chain access | `devnet`, `https://api.devnet.solana.com` |
| Solana | `PROWALLET_PROGRAM_ID`, `TOKEN_MINT`/`TOKEN_MINT_ADDRESS` | Required for program/token operations | `<reviewed-public-address>` |
| Solana | `KEYPAIR_PATH`, `AUTHORITY_KEYPAIR_PATH`, treasury/authority/provider variables | Conditional; signing and settlement only | `<absolute-local-path>` or `<reviewed-public-address>` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET` | Required; source fallbacks are not safe | `<random-secret-from-secret-manager>` |
| Auth | `ADMIN_USERS`, `ENCRYPTION_KEY`, `MANUAL_SETTLE_KEY` | Conditional | `<reviewed-value>` |
| Email | `EMAIL_PROVIDER`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | Conditional; required for verification/reset email | `smtp`, `<account>`, `<app-password>`, `noreply@example.test` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `MAILTRAP_*` | Conditional by provider | `localhost`, `1025`, `false` |
| Payment | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Conditional for Stripe | `<provider-secret>` |
| Payment | `COINGATE_API_TOKEN`, `NOWPAYMENTS_API_KEY` | Conditional for those providers | `<provider-secret>` |
| Payment | `TREASURY_WALLET`, `COMMISSION_WALLET`, `PLATFORM_FEE_PERCENT` | Conditional for settlement | `<reviewed-public-address>`, `1` |
| Web | `NEXT_PUBLIC_ENVIRONMENT`, `NEXT_PUBLIC_API_URL_LOCAL`, `NEXT_PUBLIC_API_URL_CLOUD` | Required per target | `local`, `http://localhost:3001/api/v1` |
| Web | `NEXT_PUBLIC_SOLANA_NETWORK`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_FALLBACK_SOLANA_RPC_URL` | Required for wallet flows | `devnet`, public devnet RPC URL |
| Web | `NEXT_PUBLIC_PROWALLET_PROGRAM_ID`, `NEXT_PUBLIC_TOKEN_MINT` | Required for program/token flows | `<reviewed-public-address>` |
| Web | `NEXT_PUBLIC_HELIUS_API_KEY` | Conditional; public bundle values are not secrets | Leave blank unless deliberately exposing a restricted browser key |

Every `NEXT_PUBLIC_*` value is shipped to the browser. Never put private keys, JWT secrets, database credentials, unrestricted provider keys, or other secrets in web environment variables.

## Commands

All commands are run from the repository root unless noted.

```bash
# Development
pnpm dev

# Static validation
pnpm lint
pnpm check-types

# Production builds
pnpm build

# Formatting (writes files)
pnpm format

# API tests
pnpm --filter prowallet-api test --run
pnpm --filter prowallet-api test:coverage --run

# Web tests
pnpm --filter exchange-web-ui test --run
pnpm --filter exchange-web-ui test:coverage --run
```

There is no root `test` script. Run tests through the package filters shown above. Inspect integration and Solana-facing tests before execution; a test label alone does not prove that a path is offline or fund-safe.

Database mutation commands exist in `prowallet-api` (`prisma:migrate`, `prisma:push`, `seed`, and `seed:clear`). Review the target `DATABASE_URL` before running any of them.

## Configuration Hygiene

### Tracked templates

- `.env.docker.example`
- `apps/api/.env.example`
- `apps/web/.env.example`

### Local and ignored

- `apps/api/.env`, `apps/web/.env.local`, `.env.*.local`, `.env.docker`, and `.env.docker.local`
- `apps/api/.env.devnet`, `apps/api/.env.devnet.test`, and `apps/api/.env.mainnet`
- `apps/web/.env.devnet` and `apps/web/.env.mainnet`
- Local Solana keypairs identified explicitly in `.gitignore`

Verify local files without displaying their contents:

```bash
git check-ignore -v -- apps/api/.env apps/web/.env.local .env.docker
git status --ignored --short
```

If a sensitive file was already tracked, remove only its index entry while keeping the physical file:

```bash
git rm --cached -- <path>
```

Never use plain `git rm <path>` for this cleanup: that removes the working-tree file. Confirm the file still exists and is ignored after `git rm --cached`.

Ignoring or untracking a file does not erase earlier commits. Any credential ever committed, published, logged, shared in an image, or exposed to a browser must be considered compromised and rotated at the provider. History rewriting is a separate, coordinated operation and does not replace rotation.

## Architecture

```text
Browser / wallet
      |
      v
Next.js web (apps/web)
      |
      v
Express API + Socket.IO (apps/api)
      |             |              |
      v             v              v
Prisma/PostgreSQL  Redis       Solana RPC/program
      |
      v
Auth, purchase, transfer, payment, webhook, and worker services
```

The API is organized into routes, controllers, middleware, services, workers, and Prisma models. The web app uses the Next.js App Router with components, hooks, and client-side service modules. Shared code lives under `packages/`, although not every package currently participates in every root task.

## Project Structure

```text
prowallet/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   ├── scripts/
│   │   ├── src/
│   │   └── Dockerfile.api
│   └── web/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── Dockerfile.web
├── packages/
│   ├── eslint-config/
│   ├── solana-utils/
│   ├── ts-sdk/
│   ├── typescript-config/
│   └── ui/
├── docker-compose.yaml
├── pnpm-workspace.yaml
└── turbo.json
```

## Safe Testing

- Use devnet-only wallets with no production authority and only disposable test funds.
- Keep `TEST_MODE_FREE_TOKEN` and `NEXT_PUBLIC_TEST_MODE_FREE_TOKEN` disabled outside explicitly reviewed local scenarios.
- Confirm RPC, API, program, mint, database, and keypair targets before every integration test or script.
- Do not assume `devnet` from a filename; verify the loaded runtime variables.
- Never run transaction-capable scripts as a smoke test.
- Avoid production databases and provider credentials during local validation.

## License Status

Some package manifests declare `MIT`, but this repository does not currently contain a root `LICENSE` file. Until the copyright holder adds an applicable license text, do not represent the repository as having a complete repository-level MIT license grant.
