import { Request, Response } from "express";
import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { TokenService } from "../../services/auth/token.service";

/**
 * Handler para GET /api/v1/auth/verify-email
 * Valida el token de verificación de email y marca el usuario como verificado
 * Token debe venir en el query parameter: ?token=xxxxx
 */
export const email_verify_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    const { token } = req.query;

    // Validar que el token fue proporcionado
    if (!token || typeof token !== "string" || !token.trim()) {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Token de verificación requerido",
            request_id,
          },
        }),
      );
      return;
    }

    const prisma = databaseService.getClient();
    const token_hash = TokenService.hash_token(token);

    // Buscar el token de verificación
    const verification_token = await prisma.emailVerificationToken.findUnique({
      where: { token_hash },
    });

    if (!verification_token) {
      res.status(404).json(
        StatusFlow({
          code: StatusFlowCodes.NOT_FOUND,
          lang: "es",
          extra: {
            error: "Token de verificación no válido",
            request_id,
          },
        }),
      );
      return;
    }

    // Verificar que el token no ha expirado
    if (verification_token.expires_at < new Date()) {
      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error:
              "Token de verificación expirado. Por favor, registra nuevamente.",
            request_id,
          },
        }),
      );
      return;
    }

    // Verificar que el token no ha sido usado
    if (verification_token.used_at) {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Este token ya fue utilizado",
            request_id,
          },
        }),
      );
      return;
    }

    // Actualizar usuario como verificado
    const usuario = await prisma.user.update({
      where: { id: verification_token.user_id },
      data: {
        is_email_verified: true,
        email_verified_at: new Date(),
      },
    });

    // Marcar el token como utilizado
    await prisma.emailVerificationToken.update({
      where: { id: verification_token.id },
      data: {
        used_at: new Date(),
      },
    });

    loggerService.logInfo(`Email verificado para usuario: ${usuario.email}`, {
      context: "email_verify_handler",
      request_id,
      user_id: usuario.id,
    });

    // Generar nuevo access token con email verificado
    const access_token = TokenService.generate_access_token(
      usuario.id,
      usuario.email,
      false, // is_admin check omitted for now
    );

    res.json({
      success: true,
      data: {
        message: "Email verificado exitosamente",
        access_token,
        user: {
          id: usuario.id,
          email: usuario.email,
          is_email_verified: true,
          createdAt: usuario.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "email_verify_handler",
      request_id,
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error al verificar email",
          request_id,
        },
      }),
    );
  }
};
