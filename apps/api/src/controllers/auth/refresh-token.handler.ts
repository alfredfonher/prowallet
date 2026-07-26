import { Request, Response } from "express";
import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { TokenService } from "../../services/auth/token.service";

/**
 * Handler para POST /api/v1/auth/refresh
 * Rota el refresh token y genera un nuevo access token
 * Body: { refresh_token }
 *
 * SECURITY: Implements token rotation - old token is marked as used,
 * new token is issued to prevent token reuse attacks
 */
export const refresh_token_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    const { refresh_token } = req.body;

    // Validar que el token fue proporcionado
    if (!refresh_token || typeof refresh_token !== "string") {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Refresh token requerido",
            request_id,
          },
        }),
      );
      return;
    }

    // Verificar el refresh token
    let token_payload;
    try {
      token_payload = TokenService.verify_refresh_token(refresh_token);
    } catch (error) {
      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: "Refresh token inválido o expirado",
            request_id,
          },
        }),
      );
      return;
    }

    const prisma = databaseService.getClient();
    const token_hash = TokenService.hash_token(refresh_token);

    // Buscar el token en la base de datos
    const stored_token = await prisma.refreshToken.findUnique({
      where: { token_hash },
    });

    if (!stored_token) {
      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: "Refresh token no encontrado",
            request_id,
          },
        }),
      );
      return;
    }

    // Verificar que no está expirado
    if (stored_token.expires_at < new Date()) {
      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: "Refresh token expirado",
            request_id,
          },
        }),
      );
      return;
    }

    // Verificar que no está revocado
    if (stored_token.revoked_at) {
      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: "Refresh token ha sido revocado",
            request_id,
          },
        }),
      );
      return;
    }

    // Obtener usuario
    const usuario = await prisma.user.findUnique({
      where: { id: token_payload.user_id },
    });

    if (!usuario) {
      res.status(404).json(
        StatusFlow({
          code: StatusFlowCodes.NOT_FOUND,
          lang: "es",
          extra: {
            error: "Usuario no encontrado",
            request_id,
          },
        }),
      );
      return;
    }

    // Verificar que el email coincide (seguridad adicional)
    if (usuario.email !== token_payload.email) {
      loggerService.logInfo(
        "Email mismatch en refresh token - posible ataque",
        {
          context: "refresh_token_handler",
          request_id,
          user_id: token_payload.user_id,
        },
      );

      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: "Refresh token inválido",
            request_id,
          },
        }),
      );
      return;
    }

    // Token rotation:
    // 1. Marcar el token viejo como usado
    // 2. Generar un nuevo refresh token

    const new_refresh_token_data = TokenService.generate_refresh_token_data(
      usuario.id,
    );
    const new_refresh_token = TokenService.generate_secure_token();

    // Actualizar tokens en una transacción
    await prisma.$transaction([
      // Marcar el token viejo como usado
      prisma.refreshToken.update({
        where: { id: stored_token.id },
        data: { used_at: new Date() },
      }),

      // Crear el nuevo token
      prisma.refreshToken.create({
        data: {
          user_id: usuario.id,
          token_hash: TokenService.hash_token(new_refresh_token),
          expires_at: new_refresh_token_data.expires_at,
        },
      }),
    ]);

    // Generar nuevo access token
    const new_access_token = TokenService.generate_access_token(
      usuario.id,
      usuario.email,
      false, // TODO: Check admin status
    );

    loggerService.logInfo(`Token refrescado para usuario: ${usuario.email}`, {
      context: "refresh_token_handler",
      request_id,
      user_id: usuario.id,
    });

    // Retornar los nuevos tokens
    res.json({
      success: true,
      data: {
        access_token: new_access_token,
        refresh_token: new_refresh_token,
        user: {
          id: usuario.id,
          email: usuario.email,
          is_email_verified: usuario.is_email_verified,
        },
      },
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "refresh_token_handler",
      request_id,
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error al refrescar token",
          request_id,
        },
      }),
    );
  }
};
