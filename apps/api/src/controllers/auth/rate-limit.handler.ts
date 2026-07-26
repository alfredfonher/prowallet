import { Request, Response } from "express";
import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";

/**
 * Handler para POST /dev/disable-rate-limiting
 * Permite deshabilitar o reabilitar el rate limiting desde el frontend
 */
export const rate_limit_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    const { action } = req.query;

    if (!action || typeof action !== "string") {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Acción requerida (action debe ser 'enable' o 'disable')",
            request_id,
          },
        }),
      );
      return;
    }

    if (action !== "enable" && action !== "disable") {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Acción inválida. Debe ser 'enable' o 'disable'",
            request_id,
          },
        }),
      );
      return;
    }

    const prisma = databaseService.getClient();

    if (action === "disable") {
      // Deshabilitar rate limiting
      process.env.RATE_LIMITING_ENABLED = "false";
      res.json({
        success: true,
        data: {
          message: "Rate limiting deshabilitado",
          rate_limiting_enabled: false,
        },
        request_id,
      });

      loggerService.logInfo("Rate limiting deshabilitado", {
        context: "rate_limit_handler",
        request_id,
      });
    } else if (action === "enable") {
      // Habilitar rate limiting
      process.env.RATE_LIMITING_ENABLED = "true";
      res.json({
        success: true,
        data: {
          message: "Rate limiting habilitado",
          rate_limiting_enabled: true,
        },
        request_id,
      });

      loggerService.logInfo("Rate limiting habilitado", {
        context: "rate_limit_handler",
        request_id,
      });
    } else {
      // Obtener estado actual
      const is_enabled = process.env.RATE_LIMITING_ENABLED === "true";

      res.json({
        success: true,
        data: {
          message: `Rate limiting está ${
            is_enabled ? "habilitado" : "deshabilitado"
          }`,
          rate_limiting_enabled: is_enabled,
        },
        request_id,
      });

      loggerService.logInfo("Estado del rate limiting obtenido", {
        context: "rate_limit_handler",
        request_id,
        rate_limiting_enabled: is_enabled,
      });
    }
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "rate_limit_handler",
      request_id,
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error interno del servidor al cambiar rate limiting",
          request_id,
        },
      }),
    );
  }
};
