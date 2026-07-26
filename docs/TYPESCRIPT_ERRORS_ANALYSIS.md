# TypeScript Errors Analysis - Session 6

## Executive Summary

**STATUS**: 🔴 **CRITICAL** - The web app has **39 TypeScript errors** and does NOT compile with strict type checking enabled.

**Impact**:

- Code is in production but BROKEN from a type-safety perspective
- Frontend cannot be reliably tested or refactored
- Type safety is completely non-functional

---

## Error Breakdown by Category

### 1. **Missing Type Exports (5 errors) - CRITICAL**

**Problem**: Types are declared but not exported, causing import failures.

```typescript
// ❌ WRONG: TokenContext is declared but not exported
export const TokenProvider = ({ children }) => {
  const TokenContext = createContext({});
  // ...
};

// ✅ CORRECT: Export before use
const TokenContext = createContext<TokenContextType>({});
export const TokenProvider = ({ children }) => {
  // ...
};
```

**Affected Files**:

- `components/token-provider.tsx` - **TokenContext not exported**
- `components/temp-token-provider.tsx` - **TokenContext not exported**
- `lib/hooks/index.ts` - **UseTokenInputReturn not exported**

**Files Using These**:

- `components/BuyTokenCard.tsx` - Tries to import TokenContext
- Multiple test files

**Fix Strategy**:

```bash
1. Find all `createContext<T>()` in providers
2. Export them at module level
3. Re-export from lib/hooks/index.ts
```

---

### 2. **Missing Modules (7 errors) - CRITICAL**

**Problem**: Files are imported but don't exist.

```typescript
// ❌ IMPORT FAILED: These files don't exist
import { wallet_login_service } from "../wallet-login.service";
import walletAuthSchema from "../wallet-auth.schema";
import { logger } from "@/services/logging/logger.service";
```

**Missing Files**:

- `apps/web/__tests__/wallet-login.service.ts` ❌
- `apps/web/__tests__/wallet-auth.schema.ts` ❌
- `apps/web/services/logging/logger.service.ts` ❌
- `apps/web/lib/use-purchase-refactored.ts` ❌
- `apps/web/utils/token-input-formatter.ts` ❌
- `@testing-library/react` ❌ (npm package missing)

**Fix Strategy**:

1. **Install missing npm package**:

   ```bash
   pnpm add -D @testing-library/react
   ```

2. **Remove dead imports** or create stub files:
   - `wallet-auth.schema.ts` - Can be removed (tests only)
   - `wallet-login.service.ts` - Can be removed (tests only)
   - `logger.service.ts` - Create proper logger service or remove

3. **Check test files** - Are they needed?
   ```bash
   # These seem to be orphaned test files
   __tests__/wallet-auth.schema.test.ts
   __tests__/wallet-login.service.test.ts
   ```

---

### 3. **Type Property Mismatches (25 errors) - HIGH**

**Problem**: Code tries to access properties that don't exist on types.

```typescript
// ❌ Property doesn't exist
error.error_code; // TS2339: error_code not on ParsedAuthError
context.isAuthenticated; // TS2339: not on empty context type

// ✅ Check API definition
// What does ParsedAuthError actually have?
// What does the context export?
```

**Critical Mismatches**:

| File                             | Property          | Type               | Issue                  |
| -------------------------------- | ----------------- | ------------------ | ---------------------- |
| `auth-context.test.ts`           | `error_code`      | `ParsedAuthError`  | Field doesn't exist    |
| `BuyTokenCard.tsx`               | `isAuthenticated` | `TokenContext`     | Context is empty `{}`  |
| `SimplePurchaseFlowImproved.tsx` | `quote`           | Price object       | Field missing          |
| `purchase-service.test.ts`       | `transactionId`   | Response           | Field missing          |
| `use-purchase.ts`                | `apiBaseUrl`      | `AppConfig`        | Field not defined      |
| `address-book-api.ts`            | `patch`           | `ApiClient`        | Method not implemented |
| `wallet-login.service.ts`        | Various           | Challenge response | Type mismatch          |

**Fix Strategy**:

