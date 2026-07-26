import { Request, Response } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import jwt from "jsonwebtoken";
import { loggerService } from "../../services/logging/logger.service";
import { databaseService } from "../../services/database/database.service";
import { authChallengeService } from "../../services/auth-challenge.service";
import { PublicKey } from "@solana/web3.js";
import { getRequiredEnvVar } from "../../utils/env";

/**
 * AuthController - Métodos para wallet-based auth y gestión de usuario
 * NOTA: register/login con email/password están en handlers separados
 */

const TOKEN_EXPIRY = "24h";

export class AuthController {
  /**
   * POST /auth/login-wallet
   * Verifica la firma del wallet y retorna JWT token
   */
  async loginWallet(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const { publicKey, message, signature } = req.body;

      if (!publicKey || !message || !signature) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "publicKey, message, y signature son requeridos",
              requestId,
            },
          }),
        );
        return;
      }

      // Verificar el desafío
      const result = await authChallengeService.verifyAndConsume(publicKey, {
        message,
      });

      if (!result || !result.ok) {
        res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
            extra: {
              error: "Firma inválida o desafío expirado",
              requestId,
            },
          }),
        );
        return;
      }

      const prisma = databaseService.getClient();

      // Buscar o crear usuario
      let user = await prisma.user.findUnique({
        where: { solanaPublicKey: publicKey },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: `wallet-${publicKey}@prowallet.local`,
            solanaPublicKey: publicKey,
            tokenBalance: BigInt(0),
            usdSpent: 0,
          },
        });
      }

      // Generar JWT token
      const token = jwt.sign(
        {
          user_id: user.id,
          email: user.email,
          solanaPublicKey: publicKey,
          iat: Math.floor(Date.now() / 1000),
        },
        getRequiredEnvVar("JWT_SECRET"),
        { expiresIn: TOKEN_EXPIRY },
      );

      loggerService.logInfo(`Usuario autenticado con wallet: ${publicKey}`, {
        context: "loginWallet",
        requestId,
      });

      res.json({
        success: true,
        data: {
          token,
          expiresIn: TOKEN_EXPIRY,
          user: {
            id: user.id,
            email: user.email,
            solanaPublicKey: publicKey,
            createdAt: user.createdAt.toISOString(),
          },
        },
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "loginWallet",
        requestId,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: "Error al autenticar con wallet",
            requestId,
          },
        }),
      );
    }
  }

  /**
   * GET /auth/me
   * Retorna los datos del usuario autenticado
   */
  async me(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const tokenUser = (req as any).user as any;

      if (!tokenUser || !tokenUser.user_id) {
        res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
            extra: { error: "Token inválido", requestId },
          }),
        );
        return;
      }

      const prisma = databaseService.getClient();
      const user = await prisma.user.findUnique({
        where: { id: tokenUser.user_id },
      });

      if (!user) {
        res.status(404).json(
          StatusFlow({
            code: StatusFlowCodes.NOT_FOUND,
            lang: "es",
            extra: { error: "Usuario no encontrado", requestId },
          }),
        );
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          solanaPublicKey: user.solanaPublicKey,
          tokenBalance: user.tokenBalance.toString(),
          usdSpent: user.usdSpent,
          createdAt: user.createdAt.toISOString(),
        },
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "me",
        requestId,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: "Error al obtener datos del usuario",
            requestId,
          },
        }),
      );
    }
  }

  /**
   * POST /auth/link-wallet
   * Vincula un wallet de Solana a un usuario autenticado
   */
  async linkWallet(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const tokenUser = (req as any).user as any;
      const { solanaPublicKey, message, signature } = req.body;

      // Validar usuario autenticado
      if (!tokenUser || !tokenUser.user_id) {
        res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
            extra: { error: "Token inválido", requestId },
          }),
        );
        return;
      }

      // Validar parámetros requeridos
      if (!solanaPublicKey || typeof solanaPublicKey !== "string") {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "solanaPublicKey es requerido",
              requestId,
            },
          }),
        );
        return;
      }

      if (!message || typeof message !== "string") {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "message es requerido",
              requestId,
            },
          }),
        );
        return;
      }

      if (!signature || typeof signature !== "string") {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "signature es requerida",
              requestId,
            },
          }),
        );
        return;
      }

      // Validar que es una dirección Solana válida
      try {
        new PublicKey(solanaPublicKey);
      } catch {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "solanaPublicKey inválido",
              requestId,
            },
          }),
        );
        return;
      }

      // Importar servicios de validación
      const { verify_wallet_signature } =
        await import("../../features/auth/wallet-signature.service");

      // Validar la firma
      const signature_result = await verify_wallet_signature({
        public_key: solanaPublicKey,
        message,
        signature,
      });

      if (!signature_result.is_valid) {
        res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
            extra: {
              error: "La firma no es válida",
              requestId,
            },
          }),
        );
        return;
      }

      const prisma = databaseService.getClient();

      // Actualizar usuario con wallet
      const user = await prisma.user.update({
        where: { id: tokenUser.user_id },
        data: { solanaPublicKey },
      });

      loggerService.logInfo(`Wallet vinculado al usuario: ${user.email}`, {
        context: "linkWallet",
        requestId,
      });

      res.json({
        success: true,
        data: {
          message: "Wallet vinculado exitosamente",
          user: {
            id: user.id,
            email: user.email,
            solanaPublicKey: user.solanaPublicKey,
          },
        },
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "linkWallet",
        requestId,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: "Error al vincular wallet",
            requestId,
          },
        }),
      );
    }
  }

  /**
   * GET /auth/verify
   * Verifica que el token JWT sea válido
   */
  async verify(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const tokenUser = (req as any).user as any;

      if (!tokenUser || !tokenUser.user_id) {
        res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
            extra: { error: "Token inválido", requestId },
          }),
        );
        return;
      }

      res.json({
        success: true,
        data: {
          message: "Token válido",
          user: {
            id: tokenUser.user_id,
            email: tokenUser.email,
          },
        },
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "verify",
        requestId,
      });

      res.status(401).json(
        StatusFlow({
          code: StatusFlowCodes.UNAUTHORIZED,
          lang: "es",
          extra: { error: "Token inválido", requestId },
        }),
      );
    }
  }

  /**
   * DELETE /auth/unlink-wallet
   * Desvincula la wallet del usuario manteniendo la sesión activa
   * NO hace logout
   */
  async unlink_wallet(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const tokenUser = (req as any).user as any;

      // Validar usuario autenticado
      if (!tokenUser || !tokenUser.user_id) {
        res.status(401).json(
          StatusFlow({
            code: StatusFlowCodes.UNAUTHORIZED,
            lang: "es",
            extra: { error: "Token inválido", requestId },
          }),
        );
        return;
      }

      const prisma = databaseService.getClient();

      // Desvincular wallet del usuario
      const updated_user = await prisma.user.update({
        where: { id: tokenUser.user_id },
        data: { solanaPublicKey: null },
      });

      loggerService.logInfo("Wallet desvinculada exitosamente", {
        requestId,
        userId: tokenUser.user_id,
        context: "unlink_wallet",
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            message: "Wallet desvinculada correctamente",
            user: {
              id: updated_user.id,
              email: updated_user.email,
            },
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "unlink_wallet",
        requestId,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: "Error al desvincular wallet",
            requestId,
          },
        }),
      );
    }
  }
}

export const authController = new AuthController();
