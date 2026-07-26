# 🔐 **SISTEMA DE AUTENTICACIÓN - DISEÑO VISUAL Y CÓDIGOS**

## 1. ARQUITECTURA DE CAPAS

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENTE (Next.js Frontend)                                     │
│  ├─ Formularios: Login / Register / Forgot Password             │
│  └─ Almacenamiento: JWT en memory, Refresh en httpOnly Cookie  │
└─────────────────────────────────┬───────────────────────────────┘
                                   │ HTTPS only
┌──────────────────────────────────▼───────────────────────────────┐
│  CAPA DE SEGURIDAD                                              │
│  ├─ Rate Limiting (5 intentos/15 min)                           │
│  ├─ CSRF Protection                                             │
│  ├─ Input Validation & Sanitization                             │
│  └─ Helmet + Security Headers                                   │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────┐
│  CAPA DE AUTENTICACIÓN (Express.js)                             │
│  ├─ POST /auth/register          → registerHandler()            │
│  ├─ POST /auth/login             → loginHandler()               │
│  ├─ POST /auth/forgot-password   → forgotPasswordHandler()      │
│  ├─ POST /auth/reset-password    → resetPasswordHandler()       │
│  ├─ GET /auth/verify-email       → verifyEmailHandler()         │
│  └─ POST /auth/logout            → logoutHandler()              │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
┌─────────────────┬────────────────┼──────────────┬─────────────────┐
│                 │                │              │                 │
▼                 ▼                ▼              ▼                 ▼
PASSWORD       EMAIL          DATABASE        TOKENS          SESSION
VALIDATION     SERVICE        (PostgreSQL)    SERVICE         (Redis)
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. TABLA COMPARATIVA: CONTRASEÑA VÁLIDA vs INVÁLIDA

| Contraseña     | Largo | May | min | Num | Sim | ¿Válida? | Error                           |
| -------------- | ----- | --- | --- | --- | --- | -------- | ------------------------------- |
| `Pass@123`     | 8 ✅  | ✅  | ✅  | ✅  | ✅  | ✅ SÍ    | -                               |
| `MyP@ssw0rd`   | 10 ✅ | ✅  | ✅  | ✅  | ✅  | ✅ SÍ    | -                               |
| `Secure#Pwd99` | 12 ✅ | ✅  | ✅  | ✅  | ✅  | ✅ SÍ    | -                               |
| `password123`  | 11 ✅ | ❌  | ✅  | ✅  | ❌  | ❌ NO    | Falta mayúscula + símbolo       |
| `PASSWORD@123` | 11 ✅ | ✅  | ❌  | ✅  | ✅  | ❌ NO    | Falta minúscula                 |
| `Pass123!`     | 8 ✅  | ✅  | ✅  | ✅  | ✅  | ✅ SÍ    | -                               |
| `Pass@`        | 5 ❌  | ✅  | ✅  | ❌  | ✅  | ❌ NO    | Muy corta, falta número         |
| `NoSymbol123`  | 11 ✅ | ✅  | ✅  | ✅  | ❌  | ❌ NO    | Falta símbolo                   |
| `Pass @123`    | 9 ✅  | ✅  | ✅  | ✅  | ✅  | ❌ NO    | Contiene espacio (no permitido) |
| `Tr0pic@l!`    | 9 ✅  | ✅  | ✅  | ✅  | ✅  | ✅ SÍ    | -                               |

---

## 3. CÓDIGO: SERVICIO DE VALIDACIÓN DE CONTRASEÑA

