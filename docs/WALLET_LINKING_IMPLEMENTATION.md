# 📋 Flujo de Testing: Wallet Linking con Firma

## 🎯 OBJETIVO

Validar el flujo completo de vinculación de wallet con firma criptográfica.

## ✅ QUÉ SE IMPLEMENTÓ

### 1. **Backend - Validación de Firma** ✅

- **Archivo**: `apps/api/src/controllers/auth/AuthController.ts`
- **Cambio**: Endpoint `POST /api/v1/auth/link-wallet` ahora:
  1. Valida que el usuario esté autenticado (JWT)
  2. Verifica que `solanaPublicKey`, `message`, `signature` estén presentes
  3. Valida que es una dirección Solana válida
  4. **Verifica la firma usando `wallet-signature-service`** (Ed25519)
  5. Solo después de firma válida, guarda la wallet

```typescript
// Ahora hace esto:
const signature_result = await verify_wallet_signature({
  public_key: solanaPublicKey,
  message,
  signature,
});

if (!signature_result.is_valid) {
  // Rechaza si la firma no es válida
  return 401 Unauthorized
}
```

### 2. **Frontend - Hook para Wallet Linking** ✅

- **Archivo**: `apps/web/hooks/use-link-wallet.ts`
- **Qué hace**:
  - Maneja el estado del flujo de linking
  - Solicita challenge al servidor
  - Obtiene firma del wallet
  - Llama a `authService.linkWallet()`
  - Actualiza usuario en la sesión
  - Maneja errores y progreso

```typescript
// Uso:
const { link_wallet, is_loading, progress } = use_link_wallet();

const user = await link_wallet(publicKey, async (msg) => {
  return await wallet.signMessage(msg);
});
```

### 3. **Frontend - Widget Reutilizable** ✅

- **Archivo**: `apps/web/components/widgets/link-wallet-widget.tsx`
- **Funcionalidad**:
  - Interfaz completa para vincular wallets
  - Muestra pasos: 1) Conectar, 2) Firmar
  - Progreso visual con barra
  - Manejo de errores con SweetAlert2

### 4. **Frontend - Página de Dashboard** ✅

- **Ruta**: `/dashboard/wallet-linking`
- **Propósito**: Página dedicada para vincular wallets después de login
- **Incluye**: Widget + Info de beneficios + Estado de usuario

### 5. **Frontend - Service Layer** ✅

- **Archivo**: `apps/web/lib/auth-service.ts`
- **Método agregado**: `linkWallet(publicKey, message, signature)`
- **Fix**: Corregido error en `login()` (token → tokenValue)

---

## 📊 FLUJO COMPLETO

```
Usuario
  ↓
[/auth/login] - Email/Password Login
  ↓
[¡Login Exitoso!]
  ↓
[/dashboard/wallet-linking] - Nueva página para vincular
  ↓
[LinkWalletWidget] - Usuario ve interfaz
  ↓
[1. Conectar Wallet]
  - Usuario clickea "Seleccionar Wallet"
  - Se abre modal de Phantom/Solflare
  - Wallet conectada ✓
  ↓
[2. Firmar Vinculación]
  - Frontend llama: authService.requestChallenge(publicKey)
  - Servidor responde con: { message: "...", expiresAt: ... }
  - Frontend solicita firma: wallet.signMessage(message)
  - Phantom/Solflare abre popup para firmar
  - Usuario firma ✓
  ↓
[3. Enviar Firma al Servidor]
  - Frontend llama: authService.linkWallet(publicKey, message, signature)
  - Backend valida la firma con Ed25519
  - Si válida → actualiza user.solanaPublicKey
  - Si inválida → retorna 401 Unauthorized
  ↓
[¡Wallet Vinculada!]
  - Usuario redirigido a dashboard
  - user.walletAddress ahora tiene la wallet
  - Puede hacer compras/transferencias
```

---

## 🧪 CÓMO TESTEAR MANUALMENTE

### PASO 1: Registrar usuario

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wallettest@example.com",
    "password": "SecurePass@123"
  }'
```

**Respuesta esperada:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": 123,
      "email": "wallettest@example.com",
      "walletAddress": null
    }
  }
}
```

### PASO 2: Login

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wallettest@example.com",
    "password": "SecurePass@123"
  }'
```

**Guardar el token devuelto** (lo usarás en el siguiente paso)

### PASO 3: Solicitar Challenge

```bash
TOKEN="<token_del_paso_2>"
PUBLIC_KEY="<tu_wallet_public_key>"

curl -X POST http://localhost:3001/api/v1/auth/request-challenge \
  -H "Content-Type: application/json" \
  -d "{\"publicKey\": \"$PUBLIC_KEY\"}"
