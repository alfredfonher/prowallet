# GitHub Copilot & Agentic Coding Instructions

## CRITICAL: Project Setup
- **Monorepo Structure**: Turbo + pnpm workspaces with `apps/` (api, web) and `packages/` (shared)
- **No Docker**: NEVER execute docker commands in this project under any circumstances
- **Package Manager**: Use `pnpm` NOT `npm` (root: pnpm@10.24.0)
- **Node Version**: Requires Node.js >=18

## Build/Run Commands (Turbo-based, runs ALL apps)
- `npm run dev` → Start dev servers (API + Web with Turbopack)
- `npm run build` → Production build (Next.js + TypeScript compilation)
- `npm run lint` → Run ESLint across all packages
- `npm run format` → Format code with Prettier
- `npm run check-types` → Full TypeScript type checking

## Testing Commands
- **API tests**: `cd apps/api && npm test` (Vitest - may timeout, use `npm run test:single` for one test)
- **Web tests**: `cd apps/web && npm test` (Vitest - currently has ESM config issues)
- **Single test file**: `cd apps/api && npm test -- path/to/test.test.ts`
- **Watch mode**: `cd apps/api && npm test -- --watch`

## Code Style & Imports
- Always use TypeScript strict mode
- Import order: Node → External → Packages → Local (use relative imports with @/)
- Avoid default exports; use named exports
- Use absolute imports: `@/components/...` in web, `../../...` in api

## Error handling
- Always handle errors explicitly
- Never swallow errors
- Prefer custom error classes
- Do not log secrets or tokens

## Dependencies
- Prefer small and well-maintained libraries
- Avoid adding new dependencies unless strictly necessary

## Express.js
- Use express.Router() for every module
- Never define routes in index.ts
- Controllers must be pure and stateless
- Business logic must not live in route handlers
- Always validate request body, params and query
- Use express-validator for request validation (param, body, query)
- Extract validators into separate const objects for reusability

## Security
- Always use helmet
- Sanitize user input
- Never trust req.body directly

## Next.js
- Use App Router only
- Prefer Server Components by default
- Use Client Components only when required
- Do not use getServerSideProps or getStaticProps
- Use server actions for mutations
- Never fetch data directly in Client Components
- Use fetch with caching and revalidation

## Performance
- Avoid useEffect for data fetching
- Prefer streaming and Suspense
- Optimize images with next/image

## Architecture
- Enforce separation of concerns
- Shared logic must live in packages/
- Do not duplicate business logic across apps
- Prefer dependency inversion
- APIs must be versioned (/api/v1)

## Testing
- Use TDD approach all time
- Use Vitest for unit tests
- Write tests for all business logic
- Do not test framework internals
- Prefer integration tests over mocks

## Forbidden
- Do not use any
- Do not use console.log in production code
- Do not disable TypeScript or ESLint rules
- Do not generate code without types

## Code Size and Modularity
- No file should exceed 200 lines of code
- Prefer multiple small files over one large file
- Split code by responsibility, not by technical layer
- Each module must have a single clear purpose
- Functions should not exceed 40 lines
- Avoid deeply nested logic (max 2 nesting levels)
- Prefer composition over inheritance
- Extract reusable logic into separate modules

## Naming Conventions (Strict)

All identifiers in the system MUST follow a clear, consistent, and descriptive naming convention.

### General Rules
- Use snake_case for all identifiers unless explicitly stated otherwise
- Names must be descriptive and intention-revealing
- Avoid generic names like data, info, temp, value, item

### Variables
- Use snake_case

### Constants
- Use SCREAMING_SNAKE_CASE

### Functions
- Use snake_case
- Must start with a verb

### Boolean Naming
- Must start with is_, has_, can_, should_

### Files and Folders
- Use kebab-case

### Database
- Tables and columns use snake_case