```typescript
// apps/api/src/services/auth/password.service.ts

import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

// Regex que valida TODOS los requisitos
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{8,}$/;

interface PasswordValidationResult {
  is_valid: boolean;
  errors: string[];
  suggestions: string[];
}

export class PasswordService {
  /**
   * Valida contraseña con todos los requisitos de seguridad
   */
  static validate_password(password: string): PasswordValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // 1. Validar longitud mínima
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
      errors.push(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`);
      suggestions.push(`Ingresa al menos ${PASSWORD_MIN_LENGTH} caracteres`);
    }

    // 2. Validar longitud máxima
    if (password.length > PASSWORD_MAX_LENGTH) {
      errors.push(`Máximo ${PASSWORD_MAX_LENGTH} caracteres`);
    }

    // 3. Validar mayúsculas
    if (!/[A-Z]/.test(password)) {
      errors.push("Requiere al menos 1 mayúscula (A-Z)");
      suggestions.push("Agrega una letra mayúscula (ej: 'A')");
    }

    // 4. Validar minúsculas
    if (!/[a-z]/.test(password)) {
      errors.push("Requiere al menos 1 minúscula (a-z)");
      suggestions.push("Agrega una letra minúscula (ej: 'a')");
    }

    // 5. Validar números
    if (!/\d/.test(password)) {
      errors.push("Requiere al menos 1 número (0-9)");
      suggestions.push("Agrega un número (ej: '1')");
    }

    // 6. Validar símbolos
    if (!/[@$!%*?&]/.test(password)) {
      errors.push("Requiere al menos 1 símbolo (@$!%*?&)");
      suggestions.push("Agrega un símbolo (ej: '@' o '#')");
    }

    // 7. Validar espacios
    if (/\s/.test(password)) {
      errors.push("No se permiten espacios en blanco");
      suggestions.push("Elimina los espacios de tu contraseña");
    }

    // 8. Validar contra regex completo
    if (!PASSWORD_REGEX.test(password)) {
      if (errors.length === 0) {
        errors.push("La contraseña no cumple los requisitos");
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
      suggestions,
    };
  }

  /**
   * Hash contraseña con bcrypt
   */
  static async hash_password(password: string): Promise<string> {
    const validation = this.validate_password(password);

    if (!validation.is_valid) {
      throw new Error(`Contraseña inválida: ${validation.errors.join(", ")}`);
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verificar contraseña contra hash
   */
  static async verify_password(
    input_password: string,
    stored_hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(input_password, stored_hash);
  }

  /**
   * Genera sugerencias de contraseña fuerte
   */
  static generate_password_suggestion(): string {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "@$!%*?&";

    const get_random = (str: string) =>
      str[Math.floor(Math.random() * str.length)];

    // Garantizar que tiene al menos 1 de cada
    let password =
      get_random(uppercase) +
      get_random(lowercase) +
      get_random(numbers) +
      get_random(symbols);

    // Rellenar hasta 12 caracteres con mix aleatorio
    const all_chars = uppercase + lowercase + numbers + symbols;
    for (let i = password.length; i < 12; i++) {
      password += get_random(all_chars);
    }

    // Mezclar aleatoriamente
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }
}
```

---

## 4. CÓDIGO: CONTROLADOR DE REGISTRO

```typescript
// apps/api/src/controllers/auth/register.handler.ts

import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { databaseService } from "../../services/database/database.service";
import { PasswordService } from "../../services/auth/password.service";
import { EmailService } from "../../services/auth/email.service";
import { TokenService } from "../../services/auth/token.service";

export const register_validators = [
  body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
  body("password").notEmpty().withMessage("Contraseña requerida"),
  body("password_confirm")
    .notEmpty()
    .withMessage("Confirmación requerida")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Las contraseñas no coinciden");
      }
      return true;
    }),
];

