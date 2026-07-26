# 🎫 TICKETS DE RESOLUCIÓN - PROWALLET PURCHASE MIGRATION

**Creado:** 15 Diciembre 2025  
**Prioridad:** 🔴 CRÍTICA - Problema en producción (SSH)

---

## TICKET #1 - updateTokenBalance() debe retornar mintSignature

**Prioridad:** 🔴 CRÍTICA  
**Bloquea:** Tickets #2, #3, #5, #6  
**Ubicación:** [apps/api/src/controllers/purchase/PurchaseController.ts](apps/api/src/controllers/purchase/PurchaseController.ts)

### Problema

```typescript
private async updateTokenBalance(wallet: string, amount: number): Promise<string | null> {
  // LEGACY retornaba: "4abc...xyz" (mintSignature)
  // ACTUAL retorna: null | undefined
  // IMPACTO: No se puede verificar si el mint fue exitoso
}
```

### Qué Hacer

1. **Extraer el retorno de firma** desde `autoSettleService.autoSettlePurchase()`
2. **Retornar la mintSignature** en lugar de void o null
3. **Agregar error handling** si el mint falla
4. **Logear el resultado** con logger.info()

### Verificación

- [ ] La función retorna `string | null` correctamente
- [ ] Los logs muestran la mintSignature cuando es exitoso
- [ ] Los logs muestran error cuando falla
- [ ] La firma es válida (64 caracteres base58)

### Reglas a Seguir

- ✅ snake_case para nombres de variables
- ✅ async/await (no .then())
- ✅ Usar logger, no console.log()
- ✅ Máx 40 líneas de código
- ✅ Early returns para validaciones

---

## TICKET #2 - confirmPurchase() debe registrar mintSignature

**Prioridad:** 🔴 CRÍTICA  
**Dependencia:** ← Ticket #1  
**Ubicación:** [apps/api/src/controllers/purchase/PurchaseController.ts](apps/api/src/controllers/purchase/PurchaseController.ts)

### Problema

```typescript
const mint_sig = await this.updateTokenBalance(wallet, amount);
// ACTUAL: if (!mint_sig) { marcar FAILED }
// DEBERÍA: if (!mint_sig) { reintento o almacenar para retry }
```

### Qué Hacer

1. **Almacenar mintSignature** en la transacción (Prisma): `transaction.mintSignature = mint_sig`
2. **Actualizar status condicional**:
   - Si mint exitoso: `status = "success"`, `minted = true`
   - Si mint falla: `status = "pending_mint"`, `minting = false` (para retry)
3. **Broadcast notificación correcta** con tokenAmount verificado
4. **Agregar retry logic** si mint falla

### Verificación

- [ ] La transacción se actualiza con mintSignature
- [ ] El status es correcto en cada caso
- [ ] La notificación llega al frontend con datos correctos
- [ ] El histórico muestra el mint_signature

### Código Legacy (Referencia)

```typescript
// L375-450 del legacy - cómo lo hacía originalmente
```

---

## TICKET #3 - getPurchaseHistory() debe retornar tokenAmount correcto

**Prioridad:** 🔴 CRÍTICA  
**Dependencia:** ← Ticket #1, #2  
**Ubicación:** [apps/api/src/controllers/purchase/PurchaseController.ts](apps/api/src/controllers/purchase/PurchaseController.ts) L1927+

### Problema

```typescript
const history = await transactionRepository.find({ walletAddress });
// ACTUAL: Los items retornan tokenAmount = null si mint está pendiente
// DEBERÍA: Retornar SIEMPRE el tokenAmount (del request original)
```

### Qué Hacer

1. **Verificar que tokenAmount siempre se guarda** en DB (en initiatePurchase)
2. **Retornar el tokenAmount original** aunque mint esté pendiente
3. **Agregar campos al response**:
   - `token_amount`: número original (SIEMPRE)
   - `mint_signature`: string | null (puede ser null si mint pendiente)
   - `mint_status`: "pending" | "success" | "failed"
4. **Frontend puede mostrar**: "Esperando tokens..." en lugar de cantidad null

### Verificación

- [ ] Todas las transacciones muestran tokenAmount
- [ ] El frontend recibe estructura correcta
- [ ] Ningún amount es null en el response

### Estructura Esperada

```typescript
{
  transactionId: "uuid",
  walletAddress: "addr",
  tokenAmount: 100,              // ← NUNCA NULL
  paymentAmount: 1.0,
  signature: "sig...",
  mintSignature: "mint..." | null,  // ← PUEDE SER NULL
  mintStatus: "success" | "pending" | "failed",
  status: "success" | "pending",
  createdAt: ISO8601
}
```

---

## TICKET #4 - Crear endpoint settlePurchase() para retry manual

**Prioridad:** 🟠 ALTA  
**Dependencia:** ← Ticket #1  
**Ruta:** `POST /purchase/settle/:transactionId`

### Problema

```typescript
// LEGACY tenía: POST /purchase/settle/:transactionId
// ACTUAL no tiene esta ruta
// IMPACTO: Si mint falla, no hay forma de reintentarlo
```

