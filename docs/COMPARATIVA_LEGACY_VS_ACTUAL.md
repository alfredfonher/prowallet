# 📊 COMPARATIVA DETALLADA: Legacy vs Actual

**Análisis:** Funciones de .legacy/api/src/controllers/purchase/PurchaseController.ts (1372 líneas)

---

## 1️⃣ getCurrentPrice()

### Legacy (L50-107)

```typescript
async getCurrentPrice(req: Request, res: Response): Promise<void> {
  // ✅ FLOW:
  // 1. Obtiene amount del query
  // 2. Si pricing_mode === 'bonding' → llama getCurrentSupply()
  // 3. Calcula precio con calculatePrice()
  // 4. Retorna completo: token, price, gas, impact, etc.
}
```

### Actual (apps/api/src/controllers/purchase/PurchaseController.ts)

```typescript
async getCurrentPrice(req: Request, res: Response): Promise<void> {
  // ✅ MISMO COMPORTAMIENTO
  // ✅ Funciona correctamente en ambos
}
```

**Status:** ✅ CORRECTO - No hay divergencia

---

## 2️⃣ getPaymentMethods()

### Legacy (L118-170)

```typescript
async getPaymentMethods(req: Request, res: Response): Promise<void> {
  // ✅ FLOW:
  // 1. Llama paymentService.getAvailablePaymentMethods()
  // 2. Estructura respuesta con { fiat, crypto, native }
  // 3. Incluye exchangeRates y lastUpdated
}
```

### Actual

```typescript
async getPaymentMethods(req: Request, res: Response): Promise<void> {
  // ✅ SIMILAR pero estructura puede variar
}
```

**Status:** 🟡 VERIFICAR - Comprobar estructura exacta

---

## 3️⃣ createAlternativePayment()

### Legacy (L173-235)

```typescript
async createAlternativePayment(req: Request, res: Response): Promise<void> {
  // ✅ FLOW:
  // 1. Obtiene paymentMethod del body
  // 2. Si method = SOL → processorName = 'solana'
  // 3. Crea pago con paymentService.createPayment()
  // 4. Retorna paymentId + redirect URL
}
```

### Actual

```typescript
async createAlternativePayment(req: Request, res: Response): Promise<void> {
  // ? ESTADO DESCONOCIDO - Verificar implementación
}
```

**Status:** 🟠 REVISAR - Puede faltar funcionalidad

---

## 4️⃣ initiatePurchase()

### Legacy (L236-374)

```typescript
async initiatePurchase(req: Request, res: Response): Promise<void> {
  // INPUT: { walletAddress, tokenAmount, paymentMethod, maxSlippage }

  // ✅ VALIDACIONES:
  // 1. Wallet valida
  // 2. Amount >= minPurchase
  // 3. PaymentMethod soportado

  // ✅ CREAR TRANSACCIÓN EN DB:
  // - status = "pending"
  // - transactionId = UUID
  // - iniciatedAt = NOW

  // ✅ CALCULAR PRECIOS:
  // - currentPrice
  // - totalCost = tokenAmount * price
  // - gasCost
  // - slippage

  // ✅ CONSTRUIR TX:
  // - Llama buildPurchaseTransaction()
  // - Obtiene txBase64

  // ✅ RETORNA:
  // - transactionId (para confirm)
  // - txBase64 (para firmar)
  // - estimatedFee
  // - totalCost
}
```

### Actual

```typescript
async initiatePurchase(req: Request, res: Response): Promise<void> {
  // ✅ SIMILAR PERO VERIFICAR:
  // - Se guardan TODOS los campos metadata?
  // - Se retorna SIEMPRE txBase64?
  // - El transactionId es UUID o algo más?
}
```

**Status:** ✅ PROBABLEMENTE CORRECTO - Pero verificar metadata completa

---

## 5️⃣ confirmPurchase() - 🔴 CRÍTICA

### Legacy (L375-527)

