# 🔐 Flujo de Autenticación Completo

## URLs de Autenticación Disponibles

### 1. **Registro (Register)**
- **URL**: `/auth/register`
- **Descripción**: Crear nueva cuenta
- **Features**:
  - Email-based registration
  - Validación estricta de password (8+ chars, mayúscula, minúscula, número, símbolo)
  - Requisitos visuales en tiempo real (✓/✗)
  - Botón deshabilitado hasta que todo sea válido
- **Endpoint Backend**: `POST /api/v1/auth/register`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "ValidPass123!"
  }
  ```

### 2. **Iniciar Sesión (Login)**
- **URL**: `/auth/login`
- **Descripción**: Acceder a cuenta existente
- **Features**:
  - Email-based login
  - Validación de inputs
  - Password visibility toggle (show/hide)
  - Links a forgot-password y register
- **Endpoint Backend**: `POST /api/v1/auth/login`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "ValidPass123!"
  }
  ```

### 3. **Recuperar Contraseña (Forgot Password)**
- **URL**: `/auth/forgot-password`
- **Descripción**: Solicitar enlace de recuperación
- **Features**:
  - Email-based recovery
  - Input validation
  - Button disabled after successful submission
  - Links a login y register
- **Endpoint Backend**: `POST /api/v1/auth/forgot-password`
- **Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```

### 4. **Verificar Email (Verify Email)**
- **URL**: `/auth/verify-email?token={token}`
- **Descripción**: Verificar email después de registro
- **Features**:
  - Automático al hacer click en email
  - Countdown antes de redirigir al dashboard (5 segundos)
  - Opción de redirigir manualmente
  - En caso de error, opción de solicitar nuevo email
- **Endpoint Backend**: `GET /api/v1/auth/verify-email?token={token}`

### 5. **Restablecer Contraseña (Reset Password)**
- **URL**: `/auth/reset-password?token={token}`
- **Descripción**: Cambiar contraseña con token de recuperación
- **Features**:
  - Validación estricta de password igual a register
  - Requisitos visuales en tiempo real
  - Botón deshabilitado hasta que todo sea válido
  - Redirección a login (3 segundos)
- **Endpoint Backend**: `POST /api/v1/auth/reset-password`
- **Body**:
  ```json
  {
    "token": "...",
    "password": "NewPass456!"
  }
  ```

### 6. **Main Page (Home)**
- **URL**: `/`
- **Descripción**: Página principal con login/register integrados
- **Features**:
  - Toggle entre login y register
  - Validación completa igual a las páginas dedicadas
  - Requisitos visuales para password
  - Solo visible si NO está autenticado

---

## ✅ Requisitos de Password

Todos los passwords DEBEN cumplir TODOS estos requisitos:

1. ✅ **Mínimo 8 caracteres**
2. ✅ **Al menos 1 mayúscula (A-Z)**
3. ✅ **Al menos 1 minúscula (a-z)**
4. ✅ **Al menos 1 número (0-9)**
5. ✅ **Al menos 1 símbolo de estos: @$!%*?&**

### Ejemplos válidos:
- `ValidPass123!`
- `MyPass@2025`
- `Test$1234`
- `SecureP@ssw0rd`

### Ejemplos inválidos:
- `weak` ❌ (muy corto, sin requisitos)
- `password123!` ❌ (sin mayúscula)
- `PASSWORD123!` ❌ (sin minúscula)
- `Password!` ❌ (sin número)
- `Password123` ❌ (sin símbolo)

---

## 🔄 Flujo Completo de Usuario Nuevo

### 1. Registro
```
Usuario → Haz clic en /auth/register o / (tab register)
       ↓
Usuario ingresa email y password (validado en tiempo real)
       ↓
Haz clic en "Registrarse"
       ↓
Backend crea usuario, envía email de verificación
       ↓
Respuesta: 201 Created con access_token
       ↓
Token guardado en sessionStorage
```

### 2. Verificación de Email
```
Usuario recibe email con enlace: 
/auth/verify-email?token={verification_token}
       ↓
Hace click en el enlace
       ↓
Frontend hace GET a backend para verificar token
       ↓
Si válido: usuario verificado, nuevo access_token
       ↓
Redirects a / (dashboard) automáticamente (5 segundos)
       ↓
Usuario autenticado en sesión
```

### 3. Iniciar Sesión (próximas veces)
```
Usuario → /auth/login o / (tab login)
       ↓
Ingresa email y password
       ↓
Haz clic en "Iniciar Sesión"
       ↓
Backend valida credenciales
       ↓
Respuesta: 200 OK con access_token
       ↓
Token guardado en sessionStorage
       ↓
Redirect a / (dashboard)
```

---

## 🔧 Recuperación de Contraseña

### Flujo:
```
Usuario → /auth/forgot-password
       ↓
Ingresa email registrado
       ↓
Backend envía email con enlace:
/auth/reset-password?token={reset_token}
       ↓
Usuario hace click en email
       ↓
Página muestra form para nueva contraseña
       ↓
Usuario ingresa nueva password (validada)
       ↓
Backend actualiza password
       ↓
Redirect a /auth/login (3 segundos)
       ↓
Usuario hace login con nueva contraseña
```

---

## 💾 Almacenamiento de Datos

### sessionStorage (se borra al cerrar navegador)
- `token` - JWT access token
- `user` - JSON del usuario

### Nunca almacenar:
- Passwords en plain text
- Sensitive information
- PII (Personally Identifiable Information)

---

## 🔐 Seguridad

- ✅ Passwords validados en FRONTEND (UX)
- ✅ Passwords validados en BACKEND (seguridad)
- ✅ Tokens JWT con expiración
- ✅ HTTPS en producción (obligatorio)
- ✅ Rate limiting en endpoints de auth
- ✅ Email verification requerido
- ✅ Tokens seguros en URL (válidos por tiempo limitado)

---

## 🧪 Testing

### Test Case 1: Registro + Verificación
1. Register en `/auth/register`
2. Verificar email que llega
3. Click en enlace de verificación
4. Verificar que redirige a /
5. Verificar que estás autenticado

### Test Case 2: Login
1. Login en `/auth/login`
2. Verificar que estás en /
3. Verificar que token está en sessionStorage

### Test Case 3: Forgot Password + Reset
1. Click "forgot password" en login
2. Ingresa email registrado
3. Verifica email que llega
4. Click en enlace de reset
5. Ingresa nueva contraseña
6. Click "Actualizar"
7. Verifica que redirige a login
8. Login con nueva contraseña

---

## 📝 Stack Técnico

- **Frontend**: Next.js 16 (App Router), React, TailwindCSS
- **Backend**: Express.js, Prisma, PostgreSQL
- **Auth**: JWT, Email verification
- **Rate Limiting**: Disabled in development, enabled in production
- **Validation**: Frontend (UX) + Backend (security)

---

## 🚀 Próximos Pasos

- [ ] Integración con Solana wallet (Sign in with Solana)
- [ ] 2FA (Two-Factor Authentication)
- [ ] Social login (Google, GitHub, etc.)
- [ ] Session management mejorado
- [ ] Refresh token rotation
- [ ] Audit logging

---

**Última actualización**: 2025-12-27
**Estado**: ✅ Complete y Tested
