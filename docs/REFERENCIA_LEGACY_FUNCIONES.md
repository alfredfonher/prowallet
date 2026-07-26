# 📋 REFERENCIA RÁPIDA - FUNCIONES LEGACY

**Documento de referencia:** Todas las funciones en `.legacy/api/src/controllers/purchase/PurchaseController.ts`

---

## 🔍 BÚSQUEDA RÁPIDA

### Función: getCurrentPrice()

**Líneas Legacy:** 50-107  
**Propósito:** Calcular precio actual del token (bonding curve)  
**Llamada desde:** GET /purchase/price?amount=100  
**Retorna:**

```json
{
  "tokenAmount": 100,
  "pricePerToken": 0.0123,
  "totalCost": 1.23,
  "gasCost": 0.0015,
  "priceImpact": 2.5,
  "nextPrice": 0.0125,
  "slippage": 2.5,
  "currentSupply": 500000,
  "availableSupply": 499500
}
```

**Status:** ✅ NO CAMBIAR - Funciona bien

---

### Función: getPaymentMethods()

**Líneas Legacy:** 118-170  
**Propósito:** Retornar métodos de pago disponibles  
**Llamada desde:** GET /purchase/payment-methods  
**Retorna:**

```json
{
  "fiat": {
    "creditCard": { "available": true, "processors": ["stripe", ...] },
    "debitCard": { "available": false }
  },
  "crypto": {
    "available": true,
    "allCurrencies": ["SOL", "USDC", "BTC"]
  },
  "native": {
    "solana": { "available": true, "currencies": ["SOL"] }
  },
  "lastUpdated": "2025-12-15T10:30:00Z"
}
```

**Status:** ✅ PROBABLEMENTE OK - Verificar en actual

---

### Función: createAlternativePayment()

**Líneas Legacy:** 173-235  
**Propósito:** Crear pago por método alternativo (stripe, coingate, etc)  
**Llamada desde:** POST /purchase/payment (método alternativo)  
**Recibe:**

```json
{
  "paymentMethod": "stripe",
  "tokenAmount": 100,
  "walletAddress": "abc123...",
  "email": "user@example.com"
}
```

**Retorna:**

```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "redirectUrl": "https://stripe.com/checkout/...",
    "expiresAt": "2025-12-15T11:30:00Z"
  }
}
```

**Status:** 🟡 REVISAR - Puede no estar en actual

---

### Función: initiatePurchase() ⭐

**Líneas Legacy:** 236-374  
**Propósito:** Iniciar el flujo de compra - PRIMER PASO  
**Llamada desde:** POST /purchase/initiate  
**Recibe:**

```json
{
  "walletAddress": "EPjFWarath3gkooPQtq...",
  "tokenAmount": 1000,
  "paymentMethod": "SOL",
  "maxSlippage": 2.5
}
```

**Proceso:**

1. Valida wallet
2. Valida monto (min/max)
3. Calcula precio dinámico
4. Crea registro en DB (status: "pending")
5. Construye transacción SOL
6. Retorna txBase64 para firmar
   **Retorna:**

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-1234",
    "txBase64": "AQAAAAAA...(base64 encoded transaction)...==",
    "estimatedFee": 0.0015,
    "totalCost": 12.345,
    "walletAddress": "EPjFWarath3gkooPQtq...",
    "tokenAmount": 1000,
    "pricePerToken": 0.01234
  }
}
```

**Status:** ✅ PROBABLEMENTE CORRECTO

---

### Función: confirmPurchase() ⭐⭐⭐ CRÍTICA

**Líneas Legacy:** 375-527  
**Propósito:** Confirmar pago ON-CHAIN y ejecutar mint - SEGUNDO PASO  
**Llamada desde:** POST /purchase/confirm/:transactionId  
**Recibe:**

```json
{
  "signature": "4z6LwsWP...(transaction signature from blockchain)...Z3x",
  "blockSlot": 245891234
}
```

**Proceso Crítico:**

1. Valida que tx existe en blockchain con esa firma
2. Verifica que es una transferencia SOL al treasury
3. Verifica que el monto es correcto (±1% tolerancia)
4. **LLAMA updateTokenBalance()** ← AQUÍ ES EL PROBLEMA
5. Registra mintSignature en DB ← FALTA EN ACTUAL
6. Broadcast notificación con tokenAmount ← INCOMPLETO EN ACTUAL

**Retorna:**

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-1234",
    "status": "success",
    "signature": "4z6LwsWP...",
    "mintSignature": "5A9pXvZq...",
    "tokenAmount": 1000,
    "blockSlot": 245891234,
    "completedAt": "2025-12-15T10:30:00Z"
  }
}
```

