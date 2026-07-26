import { Response } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";

export type ExtraPayload = Record<string, any> | null;

/**
 * Envía una respuesta de éxito usando StatusFlow internamente.
 * El middleware global normalizará el objeto hacia { success, message, code, extra }.
 */
export function sendSuccess(
  res: Response,
  extra: ExtraPayload = null,
  message = "OK",
  code = StatusFlowCodes.OK,
) {
  const payload: any = {
    code,
    lang: "es",
    message,
  };

  if (extra !== null) payload.extra = extra;

  return res.json(StatusFlow(payload));
}

/**
 * Envía una respuesta de error usando StatusFlow internamente.
 */
export function sendError(
  res: Response,
  message = "Error",
  code = StatusFlowCodes.INTERNAL_SERVER_ERROR,
  extra: ExtraPayload = null,
) {
  const payload: any = {
    code,
    lang: "es",
    message,
    success: false,
  };

  if (extra !== null) payload.extra = extra;

  res.status(code === StatusFlowCodes.OK ? 200 : code);
  return res.json(StatusFlow(payload));
}

export default {
  sendSuccess,
  sendError,
};
