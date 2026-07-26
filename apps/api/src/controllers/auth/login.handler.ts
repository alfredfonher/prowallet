import { Request, Response } from "express";
import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
  validar_email,
  validar_password,
  buscar_usuario_por_email,
  es_admin,
  obtener_error_credenciales,
} from "./auth.validators";

const JWT_SECRET =
  process.env.JWT_SECRET || "default-secret-change-in-production";
const TOKEN_EXPIRY = "24h";

/**
 * Handler para POST /api/v1/auth/login
 * Valida email/password y genera JWT token
 */
export const login_handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const request_id =
    (req as any).requestId || loggerService.generateRequestId();

  try {
    const { email, password } = req.body;

    // Validar inputs
    if (!validar_email(email)) {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Email requerido y válido (no vacío)",
            request_id,
          },
        }),
      );
      return;
    }

    if (!validar_password(password)) {
      res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.BAD_REQUEST,
          lang: "es",
          extra: {
            error: "Password requerido y válido (no vacío)",
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
      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: obtener_error_credenciales(),
            request_id,
          },
        }),
      );
      return;
    }

    // Verificar password con bcrypt
    const password_valido = await bcrypt.compare(password, usuario.password);
    if (!password_valido) {
      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: {
            error: obtener_error_credenciales(),
            request_id,
          },
        }),
      );
      return;
    }

    // Generar token JWT con formato consistente con register
    const token = jwt.sign(
      {
        user_id: usuario.id,
        email,
        is_admin: es_admin(email),
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY },
    );

    loggerService.logInfo(`Usuario autenticado: ${email}`, {
      context: "login_handler",
      request_id,
    });

    res.json({
      success: true,
      data: {
        token,
        expiresIn: TOKEN_EXPIRY,
        user: {
          id: usuario.id,
          email,
          isAdmin: es_admin(email),
          createdAt: usuario.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "login_handler",
      request_id,
    });

    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error: "Error al iniciar sesión",
          request_id,
        },
      }),
    );
  }
};
