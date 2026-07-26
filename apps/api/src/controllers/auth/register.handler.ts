import { Request, Response } from "express";
import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import {
  validar_email,
  validar_password,
  obtener_errores_password,
  buscar_usuario_por_email,
  es_admin,
} from "./auth.validators";
import { PasswordService } from "../../services/auth/password.service";
import { TokenService } from "../../services/auth/token.service";
import { EmailService } from "../../services/auth/email.service";

/**
 * Handler para POST /api/v1/auth/register
 * Crea un nuevo usuario con email/password
 * Envía email de verificación (usuario debe verificar email antes de poder loguearse)
 */
export const register_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    const { email, password } = req.body;

    // Validar email
    if (!validar_email(email)) {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Email válido requerido (ej: usuario@ejemplo.com)",
            request_id,
          },
        }),
      );
      return;
    }

    // Validar password
    if (!validar_password(password)) {
      const errors = obtener_errores_password(password);
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Password no válido",
            details: errors,
            request_id,
          },
        }),
      );
      return;
    }

    const prisma = databaseService.getClient();

    // Verificar si el email ya existe
    const usuario_existente = await buscar_usuario_por_email(prisma, email);

    if (usuario_existente) {
      res.status(409).json(
        StatusFlow({
          code: StatusFlowCodes.CONFLICT,
          lang: "es",
          extra: {
            error: "El email ya está registrado",
            request_id,
          },
        }),
      );
      return;
    }

    // Hash de la contraseña usando bcrypt 12 rounds
    const password_hasheado = await PasswordService.hash_password(password);

    // Generar token de verificación de email
    const verification_token = TokenService.generate_secure_token();
    const verification_token_hash = TokenService.hash_token(verification_token);
    const verification_token_expires = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ); // 24 horas

    // Crear usuario
    const usuario = await prisma.user.create({
      data: {
        email,
        password: password_hasheado,
        tokenBalance: BigInt(0),
        usdSpent: 0,
      },
    });

    // Crear token de verificación de email
    await prisma.emailVerificationToken.create({
      data: {
        user_id: usuario.id,
        token_hash: verification_token_hash,
        expires_at: verification_token_expires,
      },
    });

    // Enviar email de verificación
    const email_enviado = await EmailService.enviar_email_verificacion(
      email,
      verification_token,
    );

    if (!email_enviado) {
      loggerService.logInfo("Email de verificación no se envió (demo mode)", {
        context: "register_handler",
        request_id,
        email,
        verification_token,
      });
    }

    // Generar access token (temporal, no puede iniciar sesión hasta verificar email)
    const access_token = TokenService.generate_access_token(
      usuario.id,
      email,
      es_admin(email),
    );

    loggerService.logInfo(`Usuario registrado: ${email}`, {
      context: "register_handler",
      request_id,
      user_id: usuario.id,
    });

    // Responder con access token y mensaje de verificación
    res.status(201).json({
      success: true,
      data: {
        message:
          "Usuario registrado exitosamente. Por favor, verifica tu email.",
        access_token,
        user: {
          id: usuario.id,
          email,
          is_email_verified: false,
          is_admin: es_admin(email),
          createdAt: usuario.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "register_handler",
      request_id,
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error al registrar usuario",
          request_id,
        },
      }),
    );
  }
};
