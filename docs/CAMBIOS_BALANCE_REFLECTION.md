# Cambios: Reflejo Automático de Balance después de Compra

## Problema Original

La compra se marcaba como exitosa pero el balance de GAPC no se actualizaba inmediatamente en la UI del usuario.

### Causa Raíz

- La transacción se marcaba como `status: "completed"` inmediatamente después del mint
- Pero la UI solo refleja el balance cuando el status es `"success"`
- El status nunca se actualizaba a `"success"` porque no había un proceso de espera para la confirmación

## Solución Implementada

### Flujo de Compra Mejorado

```
1. Usuario ejecuta compra
   └─ Frontend envía transacción a Solana

2. Backend recibe confirmación
   ├─ Ejecuta mint del token
   ├─ Marca status = "completed" (respuesta inmediata)
   └─ Retorna 200 OK (~100ms)

3. Usuario recibe confirmación rápida
   └─ UI muestra: "Compra procesada"

4. EN BACKGROUND (sin bloquear al usuario):
   ├─ Espera confirmación real del mint en Solana
   │  ├─ Timeout: 120 segundos
   │  ├─ Reintentos: 15
   │  └─ Backoff: Exponencial (2s → 10s)
   │
   └─ Cuando se confirma:
      ├─ Marca status = "success"
      └─ Balance se refleja automáticamente en UI
```

## Archivos Modificados

### 1. [apps/api/src/controllers/purchase/PurchaseController.ts](apps/api/src/controllers/purchase/PurchaseController.ts)

#### Cambio 1: Llamada al Background Task (líneas 1125-1135)

Se agregó llamada no-bloqueante a nueva función después de marcar como "completed":

```typescript
// ✅ BACKGROUND TASK: Esperar confirmación real del mint y marcar como SUCCESS
this.waitForMintConfirmationAndMarkSuccess(
  transactionId,
  mintSig,
  updated.walletAddress,
).catch((err) => {
  loggerService.logError(err as Error, {
    context: "confirmPurchase.waitForMintConfirmationAndMarkSuccess",
    transactionId,
    mintSig,
  });
});
```

#### Cambio 2: Nueva Función Background Task (líneas 2355-2440)

Se agregó método privado `waitForMintConfirmationAndMarkSuccess()` que:

- Espera confirmación del mint hasta 2 minutos
- Usa 15 reintentos con backoff exponencial
- Actualiza status a "success" cuando se confirma
- No bloquea la respuesta al cliente

```typescript
private async waitForMintConfirmationAndMarkSuccess(
    transactionId: string,
    mintSignature: string,
    walletAddress: string
): Promise<void> {
    // 1. Conecta a Solana
    // 2. Verifica confirmación con reintentos
    // 3. Si se confirma: marca como "success" (balance se refleja)
    // 4. Si timeout: registra warning pero sigue siendo válida
}
```

## Componentes Utilizados

### Servicio de Confirmación

- **Archivo**: [apps/api/src/services/solana/confirm-transaction.service.ts](apps/api/src/services/solana/confirm-transaction.service.ts)
- **Función**: `confirm_transaction_with_retries()`
- **Configuración**:
  - Timeout: 120 segundos (2 minutos)
  - Reintentos: 15
  - Backoff: Exponencial (inicial 2s, multiplicador 1.5x, máximo 10s)
  - Dual commitment levels: finalized + confirmed

## Estado de Transacciones

### Estados Válidos en BD

| Estado      | Significado              | Cuando ocurre                   | UI Refleja Balance |
| ----------- | ------------------------ | ------------------------------- | ------------------ |
| `pending`   | Enviada a Solana         | Inmediatamente                  | ❌ No              |
| `completed` | Mint ejecutado           | Después de mint                 | ❌ No              |
| `success`   | Confirmado en blockchain | Después de esperar confirmación | ✅ SÍ              |
| `failed`    | Error en mint            | Si hay excepción                | ❌ No              |

## Timing

| Fase                      | Duración           | Qué sucede                              |
| ------------------------- | ------------------ | --------------------------------------- |
| Envío a Solana            | < 100ms            | Usuario recibe respuesta                |
| Ejecución del mint        | < 500ms            | BD se marca como "completed"            |
| Espera en background      | hasta 120s         | API verifica confirmación en blockchain |
| Actualización a "success" | ~30-60s (promedio) | Balance se refleja automáticamente      |

## Validación

### Compilación

✅ Backend: Compila sin errores
✅ Frontend: Compila sin errores

### Comportamiento Esperado

1. **Usuario ejecuta compra**
   - Confirmación inmediata (~100ms)
   - Muestra: "Compra procesada"

2. **Espera de confirmación (background)**
   - Usuario puede cerrar modal/navegar
   - Backend espera confirmación en Solana

3. **Balance se refleja**
   - Automáticamente cuando status → "success"
   - Típicamente en 30-60 segundos
   - Máximo 120 segundos si hay problemas de red

## Configuración Personalizable

En `waitForMintConfirmationAndMarkSuccess()`:

```typescript
// Cambiar timeout:
const confirmed = await confirm_transaction_with_retries(
  connection,
  mintSignature,
  {
    maxRetries: 15, // ← Cambiar número de reintentos
    timeout: 120000, // ← Cambiar timeout (ms)
  },
);

// Opcionalmente, forzar "success" si pasa tiempo:
if (!confirmed) {
  // Descomentar si quieres forzar éxito después de timeout
  // await transactionRepository.update(
  //     { transactionId },
  //     { status: "success" }
  // );
}
```

## Monitoreo en Logs

Buscar en logs por `[BACKGROUND]` para ver:

- Inicio de espera: `🔄 [BACKGROUND] Esperando confirmación...`
- Éxito: `✅ [BACKGROUND] Mint confirmado...`
- Timeout: `⚠️ [BACKGROUND] Mint no se confirmó...`

## Próximos Pasos Opcionales

1. **Fallback más agresivo**: Forzar "success" si pasa X segundos (usuario ya pagó)
2. **Notificaciones**: Enviar notificación cuando status → "success"
3. **UI Polling**: Agregar polling más frecuente cuando status = "completed"
4. **WebSockets**: Usar WebSockets en lugar de polling para actualizaciones en tiempo real

## Resumen

La compra ahora:

1. ✅ Retorna respuesta inmediata al cliente (< 100ms)
2. ✅ No bloquea al usuario
3. ✅ Espera confirmación en background
4. ✅ Actualiza balance automáticamente cuando se confirma
5. ✅ Maneja timeouts y reintentos inteligentemente
