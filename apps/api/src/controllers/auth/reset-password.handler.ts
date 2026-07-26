import { Request, Response } from "express";
import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { validar_password, obtener_errores_password } from "./auth.validators";
import { PasswordService } from "../../services/auth/password.service";
import { TokenService } from "../../services/auth/token.service";

/**
 * Handler para POST /api/v1/auth/reset-password
 * Resetea la contraseña usando un token de recuperación válido
 * Body: { token, password }
 */
export const reset_password_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    const { token, password } = req.body;

    // Validar inputs
    if (!token || typeof token !== "string" || !token.trim()) {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Token de recuperación requerido",
            request_id,
          },
        }),
      );
      return;
    }

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
    const token_hash = TokenService.hash_token(token);

    // Buscar usuario con este token de reset válido
    const usuario = await prisma.user.findFirst({
      where: {
        password_reset_token: token_hash,
        password_reset_expires: {
          gt: new Date(), // Token no ha expirado
        },
      },
    });

    if (!usuario) {
      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: "Token inválido o expirado",
            request_id,
          },
        }),
      );
      return;
    }

    // Hash de la nueva contraseña
    const password_hasheado = await PasswordService.hash_password(password);

    // Actualizar usuario
    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        password: password_hasheado,
        password_reset_token: null,
        password_reset_expires: null,
      },
    });

    loggerService.logInfo(
      `Contraseña reseteada para usuario: ${usuario.email}`,
      {
        context: "reset_password_handler",
        request_id,
        user_id: usuario.id,
      },
    );

    res.json({
      success: true,
      data: {
        message: "Contraseña actualizada exitosamente",
        email: usuario.email,
      },
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "reset_password_handler",
      request_id,
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error al resetear contraseña",
          request_id,
        },
      }),
    );
  }
};
