# 🚀 PLAN DE ACCIÓN - PROWALLET PURCHASE MIGRATION FIX

**Creado:** 15 Diciembre 2025  
**Problema:** Compras no registran tokens correctamente en producción (SSH)  
**Solución:** 10 tickets de resolución siguiendo copilot-instructions.md

---

## 📌 RESUMEN EJECUTIVO

### El Problema

```
Legacy (.legacy)    →    Migración    →    Actual (apps)
  ✅ Funciona         Pérdida de         ❌ Historial incorrecto
  ✅ Tokens OK        contexto           ❌ Amounts = NULL
  ✅ Auditoria OK     y lógica           ❌ Mint no se registra
```

### Síntomas en Producción

- **Compra iniciada:** ✅ Funciona
- **Pago enviado:** ✅ Funciona
- **Tokens transferidos:** ✅ Se ejecuta
- **Histórico actualizado:** ❌ Muestra NULL amounts
- **No se puede reintenta:** ❌ Falta endpoint settle

### Raíz del Problema

La función `updateTokenBalance()` **no retorna la firma de mint**, por lo tanto:

1. No se puede verificar si el mint fue exitoso
2. No se registra la `mintSignature` en DB
3. El histórico no muestra los tokens correctamente
4. No hay forma de retry manual

---

## 🎯 ROADMAP DE 5 DÍAS

### ✅ DAY 1: FIXES CRÍTICOS (2-3 horas)

#### TICKET #1: updateTokenBalance() retorna mintSignature

**Archivo:** `apps/api/src/controllers/purchase/PurchaseController.ts`

```typescript
// ANTES (❌ INCORRECTO)
private async updateTokenBalance(wallet: string, amount: number): Promise<void> {
  const result = await autoSettlePurchase(wallet, amount, signature);
  // result: { success: boolean, signature?: string }
  // ❌ No retorna nada
}

// DESPUÉS (✅ CORRECTO)
private async updateTokenBalance(wallet: string, amount: number): Promise<string | null> {
  const result = await autoSettlePurchase(wallet, amount, signature);
  if (!result.success) {
    loggerService.logError(new Error("Mint failed"), { wallet, amount });
    return null;
  }
  loggerService.logInfo("✅ Mint successful", { wallet, amount, signature: result.signature });
  return result.signature || null;
}
```

**Checklist:**

- [ ] La función retorna `Promise<string | null>`
- [ ] Retorna la firma cuando es exitoso
- [ ] Retorna null cuando falla
- [ ] Logea el resultado (no console.log)
- [ ] Máx 20 líneas

#### TICKET #2: confirmPurchase() registra mintSignature

**Archivo:** `apps/api/src/controllers/purchase/PurchaseController.ts` L692+

```typescript
// ANTES (❌ INCORRECTO)
const mint_sig = await this.updateTokenBalance(wallet, amount);
if (!mint_sig) {
  // Marca como FAILED inmediatamente
  status = "failed";
}

// DESPUÉS (✅ CORRECTO)
const mint_sig = await this.updateTokenBalance(wallet, amount);
if (!mint_sig) {
  // Marca como PENDING_MINT para retry
  status = "pending_mint";
  minting = false;
  // NO falles aún, permite retry
} else {
  // Mint exitoso: guardar en DB
  await transactionRepository.update(
    { transactionId },
    {
      status: "success",
      minted: true,
      minting: false,
      mintSignature: mint_sig,
    },
  );
}
```

**Checklist:**

- [ ] Se registra `mintSignature` en DB cuando es exitoso
- [ ] El status es `pending_mint` si falla (no `failed`)
- [ ] La notificación incluye `mintSignature`
- [ ] Se loguea el resultado

---

### ✅ DAY 2: HISTORIAL Y RETRY (2-3 horas)

#### TICKET #3: getPurchaseHistory() retorna amounts correctos

**Archivo:** `apps/api/src/controllers/purchase/PurchaseController.ts` L1927+