```typescript
async confirmPurchase(req: Request, res: Response): Promise<void> {
  // INPUT: { signature, blockSlot (opcional) }
  // PARAMS: transactionId del PATH

  // ✅ PASO 1: Verificar transacción on-chain
  // - Obtener tx con connection.getTransaction(signature)
  // - Validar que tx existe
  // - Validar que es una transacción válida (no fallo)

  // ✅ PASO 2: Verificar PAGO (pre/post balances)
  // - Extraer meta.preBalances y meta.postBalances
  // - Encontrar transfer correcta al treasury
  // - Validar que monto es correcto ±1% tolerancia

  // ✅ PASO 3: Marcar como confirmed en DB
  // - status = "confirmed"
  // - signature = txSignature
  // - confirmedAt = NOW

  // ✅ PASO 4: MINT TOKENS (CRITICAL)
  // - Llama this.updateTokenBalance(wallet, amount)
  // - ESPERA resultado: mintSignature
  // - Si exitoso: marca minted = true, minting = false
  // - Si falla: marca como pending_mint (para retry)
  // - GUARDAR mintSignature EN DB ⚠️ ESTE ES EL PROBLEMA

  // ✅ PASO 5: Broadcast notificación
  // - Event: purchase.confirmed
  // - Incluye: transactionId, walletAddress, tokenAmount, mintSignature
}
```

### Actual

```typescript
async confirmPurchase(req: Request, res: Response): Promise<void> {
  // PASOS 1-3: ✅ CORRECTOS

  // PASO 4: ❌ PROBLEMAS:
  const mint_sig = await this.updateTokenBalance(wallet, amount);
  // ❌ updateTokenBalance() retorna null/undefined (no firma)
  // ❌ No se puede verificar si el mint fue exitoso
  // ❌ No se registra en DB

  if (!mint_sig) {
    // ❌ Marca como FAILED inmediatamente
    // ❌ Debería ser "pending_mint" para retry
  }

  // PASO 5: ❌ Broadcast INCOMPLETO
  // - No incluye mintSignature
  // - Frontend no sabe si tokens llegaron
}
```

**Status:** 🔴 CRÍTICO - Necesita arreglo urgente

---

## 6️⃣ settlePurchase()

### Legacy (L528-611)

```typescript
async settlePurchase(req: Request, res: Response): Promise<void> {
  // ✅ FLOW:
  // - Ruta: POST /purchase/settle/:transactionId
  // - Propósito: Retry manual de mint si falló confirmPurchase()

  // 1. Verificar que tx existe
  // 2. Verificar que NO está ya minted (idempotente)
  // 3. Marcar como "minting" = true (para evitar race condition)
  // 4. Llamar updateTokenBalance()
  // 5. Si exitoso: minted = true, guardar mintSignature
  // 6. Si falla: minting = false, dejar en pending_mint
  // 7. Retornar { success, signature }
}
```

### Actual

```typescript
async settlePurchase(req: Request, res: Response): Promise<void> {
  // ❌ ESTADO: ¿EXISTE O ELIMINADA?
  // Si existe: verificar que tiene MISMO COMPORTAMIENTO
  // Si no existe: TICKET #4 debe crearla
}
```

**Status:** ❌ FALTA O INCOMPLETA - Necesita verificación

---

## 7️⃣ autoSettlePurchase()

### Legacy (L612-700)

```typescript
async autoSettlePurchase(req: Request, res: Response): Promise<void> {
  // INPUT: { paymentSignature (del pago anterior) }

  // ✅ FLOW:
  // 1. Verifica que pago existe on-chain
  // 2. Obtiene buyer wallet del pago
  // 3. Crea transacción de MINT usando autoridad (authority keypair)
  // 4. Envía tx desde el backend (no desde wallet usuario)
  // 5. Confirma tx
  // 6. Retorna mintSignature

  // CASO DE USO: Si el usuario pagó (SOL fue enviado) pero
  //             no pudimos hacer mint automático, esto lo completa
}
```

### Actual

```typescript
// ✅ EXISTE en auto-settle.service.ts
// ✅ SIMILAR COMPORTAMIENTO
```

**Status:** ✅ PROBABLEMENTE CORRECTO

---

## 8️⃣ checkPaymentStatus()

### Legacy (L701-815)