export const register_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id = (req as any).requestId;

  try {
    // 1. Validar input con express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: errors.array(),
      });
      return;
    }

    const { email, password } = req.body;

    // 2. Validar formato de email
    if (!email.includes("@")) {
      res.status(400).json({
        success: false,
        message: "Email inválido",
      });
      return;
    }

    // 3. Validar contraseña (regex + rules)
    const pwd_validation = PasswordService.validate_password(password);
    if (!pwd_validation.is_valid) {
      res.status(400).json({
        success: false,
        message: "Contraseña no cumple requisitos",
        errors: pwd_validation.errors,
        suggestions: pwd_validation.suggestions,
      });
      return;
    }

    // 4. Verificar si email ya existe
    const existing_user = await databaseService.getClient().mVPUser.findUnique({
      where: { email },
    });

    if (existing_user) {
      res.status(409).json({
        success: false,
        message: "Este email ya está registrado",
      });
      return;
    }

    // 5. Hash contraseña
    const password_hash = await PasswordService.hash_password(password);

    // 6. Crear usuario en BD
    const user = await databaseService.getClient().mVPUser.create({
      data: {
        email,
        password: password_hash,
        email_verified: false,
      },
    });

    // 7. Generar token de verificación de email
    const verification_token =
      await TokenService.generate_email_verification_token(user.id);

    // 8. Enviar email de verificación
    await EmailService.send_verification_email(email, verification_token);

    // 9. Response 201
    res.status(201).json({
      success: true,
      message: "Usuario registrado correctamente",
      data: {
        user_id: user.id,
        email: user.email,
        email_verified: false,
      },
      info: "Verifica tu email para completar el registro",
    });
  } catch (error) {
    console.error(`[${request_id}] Register error:`, error);
    res.status(500).json({
      success: false,
      message: "Error al registrar usuario",
    });
  }
};
```

---

## 5. CÓDIGO: CONTROLADOR DE LOGIN

```typescript
// apps/api/src/controllers/auth/login.handler.ts

import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import { databaseService } from "../../services/database/database.service";
import { PasswordService } from "../../services/auth/password.service";
import { TokenService } from "../../services/auth/token.service";

// Rate limiter: max 5 intentos/15 minutos
export const login_limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos fallidos. Intenta más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const login_validators = [
  body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
  body("password").notEmpty().withMessage("Contraseña requerida"),
];

export const login_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id = (req as any).requestId;

  try {
    // 1. Validar input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: errors.array(),
      });
      return;
    }

    const { email, password } = req.body;

    // 2. Buscar usuario por email
    const user = await databaseService.getClient().mVPUser.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Email o contraseña incorrecta",
      });
      return;
    }

    // 3. Validar email verificado
    if (!user.email_verified) {
      res.status(403).json({
        success: false,
        message: "Email no verificado",
        info: "Revisa tu bandeja de entrada para verificar tu email",
      });
      return;
    }

    // 4. Verificar contraseña con bcrypt
    const password_valid = await PasswordService.verify_password(
      password,
      user.password!,
    );

    if (!password_valid) {
      res.status(401).json({
        success: false,
        message: "Email o contraseña incorrecta",
      });
      return;
    }

    // 5. Generar JWT access token (15 minutos)
    const access_token = TokenService.generate_access_token(
      user.id,
      user.email,
    );

    // 6. Generar refresh token y guardarlo en BD
    const refresh_token = await TokenService.generate_and_store_refresh_token(
      user.id,
    );

    // 7. Actualizar último login
    await databaseService.getClient().mVPUser.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    // 8. Enviar refresh token en secure cookie
    res.cookie("refreshToken", refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });

    // 9. Response 200 con access token
    res.json({
      success: true,
      message: "Login exitoso",
      data: {
        access_token,
        token_type: "Bearer",
        expires_in: "15m",
      },
    });
  } catch (error) {
    console.error(`[${request_id}] Login error:`, error);
    res.status(500).json({
      success: false,
      message: "Error al iniciar sesión",
    });
  }
};
```

---

## 6. CÓDIGO: FORGOT PASSWORD

```typescript
// apps/api/src/controllers/auth/forgot-password.handler.ts

import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { databaseService } from "../../services/database/database.service";
import { EmailService } from "../../services/auth/email.service";
import { TokenService } from "../../services/auth/token.service";

export const forgot_password_validators = [
  body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
];

