# GitHub Copilot & Agentic Coding Instructions

## CRITICAL: Project Setup

- **Monorepo Structure**: Turbo + pnpm workspaces with `apps/` (api, web) and `packages/` (shared)
- **No Docker**: NEVER execute docker commands in this project under any circumstances
- **Package Manager**: Use `pnpm` NOT `npm` (root: pnpm@10.24.0)
- **Node Version**: Requires Node.js >=18

## CRITICAL: Language Requirement 🇪🇸

### ⚠️ **ALL RESPONSES MUST BE IN SPANISH (ESPAÑOL)**

**OBLIGATORY RULE**: Every API response, error message, success message, and user-facing text MUST be in Spanish.

**Applied to:**

- All HTTP response messages
- All error messages and validation errors
- All email subject lines and content
- All logging messages visible to end users
- All function/variable documentation (keep code in English, doc strings in Spanish)
- All status messages and notifications

**Examples:**

```typescript
// ❌ WRONG
res.status(400).json({ error: "Email is invalid" });

// ✅ CORRECT
res.status(400).json({ error: "El email no es válido" });
```

---

## 🏗️ CODE MODULARITY & QUALITY (OBLIGATORY)

### 1. **Modularize Functions**

- Break down large functions into smaller, reusable pieces
- Each function should have ONE clear responsibility
- Extract common logic into separate modules/utilities
- Create shared utilities in `packages/` for reusable logic

### 2. **Function Length Limits** ⚡ STRICT

- **Maximum 100 lines per function** (ideally < 50 lines)
- Keep functions as simple and clean as possible
- If a function approaches 100 lines, break it into smaller functions
- Avoid deeply nested logic (max 2 nesting levels)

### 3. **Identify & Create Reusable Widgets**

- When you identify reusable logic, extract it into:
  - `apps/web/components/widgets/` for UI widgets
  - `apps/web/hooks/` for custom hooks
  - `packages/` for shared utilities
- Create single-responsibility widgets that can be composed

### 4. **Avoid Classes (Prefer Functions)**

- **Use functions instead of classes whenever possible**
- Keep code functional and composition-based
- Only use classes when absolutely necessary for complex state management

### 5. **Core Classes (Exception)**

- In `packages/` or core modules, classes ARE allowed
- Use inheritance to avoid code duplication
- Extend base classes to write less boilerplate
- Example: `BaseService` → `EmailService extends BaseService`

### 6. **Avoid Over-Engineering**

- Don't create abstractions unless needed
- Don't use complex patterns for simple problems
- KISS principle: Keep It Simple, Stupid
- Solve the problem with the minimum viable code

### 7. **Document All Functions (JSDoc)**

- Every function MUST have a JSDoc comment
- Keep documentation brief but descriptive
- Include: what it does, params, return type, example if helpful
- Spanish descriptions for user-facing functions

**Example:**

```typescript
/**
 * Calcula el precio total de una compra incluyendo fees
 * @param cantidad_tokens - Número de tokens a comprar
 * @param precio_unitario - Precio por token en SOL
 * @returns Objeto con precios desglosados
 */
function calcular_precio_total(
  cantidad_tokens: number,
  precio_unitario: number,
) {
  // implementation
}
```

### 8. **Naming: ALWAYS snake_case** ⚡ MANDATORY

- **NO camelCase in variable names**
- **NO camelCase in function names**
- **NO camelCase in class/method names**
- Use snake_case for EVERYTHING unless TypeScript forces otherwise

**Examples:**

```typescript
// ❌ WRONG
const userBalance = 100;
function calculatePrice() {}
class PaymentHandler {}

// ✅ CORRECT
const user_balance = 100;
function calculate_price() {}
class PaymentHandler {} // Classes OK with PascalCase, but internal methods use snake_case
method_name(); // internal methods
```

### 9. **Avoid camelCase EVERYWHERE**

- Variables: `is_loading` not `isLoading`
- Functions: `get_user_data()` not `getUserData()`
- Props: `user_id` not `userId`
- Constants: `MAX_RETRIES` not `maxRetries`
- Only exception: Reserved keywords or external library requirements

---

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
- **Variable/Function names**: snake_case for variables and functions
- **Spanish names for user-facing content**: All messages, labels, and documentation must be in Spanish

## Error handling

- Always handle errors explicitly
- Never swallow errors
- Prefer custom error classes
- Do not log secrets or tokens
- **Always provide error messages in Spanish**

## Dependencies