1. **Audit the API responses** - What does the API actually return?
2. **Check type definitions** - Do they match reality?
3. **Update tests** - Test what the API actually returns, not what we wish it returned

---

### 4. **Function Argument Mismatches (11 errors) - HIGH**

**Problem**: Functions called with wrong number or type of arguments.

```typescript
// ❌ Expected 2 args, got 1
createPurchaseOrder({ tokenAmount: 100 });

// ✅ What does function signature expect?
function createPurchaseOrder(params: OrderParams, options: OrderOptions) {
  // ...
}
```

**Affected Functions**:

- `purchase_service.test.ts` - 5 instances
- `address-book-api.ts` - Line 116
- `validators.test.ts` - Line 428
- `wallet-detection.service.ts` - Multiple

**Fix Strategy**:

1. Check function signatures in services
2. Update call sites to match
3. Or make parameters optional if they are truly optional

---

### 5. **Object Property Mismatches (3 errors) - MEDIUM**

**Problem**: Object literals don't match the declared type.

```typescript
// ❌ 'signature' not in PurchaseConfirmedDetail type
{
  signature: tx.signature,  // ❌ This property not allowed
  amount: 100,
}

// ✅ Check what PurchaseConfirmedDetail actually includes
```

**Affected Code**:

- `temp-token-provider.tsx:596`
- `token-provider.tsx:599`
- `address-book-list.tsx:39`

**Fix Strategy**:

1. Audit `PurchaseConfirmedDetail` type definition
2. Either add `signature` field or remove from payload
3. Check what these components should actually send

---

### 6. **Type Assignment Issues (3 errors) - MEDIUM**

**Problem**: Incompatible types being assigned.

```typescript
// ❌ Type mismatch
const config: AppConfig = {
  // but appConfig doesn't have apiBaseUrl
};

// ❌ React props issue
<div title="x" description="y" />  // description not valid for div
```

**Affected Code**:

- `use-purchase.ts:232` - `apiBaseUrl` not in `AppConfig`
- `purchase-adapter.ts:50` - Transaction type mismatch
- `address-book-list.tsx:39` - Invalid div prop

**Fix Strategy**:

1. Add missing fields to type definitions
2. Remove invalid props
3. Create proper type wrappers

---

### 7. **Test Framework Issues (1 error) - LOW**

**Problem**: Missing test setup globals.

```typescript
// ❌ afterEach not defined (Vitest not configured)
afterEach(() => {
  // cleanup
});
```

**Fix Strategy**:

1. Ensure vitest config includes setupFiles
2. Import from vitest: `import { afterEach } from 'vitest'`

---

### 8. **Logic Errors (1 error) - LOW**

**Problem**: Typo in constant comparison.

```typescript
// ❌ Comparing different constants that should be same
if (mint === "11111111111111111111111111111112") {
  // Wrong constant
  // Should be "So11111111111111111111111111111111111111112"
}
```

---

## Summary of Root Causes

| Category             | Count | Severity    | Root Cause                                  |
| -------------------- | ----- | ----------- | ------------------------------------------- |
| Missing Type Exports | 5     | 🔴 CRITICAL | Poor module architecture                    |
| Missing Modules      | 7     | 🔴 CRITICAL | Dead code + missing npm packages            |
| Property Mismatches  | 25    | 🔴 CRITICAL | Type definitions don't match implementation |
| Function Arguments   | 11    | 🔴 CRITICAL | API changes not reflected in tests          |
| Object Mismatches    | 3     | 🟡 HIGH     | API contract violations                     |
| Type Assignments     | 3     | 🟡 HIGH     | Incomplete type definitions                 |
| Test Setup           | 1     | 🟢 MEDIUM   | Vitest configuration                        |
| Logic Errors         | 1     | 🟢 MEDIUM   | Copy-paste mistakes                         |

---

## Recommended Fix Priority

### Phase 1: BLOCKING (Must fix to compile)

1. **Export missing types** (5 errors)
   - Fix: `TokenContext` exports
   - Fix: `UseTokenInputReturn` export
   - Time: 30 minutes

