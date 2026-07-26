# Solucionar Advertencias de Phantom & Error de Fondos Insuficientes

## 🔴 Los Tres Problemas

### 1. "Esta dApp podría ser maliciosa"

**Causa:** Tu dominio no está verificado en Phantom
**Solución:** Registrar en Phantom Developer Program

### 2. "Este dominio es nuevo"

**Causa:** Phantom no reconoce `exchange.gapstation.net`
**Solución:** Esperar a que Phantom lo aprenda (con uso) O registrarse

### 3. "Una cuenta involucrada en esta transacción no tiene suficientes SOL" ⚠️ CRÍTICO

**Causa:** La wallet NO tiene SOL suficiente para pagar gas fees
**Solución:** Validar balance ANTES de permitir transacción

---

## ✅ Solución 1: Registrar en Phantom Developer Program

### Pasos:

1. Ve a: https://phantom.app/developers
2. Completa el formulario:
   ```
   Domain: exchange.gapstation.net
   Name: ProWallet Exchange
   Description: Token exchange platform for ProWallet
   Logo: (URL a tu logo)
   Website: (URL principal)
   Privacy Policy: (URL)
   ```
3. Espera 1-2 semanas de revisión

**Resultado:** Las advertencias desaparecen

---

## ✅ Solución 2: Validar SOL Antes de Permitir Transacción (INMEDIATO)

### Problema Actual:

```
Usuario intenta comprar
  ↓
Tu app INICIA transacción
  ↓
Phantom calcula fees (~0.00005 SOL)
  ↓
Phantom ve que NO hay SOL suficiente
  ↓
Phantom rechaza con advertencia
```

### Solución:

Validar ANTES de iniciar:

```typescript
// En tu PurchaseService o TradeView component

async function validateBeforePurchase(
  walletAddress: string,
  tokenAmount: number,
): Promise<boolean> {
  try {
    // 1. Obtener balance actual en SOL
    const balanceLamports = await connection.getBalance(walletPubkey);
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

    // 2. Calcular fees estimados (conservative estimate)
    const estimatedGasFeesSOL = 0.00005; // ~5000 lamports for instruction
    const minimumRequiredSOL = 0.00005; // Mínimo extra buffer

    // 3. Validar que hay suficiente
    if (balanceSOL < estimatedGasFeesSOL + minimumRequiredSOL) {
      throw new Error(
        `Fondos insuficientes. Necesitas ${estimatedGasFeesSOL + minimumRequiredSOL} SOL para gas fees. ` +
          `Tienes: ${balanceSOL} SOL`,
      );
    }

    return true;
  } catch (error) {
    console.error("Balance validation failed:", error);
    // Mostrar error al usuario ANTES de intentar transacción
    throw new PurchaseError(
      error instanceof Error ? error.message : "Balance validation failed",
      "INSUFFICIENT_BALANCE",
    );
  }
}
```

### Dónde Agregar Esta Validación:

**En `apps/web/lib/services/purchase-service.ts`:**

Busca la función `executePurchaseFlow()` y agrega al inicio:

```typescript
export async function executePurchaseFlow(
  walletAddress: string,
  tokenAmount: number,
): Promise<void> {
  try {
    // ⭐ AGREGAR AQUÍ - Validar fondos ANTES de todo
    await validateBeforePurchase(walletAddress, tokenAmount);

    // ... resto del código de compra
  } catch (error) {
    // ... manejo de errores
  }
}
```

---

## ✅ Solución 3: Mostrar Advertencia en UI (UX Mejora)

En tu componente de compra, muestra el balance ANTES de permitir comprar:

```typescript
// En TradeView o componente de compra

function PurchaseForm() {
  const [balanceSOL, setBalanceSOL] = useState<number | null>(null);
  const [hasEnoughGas, setHasEnoughGas] = useState(true);

  useEffect(() => {
    async function checkBalance() {
      try {
        const balance = await getSOLBalance(wallet.publicKey);
        const minimumRequired = 0.00005;

        setBalanceSOL(balance);
        setHasEnoughGas(balance >= minimumRequired);
      } catch (error) {
        console.error("Failed to check balance:", error);
      }
    }

    checkBalance();
  }, [wallet]);

  return (
    <div>
      {/* Mostrar balance */}
      <div className="balance-info">
        <p>Balance: {balanceSOL?.toFixed(6)} SOL</p>

        {!hasEnoughGas && (
          <div className="warning">
            ⚠️ Fondos insuficientes para gas fees.
            Necesitas al menos 0.00005 SOL
          </div>
        )}
      </div>

      {/* Botón deshabilitado si no hay fondos */}
      <button
        onClick={handlePurchase}
        disabled={!hasEnoughGas}
        className={!hasEnoughGas ? 'disabled' : ''}
      >
        {hasEnoughGas ? 'Comprar' : 'Fondos Insuficientes'}
      </button>
    </div>
  );
}
```

---

## 🎯 Plan de Acción (Inmediato)

### Corto Plazo (Ahora):

1. ✅ Agregar validación de SOL en `purchase-service.ts`
2. ✅ Mostrar balance en UI con advertencia
3. ✅ Deshabilitar botón si no hay fondos

### Mediano Plazo (1-2 semanas):

4. Registrar en Phantom Developer Program
5. Esperar aprobación

### Resultado Final:

- ✅ No más erro "Fondos insuficientes" en Phantom
- ✅ Usuario ve advertencia clara ANTES de intentar comprar
- ✅ Advertencias de "dApp maliciosa" desaparecen después de verificación

---

## 📝 Resumen

La advertencia roja de Phantom NO es problema de tu código. Es:

1. **Phantom detectando wallet con SOL insuficiente** ← El problema real
2. **Phantom no reconoce tu dominio como verificado** ← Cosmético, se arregla con registro

**La solución es validar SOL ANTES de iniciar transacción**, así Phantom nunca llega a mostrar la advertencia.

¿Querés que implemente la validación ahora?
