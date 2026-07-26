# 📋 ANÁLISIS DE MIGRACIÓN: Legacy → Apps

**Fecha:** 15 Diciembre 2025  
**Estado:** 🔴 CRÍTICO - Historial de transacciones incorrecto, balance de tokens no actualizado en producción

---

## 🎯 PROBLEMA PRINCIPAL

En **producción (SSH)**: Las compras no registran correctamente la cantidad de tokens transferidos en el historial  
En **local**: Funciona pero sin histórico correcto de tokens

**Síntoma:** El endpoint `GET /purchase/history` muestra transacciones pero sin sincronizar el `tokenAmount` real transferido

---

## 📊 FUNCIONES HEREDADAS DE .legacy/api/src/controllers/purchase/PurchaseController.ts

### Métodos Públicos (Endpoints)

| #   | Función                      | Líneas    | Estado             | Prioridad  |
| --- | ---------------------------- | --------- | ------------------ | ---------- |
| 1   | `getCurrentPrice()`          | 50-107    | ✅ Mirado          | 🟡 Media   |
| 2   | `getPaymentMethods()`        | 118-170   | ✅ Mirado          | 🟡 Media   |
| 3   | `createAlternativePayment()` | 173-335   | ✅ Mirado          | 🟠 Alta    |
| 4   | `initiatePurchase()`         | 236-374   | ✅ Mirado          | 🔴 CRÍTICA |
| 5   | `confirmPurchase()`          | 375-527   | ❌ **DIVERGENCIA** | 🔴 CRÍTICA |
| 6   | `settlePurchase()`           | 528-611   | ❌ **DIVERGENCIA** | 🔴 CRÍTICA |
| 7   | `autoSettlePurchase()`       | 612-700   | ✅ Mirado          | 🟠 Alta    |
| 8   | `checkPaymentStatus()`       | 701-815   | ✅ Mirado          | 🟠 Alta    |
| 9   | `getMarketStats()`           | 816-1015  | ✅ Mirado          | 🟡 Media   |
| 10  | `getPurchaseHistory()`       | 1016-1088 | ❌ **DIVERGENCIA** | 🔴 CRÍTICA |

### Métodos Privados (Helpers)

| #   | Función                | Líneas    | Estado          | Uso                     |
| --- | ---------------------- | --------- | --------------- | ----------------------- |
| 11  | `fetchCurrentPrice()`  | 108-117   | ✅              | Obtener precio numérico |
| 12  | `getCurrentSupply()`   | 1089-1168 | ✅              | Bonding curve           |
| 13  | `verifySignature()`    | 1169-1176 | ✅              | Validación              |
| 14  | `updateTokenBalance()` | 1177-1241 | ❌ **CRITICAL** | Minter tokens           |
| 15  | `isFirstPurchase()`    | 1242-1252 | ✅              | Validación              |

### Validadores (Zod schemas)

| #   | Validador                               | Ubicación                  | Estado |
| --- | --------------------------------------- | -------------------------- | ------ |
| 16  | `purchaseValidators.getCurrentPrice`    | `.routes/purchase.ts:L60`  | ✅     |
| 17  | `purchaseValidators.getPaymentMethods`  | `.routes/purchase.ts:L180` | ✅     |
| 18  | `purchaseValidators.initiatePurchase`   | `.routes/purchase.ts:L220` | ✅     |
| 19  | `purchaseValidators.confirmPurchase`    | `.routes/purchase.ts:L310` | ✅     |
| 20  | `purchaseValidators.getPurchaseHistory` | `.routes/purchase.ts:L380` | ✅     |

---

## 🔍 DIVERGENCIAS CRÍTICAS ENCONTRADAS

### ⚠️ 1. updateTokenBalance() - TOKEN TRANSFER LOGIC

**Legacy (.legacy/api/src/controllers/purchase/PurchaseController.ts:1177)**

```typescript
private async updateTokenBalance(wallet: string, amount: number): Promise<string | null> {
  // ✅ Llamaba a autoSettleService directamente
  // ✅ Retornaba mintSignature para logging
  // ✅ Registraba en DB el mintSignature
}
```

**Actual (apps/api/src/controllers/purchase/PurchaseController.ts)**

```typescript
private async updateTokenBalance(wallet: string, amount: number): Promise<string | null> {
  // ❌ PROBLEMA: No retorna mintSignature
  // ❌ PROBLEMA: No logea el resultado
  // ❌ PROBLEMA: El historial no muestra el amount transferido
}
```

**Impacto:**

- En `confirmPurchase()`, sin `mintSignature` no se puede verificar si el mint fue exitoso
- El historial muestra `null` en lugar del monto real de tokens

---

### ⚠️ 2. confirmPurchase() - SETTLEMENT LOGIC

**Legacy (L375-527)**

```typescript
async confirmPurchase(req: Request, res: Response): Promise<void> {
  // 1. Verifica transacción on-chain (pre/post balances)
  // 2. Verifica balance transfer correcto
  // 3. Llama updateTokenBalance()
  // 4. REGISTRA mintSignature en DB
  // 5. Broadcast notificación con tokenAmount CORRECTO
}
```

**Actual (apps/api/src/controllers/purchase/PurchaseController.ts:L692-810)**

```typescript
async confirmPurchase(req: Request, res: Response): Promise<void> {
  // 1. ✅ Verifica transacción on-chain
  // 2. ✅ Verifica balance transfer
  // 3. ✅ Llama updateTokenBalance()
  // 4. ❌ NO REGISTRA mintSignature (null check falla)
  // 5. ❌ Broadcast SIN verificación del mint exitoso
}
```

**Issue:** Cuando `mintSig === null`, la transacción se marca como `FAILED` pero no se reintenta

---

### ⚠️ 3. getPurchaseHistory() - HISTORICAL DATA

**Legacy (L1016-1088)**

```typescript
async getPurchaseHistory(req: Request, res: Response): Promise<void> {
  // Retorna:
  // - transactionId
  // - walletAddress
  // - tokenAmount ✅ ALWAYS POPULATED
  // - signature
  // - status
  // - createdAt
}
```

**Actual (apps/api/src/controllers/purchase/PurchaseController.ts:L1927+)**

```typescript
async getPurchaseHistory(req: Request, res: Response): Promise<void> {
  // Retorna PERO:
  // - tokenAmount puede ser NULL si mint falló
  // - No distingue entre "pending mint" vs "failed mint"
  // - Frontend no sabe qué hacer con NULL amounts
}
```

**Issue:** El frontend en `apps/web` espera siempre un `tokenAmount` numérico

---

### ⚠️ 4. settlePurchase() - MANUAL SETTLE

**Legacy (L528-611)**

```typescript
async settlePurchase(req: Request, res: Response): Promise<void> {
  // POST /purchase/settle/:transactionId
  // - Verifica que NO esté minted
  // - Llama updateTokenBalance()
  // - Registra mintSignature
  // - Retorna success: true/false + signature
}
```

**Actual (apps/api/src/controllers/purchase/PurchaseController.ts:L1240+)**

```typescript
async settlePurchase(req: Request, res: Response): Promise<void> {
  // ❌ RUTA DIFERENTE o ELIMINADA
  // ❌ No se puede hacer settle manual desde frontend
  // ❌ Si confirmPurchase falla, no hay retry path
}
```

---

## 🎯 TICKETS DE RESOLUCIÓN

Se han creado **10 tickets** en orden de criticidad y dependencias.