```

**Respuesta esperada:**

```json
{
  "success": true,
  "data": {
    "message": "Sign this message to authenticate with ProWallet:\nnonce:abc123...",
    "expiresAt": 1704067200000
  }
}
```

### PASO 4: Firmar el Mensaje (EN TU WALLET)

Esto debes hacerlo manualmente en Phantom o Solflare:

1. Ve a http://localhost:3000/dashboard/wallet-linking
2. Conecta tu wallet
3. Clickea "Vincular Wallet"
4. Tu wallet te pedirá firmar el mensaje
5. Confirma la firma

**O si quieres testear por API, necesitas una utilidad para firmar...**

### PASO 5: Vincular Wallet (Backend)

```bash
TOKEN="<token_del_paso_2>"
PUBLIC_KEY="<tu_wallet_public_key>"
SIGNED_MESSAGE="<tu_mensaje_firmado_en_base64>"
SIGNATURE="<tu_firma_en_base58>"

curl -X POST http://localhost:3001/api/v1/auth/link-wallet \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"solanaPublicKey\": \"$PUBLIC_KEY\",
    \"message\": \"Sign this message to authenticate with ProWallet:\nnonce:...\",
    \"signature\": \"$SIGNATURE\"
  }"
```

**Respuesta si firma es válida:**

```json
{
  "success": true,
  "data": {
    "message": "Wallet vinculado exitosamente",
    "user": {
      "id": 123,
      "email": "wallettest@example.com",
      "solanaPublicKey": "ELuHMnvSyaM5Z2Y8bsFLDsVX..."
    }
  }
}
```

**Respuesta si firma es inválida:**

```json
{
  "success": false,
  "code": 401,
  "error": "La firma no es válida"
}
```

---

## 🛠️ TESTING EN BROWSER (LO RECOMENDADO)

1. **Abre** http://localhost:3000
2. **Haz clic** en "Login" (o si es nuevo usuario, "Register")
3. **Crea cuenta** con email y password
4. **Después de login**, deberías ver opción para vincular wallet
5. **O ve directamente a** http://localhost:3000/dashboard/wallet-linking
6. **Clickea** "Vincular Wallet"
7. **Selecciona tu wallet** (Phantom, Solflare, etc.)
8. **Confirma la firma** en el popup de tu wallet
9. **¡Listo!** Wallet vinculada

---

## 🔐 SEGURIDAD IMPLEMENTADA

✅ **Validación de Firma Ed25519**

- Usa tweetnacl para verificar autenticidad
- Solo wallets que pueden firmar el mensaje específico pueden vincularse

✅ **Challenge Temporal (Nonce)**

- Mensaje debe incluir nonce específico
- Expira en 5 minutos
- Previene replay attacks

✅ **Autenticación JWT**

- Endpoint requiere token válido en `Authorization: Bearer <token>`
- Solo usuario autenticado puede vincular su wallet

✅ **Validación de Dirección Solana**

- Verifica que es una dirección Solana válida
- Rechaza direcciones malformadas

---

## 📝 ARCHIVOS MODIFICADOS/CREADOS

### ✅ Creados:

1. `apps/web/hooks/use-link-wallet.ts` - Hook para manejo de estado
2. `apps/web/components/widgets/link-wallet-widget.tsx` - Widget reutilizable
3. `apps/web/app/dashboard/wallet-linking/page.tsx` - Página de dashboard

### ✅ Modificados:

1. `apps/api/src/controllers/auth/AuthController.ts` - Validación de firma en linkWallet
2. `apps/web/lib/auth-service.ts` - Agregó linkWallet() + fixed login() bug
3. `apps/web/components/views/trade-view.tsx` - Removed wallet requirement para compras

---

## ⚠️ PRÓXIMOS PASOS (Si quieres mejorar más)

1. **Separar el flujo en páginas modulares:**
   - `/dashboard/wallet-linking` → Solo para linking
   - `/dashboard/trade` → Solo para compras (requiere wallet)
   - `/dashboard/transfer` → Solo para transferencias (requiere wallet)

2. **Mejorar UX:**
   - Mostrar lista de wallets soportados
   - Validar wallet antes de pedir firma
   - Mostrar qr code si es mobile

3. **Testing:**
   - Unit tests para `use_link_wallet` hook
   - Integration tests para flujo completo
   - Mock de Phantom para testing automático

4. **Validaciones extra:**
   - Prevenir vincular misma wallet a múltiples cuentas
   - Permitir cambiar/actualizar wallet
   - Desvincula wallet si lo desea

---

## 🎯 COMMIT HASH

```
f234ec7 - feat: Implement wallet linking with signature verification
```