**Status:** 🔴 CRÍTICO - Necesita TICKET #1 y #2

---

### Función: settlePurchase() ⭐⭐ IMPORTANT

**Líneas Legacy:** 528-611  
**Propósito:** Retry manual de mint si confirmPurchase falló  
**Llamada desde:** POST /purchase/settle/:transactionId  
**Recibe:** (vacío)  
**Proceso:**

1. Verifica que tx existe
2. Verifica que NO está ya minted
3. **Reintenta updateTokenBalance()**
4. Si exitoso: marca como minted
5. Si falla: marca como pending_mint

**Retorna:**

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-1234",
    "mintSignature": "5A9pXvZq...",
    "status": "success"
  }
}
```

**Status:** ❌ FALTA EN ACTUAL - Necesita TICKET #4

---

### Función: autoSettlePurchase()

**Líneas Legacy:** 612-700  
**Propósito:** Auto-settle desde backend (si pago existe pero mint no)  
**Llamada desde:** POST /purchase/auto-settle  
**Recibe:**

```json
{
  "paymentSignature": "4z6LwsWP...(del pago anterior)...Z3x"
}
```

**Proceso:**

1. Verifica que transacción de pago existe on-chain
2. Extrae buyer del memo o accounts
3. Busca transaction en DB
4. Ejecuta mint usando authority keypair
5. Confirma tx

**Retorna:**

```json
{
  "success": true,
  "data": {
    "mintSignature": "5A9pXvZq...",
    "tokenAmount": 1000
  }
}
```

**Status:** ✅ EXISTE - Probablemente OK

---

### Función: checkPaymentStatus()

**Líneas Legacy:** 701-815  
**Propósito:** Verificar estado actual de un pago  
**Llamada desde:** GET /purchase/status/:transactionId  
**Retorna:**

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-1234",
    "status": "success",
    "substatus": "minted",
    "signature": "4z6LwsWP...",
    "mintSignature": "5A9pXvZq...",
    "tokenAmount": 1000,
    "initiatedAt": "2025-12-15T10:00:00Z",
    "confirmedAt": "2025-12-15T10:15:00Z",
    "mintedAt": "2025-12-15T10:16:00Z"
  }
}
```

**Status:** ✅ PROBABLEMENTE OK

---

### Función: getMarketStats()

**Líneas Legacy:** 816-1015  
**Propósito:** Obtener estadísticas del mercado de PROWALLET  
**Llamada desde:** GET /purchase/market-stats  
**Retorna:**

```json
{
  "success": true,
  "data": {
    "currentPrice": 0.0123,
    "priceChange24h": 2.5,
    "marketCap": 12345000,
    "totalSupply": 1000000000000000000,
    "circulatingSupply": 500000000000000000,
    "volume24h": 50000,
    "holders": 1234,
    "priceHistory": [
      { "timestamp": "2025-12-15T10:00:00Z", "price": 0.012 },
      { "timestamp": "2025-12-15T11:00:00Z", "price": 0.0123 }
    ],
    "bondingCurve": {
      "basePrice": 0.036483,
      "currentSupply": 500000,
      "multiplier": 1.5
    }
  }
}
```