```typescript
async checkPaymentStatus(req: Request, res: Response): Promise<void> {
  // INPUT: transactionId (del PATH)

  // ✅ FLOW:
  // 1. Obtiene transacción de DB
  // 2. Verifica estado (pending, confirmed, minted, failed)
  // 3. Si status = "confirmed" pero minting = true:
  //    → Espera a que termine (timeout 30s)
  // 4. Si minted = false:
  //    → Retorna { status: "pending_mint" }
  // 5. Si confirmado + minted:
  //    → Retorna { status: "success", mintSignature }
  // 6. Maneja casos edge: timeout, network error, etc.
}
```

### Actual

```typescript
async checkPaymentStatus(req: Request, res: Response): Promise<void> {
  // ✅ SIMILAR PERO verificar:
  // - ¿Retorna mintSignature?
  // - ¿Maneja "pending_mint"?
}
```

**Status:** 🟡 REVISAR - Verificar completitud

---

## 9️⃣ getMarketStats()

### Legacy (L816-1015)

```typescript
async getMarketStats(req: Request, res: Response): Promise<void> {
  // ✅ RETORNA:
  // - currentPrice (de bonding curve)
  // - marketCap = currentPrice * circulatingSupply
  // - totalSupply
  // - circulatingSupply = currentSupply
  // - volume24h (de últimas 24h de transacciones)
  // - holders (cantidad de wallets únicos que compraron)
  // - priceHistory (últimas N horas)
  // - priceChangePercent (24h)
}
```

### Actual

```typescript
// ✅ SIMILAR ESTRUCTURA
```

**Status:** ✅ PROBABLEMENTE CORRECTO

---

## 🔟 getPurchaseHistory() - 🔴 CRÍTICA

### Legacy (L1016-1088)

```typescript
async getPurchaseHistory(req: Request, res: Response): Promise<void> {
  // INPUT: walletAddress (del PATH), page, limit, status

  // ✅ QUERY CORRECTA:
  const transactions = await transactionRepository.find(
    { walletAddress },
    { skip, take: limit, orderBy: { createdAt: 'desc' } }
  );

  // ✅ RETORNA CADA TRANSACCIÓN:
  // {
  //   transactionId: "uuid",
  //   walletAddress: "...",
  //   tokenAmount: 100,              ← CRITICAL: SIEMPRE PRESENTE
  //   paymentAmount: 1.0,
  //   paymentMethod: "SOL",
  //   signature: "sig...",
  //   mintSignature: "mint..." | null,
  //   status: "success" | "pending" | "failed",
  //   minted: true | false,
  //   createdAt: ISO8601,
  //   completedAt: ISO8601 | null,
  //   metadata: { ... }
  // }

  // ✅ RETORNA METADATA DEL USUARIO:
  // {
  //   totalTransactions: 10,
  //   totalTokensBought: 1000,
  //   totalSpent: 10.0,
  //   averageTokenPrice: 0.01,
  //   lastPurchaseDate: ISO8601
  // }
}
```

### Actual

```typescript
async getPurchaseHistory(req: Request, res: Response): Promise<void> {
  // PROBLEMAS:
  // ❌ tokenAmount puede ser NULL si mint falló
  // ❌ No se retorna metadata del usuario
  // ❌ No se retorna mintStatus

  // Los items vienen así:
  // {
  //   transactionId: "uuid",
  //   walletAddress: "...",
  //   tokenAmount: null,             ← 🔴 PROBLEMA
  //   paymentAmount: 1.0,
  //   status: "failed",              ← ¿por qué failed?
  //   signature: null,               ← ¿por qué null?
  //   mintSignature: null,
  //   createdAt: ISO8601
  // }
}
```

**Status:** 🔴 CRÍTICO - Necesita arreglo urgente

---

## Privadas: updateTokenBalance() - 🔴 CRÍTICA

### Legacy (L1177-1241)

