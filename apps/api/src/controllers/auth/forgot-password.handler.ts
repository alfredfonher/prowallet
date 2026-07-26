import { Request, Response } from "express";
import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { validar_email, buscar_usuario_por_email } from "./auth.validators";
import { TokenService } from "../../services/auth/token.service";
import { EmailService } from "../../services/auth/email.service";

const TOKEN_EXPIRY_HOURS = 1; // Token válido por 1 hora

/**
 * Handler para POST /api/v1/auth/forgot-password
 * Genera un token de recuperación y envía email con link de reset
 * Body: { email }
 * Response: { message: "Email enviado..." }
 */
export const forgot_password_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    const { email } = req.body;

    // Validar email
    if (!validar_email(email)) {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Email válido requerido",
            request_id,
          },
        }),
      );
      return;
    }

    const prisma = databaseService.getClient();

    // Buscar usuario por email
    const usuario = await buscar_usuario_por_email(prisma, email);
    if (!usuario || !usuario.password) {
      // SECURITY: No revelar si el usuario existe o no
      // Respuesta genérica para ambos casos
      res.status(200).json({
        success: true,
        data: {
          message:
            "Si el email existe, recibirás un enlace para recuperar tu contraseña en breve",
        },
        request_id,
      });
      return;
    }

    // Generar token de recuperación (32 bytes = 64 caracteres hex)
    const token_recuperacion = TokenService.generate_secure_token();
    const token_hash = TokenService.hash_token(token_recuperacion);
    const expira_en = new Date(
      Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    // Guardar token hashed en base de datos
    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        password_reset_token: token_hash,
        password_reset_expires: expira_en,
      },
    });

    // Enviar email con link de recuperación
    const url_base_frontend =
      process.env.FRONTEND_BASE_URL || "http://localhost:3000";

    await EmailService.enviar_email_recuperar_password(
      email,
      token_recuperacion,
      url_base_frontend,
    );

    loggerService.logInfo(`Token de recuperación generado para: ${email}`, {
      context: "forgot_password_handler",
      request_id,
      user_id: usuario.id,
      expires_in_hours: TOKEN_EXPIRY_HOURS,
    });

    // SECURITY: Respuesta genérica para no revelar si el usuario existe
    res.status(200).json({
      success: true,
      data: {
        message:
          "Si el email existe, recibirás un enlace para recuperar tu contraseña en breve",
      },
      request_id,
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "forgot_password_handler",
      request_id,
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error al procesar solicitud de recuperación",
          request_id,
        },
      }),
    );
  }
};