### Qué Hacer

1. **Crear endpoint** que permita retry de mint
2. **Validaciones**:
   - La transacción existe
   - El status no es "success" (o status === "pending_mint")
   - No está ya siendo procesada (minting = true)
3. **Lógica**:
   - Llamar `updateTokenBalance()` nuevamente
   - Actualizar DB con nuevo mintSignature
   - Retornar resultado

### Ruta

```
POST /api/v1/purchase/settle/:transactionId
Headers: Authorization: Bearer $JWT
Body: { }
```

### Response

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "status": "success",
    "mintSignature": "sig...",
    "tokenAmount": 100
  }
}
```

### Verificación

- [ ] Endpoint crea y funciona
- [ ] Validaciones funcionan correctamente
- [ ] Se retira en histórico con éxito
- [ ] Los logs muestran el retry attempt

---

## TICKET #5 - Agregar verificación on-chain de mint

**Prioridad:** 🟠 ALTA  
**Dependencia:** ← Ticket #1  
**Ubicación:** [apps/api/src/controllers/purchase/PurchaseController.ts](apps/api/src/controllers/purchase/PurchaseController.ts)

### Problema

```typescript
// ACTUAL: No verifica si el mint fue realmente ejecutado en blockchain
// LEGACY: Tenía lógica de verificación en verifyOnChainMint()
```

### Qué Hacer

1. **Crear función `verify_on_chain_mint()`** que:
   - Consulta el wallet en blockchain
   - Verifica que el token balance aumentó
   - Verifica que es el monto correcto
2. **Llamar esta función** antes de marcar como "success"
3. **Manejar casos edge**:
   - Token aún no visible en blockchain (esperar X segundos)
   - Mint parcial (solo parte del monto)
   - Mint a cuenta equivocada

### Verificación

- [ ] La función verifica correctamente
- [ ] El balance on-chain coincide con DB
- [ ] Hay reintento si está pendiente
- [ ] Los logs muestran el resultado de verificación

---

## TICKET #6 - Sincronizar metadata de transacciones

**Prioridad:** 🟠 ALTA  
**Dependencia:** ← Ticket #1, #2  
**Modelos:** Prisma Transaction schema

### Problema

```typescript
// LEGACY guardaba en metadata todo el contexto
// ACTUAL está incompleto
// IMPACTO: Auditoría y debugging difícil
```

### Campos a Guardar en metadata

```typescript
{
  "initiateTimestamp": "ISO8601",
  "confirmTimestamp": "ISO8601",
  "settleTimestamp": "ISO8601",
  "paymentMethod": "SOL|USDC|stripe",
  "paymentProcessor": "solana|coingate",
  "pricePerToken": 0.01,
  "pricingMode": "bonding|fixed",
  "bondingCurveState": { supply, price },
  "slippage": 2.5,
  "gasEstimate": 0.0015,
  "actualGasUsed": 0.00145,
  "blockSlot": 123456,
  "rpcUrl": "https://...",
  "retryAttempts": 0,
  "retryReasons": []
}
```

### Qué Hacer

1. **En initiatePurchase**: Guardar initiateTimestamp, pricing info
2. **En confirmPurchase**: Guardar confirmTimestamp, actual gas
3. **En settlePurchase**: Guardar settleTimestamp, blockSlot
4. **Mantener histórico** de intentos fallidos

### Verificación

- [ ] Los metadatos se guardan completos
- [ ] Se pueden auditar todas las transacciones
- [ ] El debugging es posible con la información

---

## TICKET #7 - Arreglar broadcast notifications

**Prioridad:** 🟠 ALTA  
**Dependencia:** ← Ticket #2  
**Ubicación:** [apps/api/src/services/notifications/notifications.service.ts](apps/api/src/services/notifications/notifications.service.ts)

### Problema

```typescript
// LEGACY retransmitía con tokenAmount VERIFICADO
// ACTUAL retransmite SIN verificación de mint
// IMPACTO: Frontend recibe eventos con datos incompletos
```

### Eventos a Arreglar

1. **purchase.initiated**: ✅ Ya correcto
2. **purchase.confirmed**: ✅ Agregar blockSlot
3. **purchase.settled**: 🔴 Agregar mintSignature + tokenAmount
4. **purchase.failed**: 🔴 Agregar motivo del fallo

### Estructura de Evento (Correcto)

```typescript
interface PurchaseConfirmedEvent {
  transactionId: string;
  walletAddress: string;
  tokenAmount: number; // ← VERIFICADO
  paymentAmount: number;
  signature: string;
  blockSlot: number;
  mintSignature: string | null;
  status: "success" | "pending" | "failed";
  timestamp: number;
}
```

### Verificación

- [ ] Todos los eventos tienen structure correcta
- [ ] El frontend recibe los eventos completos
- [ ] Los logs muestran qué se broadcast

---

## TICKET #8 - Refactorizar PurchaseController por modularidad

**Prioridad:** 🟡 MEDIA  
**Ubicación:** [apps/api/src/controllers/purchase/PurchaseController.ts](apps/api/src/controllers/purchase/PurchaseController.ts) (1372 líneas)

### Problema

```typescript
// El archivo tiene 1372 líneas (MÁXIMO PERMITIDO: 200)
// Tiene 15 funciones (MÁXIMO POR FUNCIÓN: 40 líneas)
// VIOLACIONES: Código size + modularidad
```

### Plan de Refactorización

Dividir en módulos siguiendo snake_case:

```
controllers/purchase/
├── purchase_controller.ts          (orchestrator, <50 líneas)
├── purchase_initiate_handler.ts    (initiate logic, <40 líneas)
├── purchase_confirm_handler.ts     (confirm logic, <40 líneas)
├── purchase_settle_handler.ts      (settle logic, <40 líneas)
├── purchase_history_handler.ts     (history logic, <40 líneas)
└── purchase_validators.ts          (Zod schemas)
```

Cada archivo: **máx 200 líneas**, funciones: **máx 40 líneas**

### Verificación

- [ ] Cada archivo < 200 líneas
- [ ] Cada función < 40 líneas
- [ ] Los nombres están en snake_case
- [ ] Los tests siguen pasando

---

## TICKET #9 - Reemplazar console.log() con logger

**Prioridad:** 🟡 MEDIA  
**Ubicación:** [apps/api/src/controllers/purchase/PurchaseController.ts](apps/api/src/controllers/purchase/PurchaseController.ts)

### Problema

```typescript
// Múltiples console.log() en código de producción
// REGLA: No usar console.log en producción
// USAR: logger.info(), logger.warn(), logger.error()
```

### console.log encontrados

- Line 10+ : Múltiples en settlement.service
- Line 118+ : Múltiples en withdraw-processor
- Line 167+ : En purchase-settlement.worker

### Qué Hacer

1. **Reemplazar todos los console.log()** con `logger.info()`
2. **Usar logger.error()** para errores
3. **Usar logger.warn()** para advertencias
4. **Incluir siempre requestId** en los logs

### Verificación

- [ ] No hay console.log() en código de producción
- [ ] Los logs tienen requestId
- [ ] Los logs tienen contexto suficiente

---

## TICKET #10 - Crear tests E2E para purchase flow

**Prioridad:** 🟡 MEDIA  
**Ubicación:** [apps/api/**tests**/purchase.e2e.test.ts](apps/api/__tests__/purchase.e2e.test.ts) (NUEVO)

### Problema

```typescript
// No hay tests E2E del flujo completo de compra
// ACTUAL: Solo unit tests
// IMPACTO: Regressions no se detectan
```

### Tests a Crear (TDD)

```typescript
describe("Purchase Flow E2E", () => {
  describe("initiatePurchase", () => {
    it("should initiate purchase with correct token amount");
    it("should return txBase64 valid");
    it("should create transaction in DB");
  });

  describe("confirmPurchase", () => {
    it("should confirm with valid signature");
    it("should mint tokens to wallet");
    it("should save mintSignature in DB");
  });

  describe("getPurchaseHistory", () => {
    it("should return all purchases for wallet");
    it("should include tokenAmount in every item");
    it("should show mint_signature when available");
  });

  describe("Error Scenarios", () => {
    it("should handle mint failure gracefully");
    it("should allow retry on failed mint");
    it("should mark failed purchases correctly");
  });
});
```

### Coverage

- Mínimo 80% global, 100% en purchase handlers
- [Ver vitest.config.ts](vitest.config.ts#L25-L40)

### Verificación

- [ ] Todos los tests pasan
- [ ] Coverage >= 80%
- [ ] Edge cases cubiertos

---

## 📅 ROADMAP DE EJECUCIÓN

```
Día 1:
  ✓ TICKET #1: updateTokenBalance retorna firma        (1h)
  ✓ TICKET #2: confirmPurchase registra firma          (1h)

Día 2:
  ✓ TICKET #3: getPurchaseHistory siempre retorna amount (1h)
  ✓ TICKET #4: Crear endpoint settlePurchase            (1.5h)

Día 3:
  ✓ TICKET #5: Verificación on-chain de mint            (2h)
  ✓ TICKET #6: Sincronizar metadata completa            (1h)

Día 4:
  ✓ TICKET #7: Arreglar broadcasts                       (1.5h)
  ✓ TICKET #9: Reemplazar console.log()                 (1h)

Día 5:
  ✓ TICKET #8: Refactorizar por modularidad             (3h)
  ✓ TICKET #10: Tests E2E                               (2h)

TOTAL: ~16 horas
```

---

## 🔗 REFERENCIAS

- **Legacy Purchase Controller:** `.legacy/api/src/controllers/purchase/PurchaseController.ts`
- **Legacy Routes:** `.legacy/api/src/routes/purchase/purchase.routes.ts` (1138 líneas)
- **Current Controller:** `apps/api/src/controllers/purchase/PurchaseController.ts` (1372 líneas)
- **Copilot Instructions:** [.github/copilot-instructions.md](.github/copilot-instructions.md)
- **Prisma Schema:** `apps/api/prisma/schema.prisma`
