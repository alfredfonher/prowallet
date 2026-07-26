# Diagnóstico: Balance No Se Refleja Después de Compra

## Problema Reportado

- Compra se procesa exitosamente
- Status marcado como "completed"
- **Balance NO se refleja** (status nunca llega a "success")

## Root Cause Analysis

### Flujo Actual

```
1. POST /purchase/confirm/:transactionId
   └─ Ejecuta updateTokenBalance() → retorna signature o null

2. Si signature válida:
   └─ Marca status = "completed" ✅
   └─ Lanza background task: waitForMintConfirmationAndMarkSuccess()

3. Background task:
   └─ Espera confirmación de mint (120s, 15 reintentos)
   └─ Cuando se confirma → Marca status = "success"
   └─ **AQUÍ** es cuando balance se refleja
```

### Problemas Identificados

#### 1. **mintSignature Nula**

```typescript
// Antes - sin validación
mintSignature.substring(0, 20); // ❌ Error si es null
```

**Solución aplicada:**

```typescript
// Después - con validación
if (!mintSignature) {
  loggerService.logError(new Error("mintSignature is null/undefined"), {
    context: "waitForMintConfirmationAndMarkSuccess",
    transactionId,
    walletAddress,
    note: "Cannot wait for confirmation without signature",
  });
  return; // Salir sin procesar
}
```

#### 2. **Logs Insuficientes**

No había forma de saber si la tarea en background se estaba lanzando.

**Solución:**

```typescript
loggerService.logInfo(
  "🎯 LANZANDO BACKGROUND TASK: waitForMintConfirmationAndMarkSuccess",
  {
    context: "confirmPurchase",
    transactionId,
    mintSignature: mintSig ? mintSig.substring(0, 20) + "..." : "null",
    walletAddress: updated.walletAddress,
  },
);
```

### Pasos de Debugging

Para verificar qué está pasando:

1. **En los logs, buscar:**

   ```
   "🎯 LANZANDO BACKGROUND TASK"
   ```

   - Si aparece → la tarea se lanzó correctamente
   - Si NO aparece → `mintSig` es null/undefined

2. **Si aparece el log anterior, buscar:**

   ```
   "🔄 [BACKGROUND] Esperando confirmación de mint"
   ```

   - Si aparece → entró a la función correctamente

3. **Esperar 30-120 segundos y buscar:**

   ```
   "✅ [BACKGROUND] Mint confirmado en blockchain"
   ```

   - Si aparece → se confirmó y se marcó como "success"
   - Si NO aparece → timeout de confirmación

4. **Si aparece timeout, buscar:**
   ```
   "⚠️ [BACKGROUND] Mint no se confirmó en 2 minutos"
   ```

### Posibles Escenarios

| Escenario               | Síntoma                                | Causa                                             | Solución                               |
| ----------------------- | -------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| ✅ Éxito                | Logs muestran "success"                | -                                                 | Listo                                  |
| ❌ mintSig null         | Solo "LANZANDO" pero no "Esperando"    | `updateTokenBalance()` falló silenciosamente      | Revisar logs de `updateTokenBalance()` |
| ❌ Timeout confirmación | "Esperando..." pero nunca "Confirmado" | Red lenta o transacción rechazada                 | Verificar en Solana Explorer           |
| ❌ Error en background  | "catch" block con error                | Excepción en `confirm_transaction_with_retries()` | Revisar stack trace                    |

## Cambios Implementados

### Archivo: `apps/api/src/controllers/purchase/PurchaseController.ts`

#### Cambio 1: Validación de mintSignature (Línea ~2370)

```typescript
// ✅ Validación crítica: mint signature no puede ser null
if (!mintSignature) {
  loggerService.logError(new Error("mintSignature is null/undefined"), {
    context: "waitForMintConfirmationAndMarkSuccess",
    transactionId,
    walletAddress,
    note: "Cannot wait for confirmation without signature",
  });
  return;
}
```

#### Cambio 2: Mejor logging al lanzar (Línea ~1125)

```typescript
// ✅ BACKGROUND TASK: Esperar confirmación real del mint y marcar como SUCCESS
loggerService.logInfo(
  "🎯 LANZANDO BACKGROUND TASK: waitForMintConfirmationAndMarkSuccess",
  {
    context: "confirmPurchase",
    transactionId,
    mintSignature: mintSig ? mintSig.substring(0, 20) + "..." : "null",
    walletAddress: updated.walletAddress,
  },
);

this.waitForMintConfirmationAndMarkSuccess(
  transactionId,
  mintSig,
  updated.walletAddress,
).catch((err) => {
  loggerService.logError(err as Error, {
    context: "confirmPurchase.waitForMintConfirmationAndMarkSuccess.catch",
    transactionId,
    mintSig,
    note: "Unhandled error in background task",
  });
});
```

## Compilación

✅ Backend: Sin errores  
✅ Frontend: Sin errores

## Próximos Pasos

1. **Reiniciar Docker:**

   ```bash
   docker compose down -v
   docker compose build
   docker compose up
   ```

2. **Realizar compra de prueba y revisar logs:**

   ```bash
   # En otra terminal:
   docker compose logs prowallet-api | grep -E "LANZANDO|Esperando|Confirmado|error"
   ```

3. **Enviar logs con mensaje:**
   - Si ves "LANZANDO" → incluye los próximos 30 logs
   - Si NO ves "LANZANDO" → incluye logs de `updateTokenBalance()`