```typescript
// ANTES (❌ INCORRECTO)
const history = await transactionRepository.find({ walletAddress });
// Retorna tokenAmount = null si mint falla

// DESPUÉS (✅ CORRECTO)
const history = await transactionRepository.find({ walletAddress });
const mapped = history.map((tx) => ({
  transactionId: tx.transactionId,
  walletAddress: tx.walletAddress,
  tokenAmount: tx.tokenAmount, // ← SIEMPRE retornar el original
  paymentAmount: tx.paymentAmount,
  signature: tx.signature,
  mintSignature: tx.mintSignature || null,
  mintStatus: tx.minted ? "success" : tx.minting ? "pending" : "failed",
  status: tx.status,
  createdAt: tx.createdAt,
}));
return mapped;
```

**Checklist:**

- [ ] `tokenAmount` nunca es null (usar el original del request)
- [ ] Incluye `mintSignature` cuando disponible
- [ ] Incluye `mintStatus` en cada item
- [ ] Frontend puede usar esta estructura

#### TICKET #4: Crear endpoint POST /purchase/settle/:transactionId

**Archivo:** `apps/api/src/routes/purchase/purchase.routes.ts` (NUEVO endpoint)

```typescript
router.post(
  "/settle/:transactionId",
  authMiddleware, // Requiere JWT
  async (req: Request, res: Response) => {
    const { transactionId } = req.params;

    // 1. Verificar que tx existe y puede ser reintentada
    const tx = await transactionRepository.findOne({ transactionId });
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    if (tx.minted) return res.json({ error: "Already minted" });
    if (tx.minting) return res.json({ error: "Minting in progress" });

    // 2. Reintenta mint
    const mint_sig = await purchaseController.updateTokenBalance(
      tx.walletAddress,
      tx.tokenAmount,
    );

    if (!mint_sig) {
      return res.json({ success: false, error: "Mint failed again" });
    }

    // 3. Guarda resultado
    await transactionRepository.update(
      { transactionId },
      {
        status: "success",
        minted: true,
        mintSignature: mint_sig,
      },
    );

    return res.json({ success: true, mintSignature: mint_sig });
  },
);
```

**Checklist:**

- [ ] Endpoint existe y es accesible
- [ ] Requiere autenticación JWT
- [ ] Retorna errores apropiados
- [ ] Actualiza DB correctamente

---

### ✅ DAY 3: VERIFICACIÓN Y METADATA (2.5 horas)

#### TICKET #5: Verificación on-chain de mint

**Archivo:** `apps/api/src/controllers/purchase/PurchaseController.ts` (NUEVO método)

```typescript
private async verifyOnChainMint(
  walletAddress: string,
  expectedTokens: number,
  maxRetries: number = 5
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const balance = await solanaService.getTokenBalance(walletAddress);
    if (balance.uiAmount >= expectedTokens) {
      loggerService.logInfo("✅ On-chain mint verified", {
        walletAddress,
        balance: balance.uiAmount,
        expectedTokens,
      });
      return true;
    }

    // Esperar antes de reintenta (exponential backoff)
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }

  loggerService.logWarn("⚠️ On-chain mint NOT verified", {
    walletAddress,
    expectedTokens,
    maxRetries,
  });
  return false;
}
```

**Checklist:**

- [ ] Verifica balance on-chain
- [ ] Reintenta con backoff exponencial
- [ ] Logea resultados
- [ ] Se integra en confirmPurchase()

#### TICKET #6: Sincronizar metadata completa

**Archivo:** `apps/api/prisma/schema.prisma` + controllers

En la transacción guardar:

```typescript
metadata: JSON.stringify({
  initiateTimestamp: new Date().toISOString(),
  confirmTimestamp: tx.confirmedAt?.toISOString() || null,
  settleTimestamp: tx.mintedAt?.toISOString() || null,
  paymentMethod: tx.paymentMethod,
  pricePerToken: tx.paymentAmount / tx.tokenAmount,
  pricingMode: PROWALLET_CONFIG.pricing_mode,
  bondingCurveState: { supply: currentSupply },
  slippage: calculateSlippage(amount),
  gasEstimate: PROWALLET_CONFIG.gas_estimate,
  blockSlot: tx.blockSlot || null,
  retryAttempts: 0,
  retryReasons: [],
});
```

**Checklist:**

- [ ] Metadata se guarda en cada paso
- [ ] Se puede auditar completo
- [ ] Debugging es posible con info

---

### ✅ DAY 4: NOTIFICATIONS Y CLEANUP (2-2.5 horas)

#### TICKET #7: Arreglar broadcasts de notificaciones

**Archivo:** `apps/api/src/services/notifications/notifications.service.ts`

```typescript
// Estructura correcta del evento
interface PurchaseConfirmedEvent {
  transactionId: string;
  walletAddress: string;
  tokenAmount: number; // ← Verificado
  paymentAmount: number;
  signature: string;
  blockSlot: number;
  mintSignature: string | null; // ← Del DB
  mintStatus: "success" | "pending" | "failed";
  status: "success" | "pending";
  timestamp: number;
}
```

**Checklist:**

- [ ] Todos los eventos tienen estructura correcta
- [ ] Incluye `mintSignature`
- [ ] Frontend recibe datos completos

#### TICKET #9: Reemplazar console.log() con logger

**Archivos:** Todos los que usan `console.log()`

```typescript
// ANTES (❌)
console.log("🚀 Iniciando mint...");

// DESPUÉS (✅)
loggerService.logInfo("🚀 Iniciando mint...", { requestId, wallet });
```

**Checklist:**

- [ ] No hay `console.log()` en código de producción
- [ ] Todos los logs incluyen `requestId`
- [ ] Los logs tienen contexto suficiente

---

### ✅ DAY 5: REFACTORIZACIÓN Y TESTS (4-5 horas)

#### TICKET #8: Refactorizar PurchaseController por modularidad

**Estructura final:**

```
controllers/purchase/
├── purchase_controller.ts             (< 50 líneas, orchestrator)
├── purchase_initiate_handler.ts       (< 40 líneas)
├── purchase_confirm_handler.ts        (< 40 líneas)
├── purchase_settle_handler.ts         (< 40 líneas)
├── purchase_history_handler.ts        (< 40 líneas)
├── purchase_validators.ts
├── purchase_helpers.ts                (cálculos, verificaciones)
└── __tests__/
    ├── purchase_initiate.test.ts
    ├── purchase_confirm.test.ts
    ├── purchase_settle.test.ts
    └── purchase_history.test.ts
```

**Checklist:**

- [ ] Cada archivo < 200 líneas
- [ ] Cada función < 40 líneas
- [ ] Nombres en `snake_case`
- [ ] Imports organizados
- [ ] Tests siguen pasando

#### TICKET #10: Crear tests E2E para purchase flow

**Archivo:** `apps/api/__tests__/purchase.e2e.test.ts` (NUEVO)

```typescript
describe("Purchase Flow E2E - TDD", () => {
  describe("Complete purchase flow", () => {
    it("should complete purchase with correct token amount", async () => {
      // 1. Initiate
      const initRes = await initiateTransaction();
      expect(initRes.tokenAmount).toBe(100);

      // 2. Confirm payment
      const confirmRes = await confirmPayment(initRes.transactionId);
      expect(confirmRes.mintSignature).toBeDefined();

      // 3. Verify history
      const history = await getPurchaseHistory();
      expect(history[0].tokenAmount).toBe(100);
      expect(history[0].mintSignature).toBe(confirmRes.mintSignature);
    });
  });
});
```

**Checklist:**

- [ ] Coverage >= 80%
- [ ] E2E scenarios cubiertas
- [ ] Edge cases cubiertas
- [ ] Todos los tests pasan

