# 🧪 Guía de Prueba - Transferencias P2P Refactorizado

## ✅ Verificaciones Antes de Probar

Asegúrate que está configurado para **mainnet**:

### 1. Frontend Configuration

```bash
# apps/web/.env.local debe tener:
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_TOKEN_MINT=D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3
```

### 2. Backend Configuration

```bash
# apps/api debe estar usando .env.mainnet
SOLANA_NETWORK=mainnet-beta
TOKEN_MINT=D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3
```

---

## 🚀 Pasos para Probar

### 1. Iniciar el servidor

```bash
cd /home/aprog/Projects/github-project-work/github-proyect/prowallet
rm -rf apps/web/.next  # Limpiar caché
pnpm dev               # Iniciar en modo desarrollo
```

### 2. Verificar que carga sin errores

- ✅ No debe haber errores en la consola
- ✅ Las páginas deben cargar rápido
- ✅ El token debe mostrar "GAPC" (no "GAPC-TEST")

### 3. Navegar a "Transferir"

```
1. Conectar wallet (Phantom o Solflare)
2. Ir al menu "Transferir"
3. Debería ver:
   - Selector de "Desde (Holder)"
   - Input de "Hacia (Dirección)"
   - Input de "Cantidad"
```

### 4. Probar Formulario

```
Caso 1: Campo vacío
- Input vacío → Botón DESHABILITADO ✅

Caso 2: Dirección inválida
- Dirección corta → Error "Dirección Solana inválida" ✅

Caso 3: Misma dirección origen/destino
- from == to → Error "No puedes transferir a la misma dirección" ✅

Caso 4: Cantidad 0 o negativa
- amount <= 0 → Error "cantidad debe ser mayor a 0" ✅
```

### 5. Probar Transferencia Real

```
Datos válidos:
- From: [holder con balance]
- To: [dirección Solana válida]
- Amount: [cantidad dentro del balance]

Comportamiento esperado:
1. Preview actualiza en tiempo real
2. Muestra nuevo balance origen/destino
3. Botón se habilita
4. Al hacer click → carga/spinner
5. Si éxito → Mensaje de éxito con TX ID
6. Formulario se limpia
```

---

## 🔍 Qué Revisar Técnicamente

### Validación

```typescript
// Debe validar estas 5 cosas:
✅ from_holder no vacío
✅ to_address es dirección Solana válida
✅ amount > 0
✅ from_holder ≠ to_address
✅ balance >= amount
```

### Preview

```typescript
// Debe calcular:
✅ from_balance - amount = nuevo balance origen
✅ to_balance + amount = nuevo balance destino
✅ fee = 0.000005 SOL
```

### API Calls

```typescript
// Debe hacer 3 llamadas:
1. /transfer/initiate → obtiene transaction_id
2. /transfer/confirm → confirma con firma
3. Ambas en paralelo para balances (fetch_both_balances)
```

---

## 📊 Casos de Prueba Automatizados

### Test 1: Validación de Entrada

```typescript
const form = {
  from_holder: "wallet1",
  to_address: "11111111111111111111111111111111",  // inválido
  amount: "100"
};

Result:
  ✅ validate_transfer_input(form) → "Dirección Solana inválida"
```

### Test 2: Cálculo de Preview

```typescript
const from_balance = 500;
const to_balance = 100;
const transfer_amount = 50;

Result: preview.from_balance = 500;
preview.to_balance = 100;
new_from = 450;
new_to = 150;
fee = 0.000005;
```

### Test 3: Validación de Balance

```typescript
const balance = 100;
const amount = 150;

Result:
  ✅ validate_sufficient_balance(100, 150) → false
  ❌ Muestra "Balance insuficiente"
```

---

## 🐛 Debugging

### Si no carga la lista de holders:

```bash
# 1. Verifica que /purchase/history retorna datos
curl https://servicioshilda.orioncaribe.com/api/v1/purchase/history

# 2. Revisa la consola del navegador (F12)
# Debe haber log de holders fetched

# 3. Verifica que hay holders con balance > 0
```

### Si no puedo transferir:

```bash
# 1. Verifica que la dirección Solana es válida
# Debe cumplir regex: ^[1-9A-HJ-NP-Za-km-z]{32,44}$

# 2. Revisa si hay balance en el holder origen
# El preview debe mostrar from_balance > 0

# 3. Verifica endpoint en backend:
curl -X POST https://servicioshilda.orioncaribe.com/api/v1/transfer/initiate \
  -H "Content-Type: application/json" \
  -d '{"fromHolder":"wallet1","toAddress":"11...11","amount":100}'
```

---

## ✨ Features a Validar

| Feature                  | Validación                      | Status |
| ------------------------ | ------------------------------- | ------ |
| Cargar holders           | fetch_wallet_holders()          | 🟢     |
| Validar dirección Solana | SOLANA_ADDRESS_REGEX            | 🟢     |
| Preview en tiempo real   | useEffect + fetch_both_balances | 🟢     |
| Calcular balances nuevos | calculate_transfer_preview()    | 🟢     |
| Error handling           | try/catch en 3 niveles          | 🟢     |
| Spinner de carga         | is_loading state                | 🟢     |
| Mensaje de éxito         | SuccessMessage component        | 🟢     |
| Limpiar formulario       | reset_form()                    | 🟢     |

---

## 📝 Checklist Final

Antes de considerar como "completado":

- [ ] Compilación sin errores (`pnpm build`)
- [ ] Carga sin console errors (`pnpm dev`)
- [ ] Conecta wallet correctamente
- [ ] Carga lista de holders
- [ ] Valida dirección Solana
- [ ] Muestra preview en tiempo real
- [ ] Calcula balances nuevos correctamente
- [ ] Envía transferencia (si has configurado firma)
- [ ] Muestra mensaje de éxito
- [ ] Limpia formulario después
- [ ] Los errores se muestran correctamente

---

**Todos estos chequeos están implementados y listos para probar.**
