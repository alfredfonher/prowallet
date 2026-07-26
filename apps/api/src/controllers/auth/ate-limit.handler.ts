import { Request, Response } from "express";
import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";

/**
 * Handler para POST /dev/disable-rate-limiting
 * Deshabilita/habilita rate limiting para desarrollo
 */
export const handle_disable_rate_limiting = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    const { action } = req.body;

    // Validar acción
    if (!action || typeof action !== "string") {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Acción requerida (enable/disable)",
            request_id,
          },
        }),
      );
      return;
    }

    // Actualizar estado
    const isEnabled = action === "enable";

    // Log el estado actual
    loggerService.logInfo(`Rate limiting ${isEnabled ? "habilitado" : "deshabilitado"}`, {
      context: "disable_rate_limit_handler",
      request_id,
    });

    res.json({
      success: true,
      data: {
        message: `Rate limiting está ${isEnabled ? "habilitado" : "deshabilitado"}`,
        rate_limiting_enabled: isEnabled,
      },
    });

  } catch (error) {
    loggerService.logError(error as Error, {
      context: "disable_rate_limit_handler",
      request_id,
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error al cambiar rate limiting",
          request_id,
        },
      }),
    );
  }
};