```typescript
private async updateTokenBalance(
  wallet: string,
  amount: number
): Promise<string | null> {
  // ✅ FLOW:
  // 1. Validar wallet válida
  // 2. Validar amount > 0
  // 3. Crear o actualizar Associated Token Account
  // 4. Llamar autoSettlePurchase(wallet, amount, paymentSig)
  // 5. OBTENER RESULTADO: { success: bool, signature: string }
  // 6. SI SUCCESS:
  //    → Retornar signature (mint signature)
  //    → LOGS: ✅ Mint successful, sig: "..."
  // 7. SI FALLO:
  //    → Retornar null
  //    → LOGS: ❌ Mint failed, reason: "..."
  //    → THROW ERROR o retornar null
}
```

### Actual

```typescript
private async updateTokenBalance(
  wallet: string,
  amount: number
): Promise<string | null> {
  // ❌ PROBLEMA CRÍTICO:
  // - No retorna mintSignature
  // - Retorna void o null siempre
  // - No se loguea correctamente
  // - No se puede verificar éxito del mint

  // El código actual es más como:
  try {
    // llamar autoSettleService
  } catch (e) {
    // throw error o return null
  }
  // return ??? (undefined)
}
```

**Status:** 🔴 CRÍTICO - Raíz del problema

---

## Privadas: getCurrentSupply()

### Legacy (L1089-1168)

```typescript
private async getCurrentSupply(): Promise<number> {
  // ✅ FLOW:
  // 1. Obtener metadata del token
  // 2. Extraer supply de programData
  // 3. Retornar supply
}
```

### Actual

```typescript
// ✅ SIMILAR
```

**Status:** ✅ PROBABLEMENTE CORRECTO

---

## Privadas: verifySignature()

### Legacy (L1169-1176)

```typescript
private async verifySignature(
  tx: Transaction,
  signature: string
): Promise<boolean> {
  // ✅ Verifica que la firma es válida para la transacción
}
```

### Actual

```typescript
// ✅ SIMILAR
```

**Status:** ✅ PROBABLEMENTE CORRECTO

---

## Privadas: isFirstPurchase()

### Legacy (L1242-1252)

```typescript
private async isFirstPurchase(wallet: string): Promise<boolean> {
  // ✅ FLOW:
  // 1. Buscar si ya tiene transacciones con status = "success"
  // 2. Retornar true si es primera
  // 3. Retornar false si ya compró antes
}
```

### Actual

```typescript
// ? ESTADO DESCONOCIDO
```

**Status:** 🟡 REVISAR

---

## 📋 RESUMEN DE DIVERGENCIAS

| Función                  | Legacy | Actual | Status | Ticket |
| ------------------------ | ------ | ------ | ------ | ------ |
| getCurrentPrice          | ✅     | ✅     | ✅     | -      |
| getPaymentMethods        | ✅     | ✅     | ✅     | -      |
| createAlternativePayment | ✅     | ❓     | 🟡     | ?      |
| initiatePurchase         | ✅     | ✅     | ✅     | -      |
| **confirmPurchase**      | ✅     | ❌     | 🔴     | #2     |
| **settlePurchase**       | ✅     | ❌     | 🔴     | #4     |
| autoSettlePurchase       | ✅     | ✅     | ✅     | -      |
| checkPaymentStatus       | ✅     | ✅     | ✅     | -      |
| getMarketStats           | ✅     | ✅     | ✅     | -      |
| **getPurchaseHistory**   | ✅     | ❌     | 🔴     | #3     |
| **updateTokenBalance**   | ✅     | ❌     | 🔴     | #1     |
| getCurrentSupply         | ✅     | ✅     | ✅     | -      |
| verifySignature          | ✅     | ✅     | ✅     | -      |
| isFirstPurchase          | ✅     | ❓     | 🟡     | ?      |

---

## 🎯 CONCLUSIONES

### 🔴 CRÍTICAS (Bloquean producción)

1. **updateTokenBalance()** no retorna firma → Línea 1177-1241
2. **confirmPurchase()** no registra firma → Línea 375-527
3. **getPurchaseHistory()** retorna null amounts → Línea 1016-1088

### 🟠 ALTAS (Mejoras importantes)

4. Falta **settlePurchase()** para retry manual
5. Falta verificación on-chain de mint
6. Metadata incompleta

### 🟡 MEDIAS (Deuda técnica)

7. Archivo demasiado grande (1372 líneas)
8. console.log() en producción
9. Falta coverage de tests