export const forgot_password_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id = (req as any).requestId;

  try {
    // 1. Validar input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: "Email inválido",
      });
      return;
    }

    const { email } = req.body;

    // 2. Buscar usuario
    const user = await databaseService.getClient().mVPUser.findUnique({
      where: { email },
    });

    // 3. IMPORTANTE: Response igual si existe o no (por seguridad)
    // Así no revelamos si un email está registrado o no
    if (!user) {
      res.status(200).json({
        success: true,
        message: "Si el email existe, recibirás instrucciones",
      });
      return;
    }

    // 4. Generar token reset (32 bytes aleatorio)
    const reset_token = await TokenService.generate_reset_token();
    const reset_token_hash = TokenService.hash_token(reset_token);

    // 5. Guardar hash en BD con expiración (2 horas)
    await databaseService.getClient().mVPUser.update({
      where: { id: user.id },
      data: {
        reset_token_hash,
        reset_token_exp: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    // 6. Enviar email con link de reset
    const reset_link = `${process.env.FRONTEND_URL}/reset-password?token=${reset_token}`;
    await EmailService.send_reset_password_email(email, reset_link);

    // 7. Response 200
    res.status(200).json({
      success: true,
      message: "Si el email existe, recibirás instrucciones",
    });
  } catch (error) {
    console.error(`[${request_id}] Forgot password error:`, error);
    res.status(500).json({
      success: false,
      message: "Error al procesar solicitud",
    });
  }
};
```

---

## 7. CÓDIGO: RESET PASSWORD

```typescript
// apps/api/src/controllers/auth/reset-password.handler.ts

import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { databaseService } from "../../services/database/database.service";
import { PasswordService } from "../../services/auth/password.service";
import { TokenService } from "../../services/auth/token.service";

export const reset_password_validators = [
  body("token").notEmpty().withMessage("Token requerido"),
  body("password").notEmpty().withMessage("Contraseña requerida"),
  body("password_confirm")
    .notEmpty()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Las contraseñas no coinciden");
      }
      return true;
    }),
];

export const reset_password_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id = (req as any).requestId;

  try {
    // 1. Validar input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: errors.array(),
      });
      return;
    }

    const { token, password } = req.body;

    // 2. Hash el token enviado y buscar en BD
    const token_hash = TokenService.hash_token(token);
    const user = await databaseService.getClient().mVPUser.findFirst({
      where: {
        reset_token_hash: token_hash,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Token inválido o expirado",
      });
      return;
    }

    // 3. Validar que token no expiró
    if (!user.reset_token_exp || new Date() > user.reset_token_exp) {
      // Limpiar token expirado
      await databaseService.getClient().mVPUser.update({
        where: { id: user.id },
        data: {
          reset_token_hash: null,
          reset_token_exp: null,
        },
      });

      res.status(401).json({
        success: false,
        message: "Token expirado. Solicita uno nuevo.",
      });
      return;
    }

    // 4. Validar nueva contraseña
    const pwd_validation = PasswordService.validate_password(password);
    if (!pwd_validation.is_valid) {
      res.status(400).json({
        success: false,
        message: "Contraseña no cumple requisitos",
        errors: pwd_validation.errors,
        suggestions: pwd_validation.suggestions,
      });
      return;
    }

    // 5. Hash nueva contraseña
    const new_password_hash = await PasswordService.hash_password(password);

    // 6. Actualizar contraseña y limpiar reset token
    await databaseService.getClient().mVPUser.update({
      where: { id: user.id },
      data: {
        password: new_password_hash,
        reset_token_hash: null,
        reset_token_exp: null,
        updated_at: new Date(),
      },
    });

    // 7. Response 200
    res.status(200).json({
      success: true,
      message: "Contraseña actualizada correctamente",
      info: "Puedes iniciar sesión con tu nueva contraseña",
    });
  } catch (error) {
    console.error(`[${request_id}] Reset password error:`, error);
    res.status(500).json({
      success: false,
      message: "Error al resetear contraseña",
    });
  }
};
```

---

## 8. CONFIGURACIÓN DE RUTAS

```typescript
// apps/api/src/routes/auth/auth.routes.ts

import { Router } from "express";
import {
  login_limiter,
  login_handler,
  login_validators,
} from "../../controllers/auth/login.handler";
import {
  register_handler,
  register_validators,
} from "../../controllers/auth/register.handler";
import {
  forgot_password_handler,
  forgot_password_validators,
} from "../../controllers/auth/forgot-password.handler";
import {
  reset_password_handler,
  reset_password_validators,
} from "../../controllers/auth/reset-password.handler";
import { validateRequest } from "../../middleware/validate-request";

const router = Router();