**Status:** ✅ PROBABLEMENTE OK

---

### Función: getPurchaseHistory() ⭐⭐⭐ CRÍTICA

**Líneas Legacy:** 1016-1088  
**Propósito:** Obtener histórico de compras del usuario  
**Llamada desde:** GET /purchase/history?limit=10&offset=0  
**Retorna:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionId": "uuid-1234",
        "walletAddress": "EPjFWarath3gkooPQtq...",
        "tokenAmount": 1000,          // ← CRÍTICO: NUNCA NULL
        "paymentAmount": 12.34,
        "paymentMethod": "SOL",
        "signature": "4z6LwsWP...",
        "mintSignature": "5A9pXvZq...",
        "status": "success",
        "minted": true,
        "createdAt": "2025-12-15T10:00:00Z",
        "completedAt": "2025-12-15T10:16:00Z",
        "metadata": { ... }
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "hasMore": true
    },
    "summary": {
      "totalTransactions": 100,
      "totalTokensBought": 123456,
      "totalSpent": 1234.56,
      "averageTokenPrice": 0.01
    }
  }
}
```

**Status:** 🔴 CRÍTICO - tokenAmount es NULL - Necesita TICKET #3

---

## Funciones Privadas

### updateTokenBalance(wallet, amount)

**Líneas Legacy:** 1177-1241  
**Propósito:** Ejecutar mint de tokens usando autoridad  
**Retorna:** `Promise<string | null>` - LA FIRMA DEL MINT O NULL  
**Proceso:**

1. Validar wallet
2. Obtener/crear ATA
3. Llamar autoSettlePurchase()
4. **RETORNAR resultado.signature** ← FALTA EN ACTUAL
5. Si falla: retornar null

**Status:** 🔴 CRÍTICO - No retorna firma - Necesita TICKET #1

### getCurrentSupply()

**Líneas Legacy:** 1089-1168  
**Propósito:** Obtener supply actual del token (para bonding curve)  
**Retorna:** `Promise<number>`

### verifySignature(tx, signature)

**Líneas Legacy:** 1169-1176  
**Propósito:** Validar que una firma corresponde a una transacción  
**Retorna:** `Promise<boolean>`

### isFirstPurchase(wallet)

**Líneas Legacy:** 1242-1252  
**Propósito:** Verificar si es la primera compra del usuario  
**Retorna:** `Promise<boolean>`

---

## 📊 MATRIZ DE DEPENDENCIAS

```
initiatePurchase()
        ↓
confirmPurchase() ← updateTokenBalance()
        ↓                    ↑
        ├→ auto-settle ———→ |
        │
        └→ broadcast()

settlePurchase() ← updateTokenBalance()
        ↑
        └→ retry

getPurchaseHistory()
        ↓
        └→ read from DB (debe tener tokenAmount + mintSig)
```

**Orden de dependencias:**

1. updateTokenBalance() retorna firma
2. confirmPurchase() registra firma
3. getPurchaseHistory() usa firma
4. settlePurchase() reintenta
5. Broadcasts completos

---

## 🔧 HELPER UTILITIES EN LEGACY

### calculatePrice(tokenAmount, currentSupply)

Calcula precio dinámico usando bonding curve

### verifyOnChainMint(wallet, mintAddress, amount)

Verifica que el mint fue ejecutado correctamente

### buildPurchaseTransaction(buyer, amount, treasury)

Construye la transacción SOL para pago

### buildMintTransaction(buyer, tokenAmount)

Construye la transacción para hacer mint de tokens

---

## 📞 VALIDADORES (Zod schemas)

En `.legacy/api/src/controllers/purchase/PurchaseController.ts` se definen validadores:

- `getCurrentPrice_validators`
- `initiatePurchase_validators`
- `confirmPurchase_validators`
- `getPurchaseHistory_validators`

**Ubicación correcta:** `apps/api/src/controllers/purchase/purchase_validators.ts`