2. **Install/Remove missing modules** (7 errors)
   - Install: `@testing-library/react`
   - Remove: orphaned test files
   - Create: logger service stub or remove
   - Time: 1 hour

3. **Fix type definitions** (25 errors)
   - Audit API responses
   - Update Prisma schema if needed
   - Update type files
   - Time: 3-4 hours

### Phase 2: HIGH (Fix implementation)

4. **Fix function signatures** (11 errors)
   - Time: 1-2 hours

5. **Fix object literals** (3 errors)
   - Time: 30 minutes

6. **Fix type assignments** (3 errors)
   - Time: 1 hour

### Phase 3: MAINTENANCE

7. **Fix test setup** (1 error)
   - Time: 15 minutes

8. **Fix logic errors** (1 error)
   - Time: 15 minutes

---

## Total Estimated Time to Fix

- **Quick fixes** (exports, installs): 1.5 hours
- **Medium fixes** (function args, objects): 3 hours
- **Hard fixes** (type definitions): 4 hours

**Total: 8.5 hours of focused work**

---

## Prevention Strategy Going Forward

1. **Enable strict TypeScript in CI/CD**

   ```json
   {
     "strict": true,
     "noImplicitAny": true,
     "noUnusedLocals": true,
     "noUnusedParameters": true,
     "noImplicitReturns": true,
     "noFallthroughCasesInSwitch": true
   }
   ```

2. **Run type checking before committing**

   ```bash
   # Add to pre-commit hook
   npm run check-types
   ```

3. **Mark test files with vitest globals**

   ```typescript
   // At top of test files
   import { describe, it, beforeEach, afterEach, vi } from "vitest";
   ```

4. **Use explicit return types**

   ```typescript
   // ❌ NO
   function getData() {
     return api.fetch(...);
   }

   // ✅ YES
   function getData(): Promise<DataType> {
     return api.fetch(...);
   }
   ```

5. **Audit API contracts regularly**
   - Compare actual API responses vs. type definitions
   - Update types whenever API changes
   - Document API breaking changes

---

## Files That Need Immediate Action

### HIGH PRIORITY (Fix these first):

- [ ] `apps/web/components/token-provider.tsx` - Export TokenContext
- [ ] `apps/web/components/BuyTokenCard.tsx` - Fix context usage
- [ ] `apps/web/lib/hooks/index.ts` - Export UseTokenInputReturn
- [ ] `apps/web/package.json` - Add @testing-library/react
- [ ] `apps/web/__tests__/wallet-auth.schema.test.ts` - Delete or fix
- [ ] `apps/web/__tests__/wallet-login.service.test.ts` - Delete or fix

### MEDIUM PRIORITY (Fix these next):

- [ ] `apps/web/components/SimplePurchaseFlowImproved.tsx` - Fix property access
- [ ] `apps/web/hooks/use-purchase.ts` - Add apiBaseUrl to AppConfig
- [ ] `apps/web/lib/address-book-api.ts` - Implement patch method or fix signature
- [ ] `apps/web/lib/services/__tests__/purchase-service.test.ts` - Fix mock signatures

---

## Questions to Answer Before Fixing

1. **What is the actual API contract for purchase responses?**
   - Does it include `signature`, `transactionId`, `id`?
   - Documentation: Check `PRD.md`, test REST files

2. **What should `AppConfig` include?**
   - Should it have `apiBaseUrl`?
   - Check `.env.example` for all config keys

3. **Do we actually need token-provider AND temp-token-provider?**
   - Why are there two?
   - Can we consolidate?

4. **Are these test files even used?**
   - `__tests__/wallet-auth.schema.test.ts`
   - `__tests__/wallet-login.service.test.ts`
   - Run: `grep -r "wallet-auth.schema" apps/web/` to check

---

## Next Action

**WAIT FOR USER DECISION**:

- Should we fix all 39 errors now?
- Should we create a PR to fix incrementally?
- Should we focus on specific areas first?

The codebase is **NOT PRODUCTION READY** from a type-safety perspective. This must be addressed before:

- Any major refactoring
- Deploying to production
- Onboarding new team members
- Adding more features