- Prefer small and well-maintained libraries
- Avoid adding new dependencies unless strictly necessary
- **Email**: Using Nodemailer (v6.9.8+) for email sending
  - Supports: Gmail (App Passwords), Outlook, Mailtrap, custom SMTP
  - Configuration via `apps/api/src/services/auth/nodemailer.config.ts`
  - Environment variables: `EMAIL_PROVIDER`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`

## Express.js

- Use express.Router() for every module
- Never define routes in index.ts
- Controllers must be pure and stateless
- Business logic must not live in route handlers
- Always validate request body, params and query
- Use express-validator for request validation (param, body, query)
- Extract validators into separate const objects for reusability
- **All response messages must be in Spanish**

## Security

- Always use helmet
- Sanitize user input
- Never trust req.body directly
- **Email Configuration**: Keep EMAIL_USER and EMAIL_PASSWORD secure in .env
  - Never commit .env to git
  - Use environment variables in production
  - For Gmail: Use App Passwords, not regular passwords

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
- **Email Service**: Located in `apps/api/src/services/auth/`
  - `email.service.ts` - Main email sending service
  - `nodemailer.config.ts` - Nodemailer configuration and transport
  - Methods return Spanish-only messages

## Testing

- Use TDD approach all time
- Use Vitest for unit tests
- Write tests for all business logic
- Do not test framework internals
- Prefer integration tests over mocks
- **All test messages and assertions must reference Spanish responses**

## Forbidden

- Do not use `any` type
- Do not use console.log in production code
- Do not disable TypeScript or ESLint rules
- Do not generate code without types
- **Do not use English in user-facing messages** (violates Spanish requirement)
- Do not commit .env file to version control
- **Do NOT use camelCase** (always use snake_case)
- **Do NOT use classes unless absolutely necessary**

## Code Size and Modularity

- No file should exceed 200 lines of code
- Prefer multiple small files over one large file
- Split code by responsibility, not by technical layer
- Each module must have a single clear purpose
- **Functions should not exceed 100 lines (ideally < 50)**
- Avoid deeply nested logic (max 2 nesting levels)
- Prefer composition over inheritance
- Extract reusable logic into separate modules

## Naming Conventions (Strict)

All identifiers in the system MUST follow a clear, consistent, and descriptive naming convention.

### General Rules

- Use snake_case for all identifiers unless explicitly stated otherwise
- Names must be descriptive and intention-revealing
- Avoid generic names like data, info, temp, value, item
- **User-facing messages**: Always in Spanish, clearly descriptive

### Variables

- Use snake_case
- Spanish names for user-facing content

### Constants

- Use SCREAMING_SNAKE_CASE

### Functions

- Use snake_case
- Must start with a verb
- Spanish names for user-facing functions: `enviar_email()`, `validar_password()`, etc.

### Boolean Naming

- Must start with `is_*`, `has_*`, `can_*`, `should_*`
- Spanish: `es_admin`, `tiene_email_verificado`, `puede_acceder`, etc.

### Classes & Types

- Use PascalCase for class names: `PaymentService`, `UserController`
- Use PascalCase for interfaces: `IPayment`, `IUser`
- Use PascalCase for types: `PaymentType`, `UserRole`
- But internal methods/properties use snake_case: `method_name()`, `property_name`

### Files and Folders

- Use kebab-case: `payment-service.ts`, `user-controller.ts`

### Database

- Tables and columns use snake_case
- English names for database objects (technical layer)
- Spanish names for user-facing content and messages

---

## Project Structure

```
prowallet/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── controllers/     # Request handlers
│   │       ├── services/        # Business logic
│   │       ├── routes/          # Route definitions
│   │       ├── middleware/      # Express middleware
│   │       └── workers/         # Background jobs
│   └── web/
│       ├── components/
│       │   ├── widgets/         # ✅ Reusable UI widgets
│       │   └── views/           # Page components
│       ├── hooks/               # ✅ Custom React hooks
│       ├── lib/                 # Utilities & services
│       └── app/                 # Next.js App Router
└── packages/
    ├── ts-sdk/                  # Shared TypeScript code
    ├── ui/                      # Shared UI components
    └── solana-utils/            # Solana utilities
```

---

## Summary of Breaking Changes

✅ **NOW ENFORCED:**

1. Modularize ALL functions
2. Max 100 lines per function
3. Identify and create reusable widgets
4. NO classes (unless in packages/core)
5. Core classes can extend base classes
6. No over-engineering
7. JSDoc on EVERY function
8. **ALWAYS snake_case** (this is MANDATORY)
9. Never use camelCase