/**
 * POST /auth/register
 * Registrar nuevo usuario con validación de email y contraseña
 */
router.post(
  "/register",
  register_validators,
  validateRequest,
  register_handler,
);

/**
 * POST /auth/login
 * Login con email/password, rate limited a 5 intentos/15 min
 */
router.post(
  "/login",
  login_limiter,
  login_validators,
  validateRequest,
  login_handler,
);

/**
 * POST /auth/forgot-password
 * Solicitar reset de contraseña
 */
router.post(
  "/forgot-password",
  forgot_password_validators,
  validateRequest,
  forgot_password_handler,
);

/**
 * POST /auth/reset-password
 * Resetear contraseña con token
 */
router.post(
  "/reset-password",
  reset_password_validators,
  validateRequest,
  reset_password_handler,
);

export default router;
```

---

## 9. SCHEMAS/TIPOS TYPESCRIPT

```typescript
// apps/api/src/models/auth.types.ts

export interface User {
  id: number;
  email: string;
  password_hash: string;
  email_verified: boolean;
  email_verified_at?: Date;
  reset_token_hash?: string;
  reset_token_exp?: Date;
  last_login_at?: Date;
  login_attempts: number;
  locked_until?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface RegisterRequest {
  email: string;
  password: string;
  password_confirm: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  password_confirm: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    access_token?: string;
    token_type?: string;
    expires_in?: string;
    user_id?: number;
    email?: string;
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
  suggestions?: string[];
  info?: string;
}

export interface TokenPayload {
  user_id: number;
  email: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}
```

---

## 10. RESUMEN DE REQUISITOS

```
CONTRASEÑA VÁLIDA DEBE TENER:
✅ Mínimo 8 caracteres
✅ Mínimo 1 MAYÚSCULA (A-Z)
✅ Mínimo 1 minúscula (a-z)
✅ Mínimo 1 número (0-9)
✅ Mínimo 1 símbolo (@$!%*?&)
✅ Sin espacios

EJEMPLOS VÁLIDOS:
✅ Pass@word123
✅ MySecure#Pwd1
✅ Tr0pic@lPassword
✅ Complex!Pwd99

EJEMPLO CÓDIGO VALIDACIÓN:
const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{8,}$/
if (regex.test(password)) {
  // Contraseña válida
}
```

---

## 11. CHECKLIST DE IMPLEMENTACIÓN

```
BACKEND (Express.js):
☐ Crear servicios:
  ☐ password.service.ts (validación + hash)
  ☐ token.service.ts (JWT + refresh)
  ☐ email.service.ts (envío de emails)
  ☐ user.service.ts (CRUD usuarios)

☐ Crear handlers:
  ☐ register.handler.ts
  ☐ login.handler.ts
  ☐ forgot-password.handler.ts
  ☐ reset-password.handler.ts
  ☐ verify-email.handler.ts

☐ Crear middleware:
  ☐ rate-limiter
  ☐ authenticate (JWT)
  ☐ validate-request

☐ Crear rutas:
  ☐ auth.routes.ts

☐ Crear BD:
  ☐ Tabla users
  ☐ Tabla refresh_tokens
  ☐ Tabla email_verification_tokens

FRONTEND (Next.js):
☐ Crear páginas:
  ☐ /auth/register
  ☐ /auth/login
  ☐ /auth/forgot-password
  ☐ /auth/reset-password
  ☐ /auth/verify-email

☐ Crear hooks:
  ☐ useAuth (auth context)
  ☐ useLogin
  ☐ useRegister
  ☐ useForgotPassword

☐ Crear componentes:
  ☐ PasswordStrengthIndicator
  ☐ LoginForm
  ☐ RegisterForm
  ☐ ForgotPasswordForm

SEGURIDAD:
☐ HTTPS en producción
☐ Rate limiting en login
☐ CSRF protection
☐ Input validation
☐ SQL injection prevention (Prisma)
☐ Secure cookies (httpOnly, secure, sameSite)
☐ Email verification obligatoria
☐ Password hash con bcrypt (12 rounds)
☐ JWT con expiración corta (15 min)
☐ Refresh token con rotación
```