---

## 📊 IMPACTO Y VERIFICACIÓN

### Antes de los Fixes

```
Flujo en Producción (SSH):
1. Wallet conecta              ✅ OK
2. Initiate purchase           ✅ OK
3. Pago confirmado en chain    ✅ OK
4. Mint se ejecuta             ✅ OK
5. Histórico actualizado       ❌ BROKEN (amounts NULL)
6. Reintento de fallo          ❌ BLOCKED (no endpoint)
```

### Después de los Fixes

```
Flujo en Producción (SSH):
1. Wallet conecta              ✅ OK
2. Initiate purchase           ✅ OK
3. Pago confirmado en chain    ✅ OK
4. Mint se ejecuta             ✅ OK
5. Histórico actualizado       ✅ FIXED (amounts correctos)
6. Reintento de fallo          ✅ FIXED (endpoint settle)
7. Auditoría completa          ✅ FIXED (metadata)
```

---

## 🔍 VERIFICACIÓN POR AMBIENTE

### Local (Funcionando con Tickets)

```bash
# Test en local primero
cd apps/api
pnpm test                    # Debe pasar todos los tests
pnpm dev                    # Inicia servidor

# Test flow:
curl -X POST http://localhost:3001/api/v1/purchase/initiate \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"...", "tokenAmount": 100, "paymentMethod": "SOL"}'

# Verificar histórico
curl http://localhost:3001/api/v1/purchase/history \
  -H "Authorization: Bearer $JWT"
# Debe mostrar tokenAmount = 100, no null
```

### Producción (SSH)

```bash
# Deploy con fixes
ssh user@production

# Verificar logs
tail -f /var/log/prowallet/purchase.log
# Debe mostrar "✅ Mint successful, signature: ..."

# Test en producción
curl -X POST https://api.prowallet.io/api/v1/purchase/initiate \
  ... (mismo test que local)

# Verificar BD
SELECT * FROM "Transaction"
WHERE createdAt > NOW() - INTERVAL 1 hour
AND "tokenAmount" IS NOT NULL;
# Debe retornar todos los registros con tokenAmount correcto
```

---

## 🛠️ HERRAMIENTAS Y RECURSOS

### Validación de Nombre

✅ NOMBRES EN `snake_case`:

- `update_token_balance()`
- `verify_on_chain_mint()`
- `get_purchase_history()`
- `settle_purchase()`

### Logger Reemplazos

```typescript
// Cambiar de:
console.log("mensaje");

// A:
loggerService.logInfo("mensaje", { requestId, context });
loggerService.logWarn("mensaje", { requestId, context });
loggerService.logError(error, { requestId, context });
```

### Testing

```bash
# Coverage mínimo 80%
pnpm test --coverage

# Watch mode durante desarrollo
pnpm test --watch

# Un archivo específico
pnpm test purchase.test.ts
```

---

## ✅ CHECKLIST FINAL

Antes de hacer deploy a producción:

- [ ] Todos los 10 tickets completados
- [ ] Coverage >= 80%
- [ ] Todos los tests pasan en local
- [ ] Sin `console.log()` en código
- [ ] Todos los nombres en `snake_case`
- [ ] updateTokenBalance() retorna firma
- [ ] confirmPurchase() registra mintSignature
- [ ] getPurchaseHistory() retorna amounts
- [ ] Endpoint POST /settle funciona
- [ ] Verificación on-chain implementada
- [ ] Metadata completa en DB
- [ ] Broadcasts funcionan
- [ ] Tests E2E pasando
- [ ] Refactorización completada
- [ ] README actualizado

---

## 📞 CONTACTO Y SOPORTE

**Problemas Encontrados:** 4 críticos, 3 altos, 3 medios  
**Tiempo Estimado:** 16 horas de desarrollo  
**Riesgo de Regresión:** Bajo (TDD + tests E2E)  
**Rollback Plan:** Revert a commit anterior si es necesario
