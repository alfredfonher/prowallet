import { Request, Response } from "express";
import { body, param, query } from "express-validator";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { loggerService } from "../../services/logging/logger.service";
import { databaseService } from "../../services/database/database.service";
import { solanaService } from "../../services/solana/solana.service";
import { PublicKey } from "@solana/web3.js";

/**
 * ExchangeController - MVP Exchange con Solana (web3.js puro)
 * (renombrado desde SimpleExchangeController)
 */

const TOKEN_PRICE = 0; // USD per token - PROWALLET tokens are FREE

export class ExchangeController {
  async buyTokens(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const { amount, email, publicKey } = req.body;

      // Validaciones mejoradas
      if (!email || typeof email !== "string" || email.trim().length === 0) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "Email es requerido",
              requestId,
            },
          }),
        );
        return;
      }

      if (!amount || isNaN(amount) || amount <= 0) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "El monto debe ser un número válido mayor a 0",
              requestId,
            },
          }),
        );
        return;
      }

      // Validar límites de amount
      if (amount > 100000) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "El monto excede el límite máximo de 100000 USD",
              requestId,
            },
          }),
        );
        return;
      }

      let userPublicKey: PublicKey | null = null;
      if (publicKey) {
        try {
          userPublicKey = new PublicKey(publicKey);
          const solBalance = await solanaService
            .getConnection()
            .getBalance(userPublicKey);
          loggerService.logInfo(
            `Usuario Solana verificado: ${solBalance / 1e9} SOL`,
            {
              context: "Exchange.buyTokens",
              publicKey: userPublicKey.toString(),
            },
          );
        } catch (e) {
          res.status(400).json(
            StatusFlow({
              code: StatusFlowCodes.BAD_REQUEST,
              lang: "es",
              extra: {
                error: "Formato de clave pública Solana inválido",
                requestId,
              },
            }),
          );
          return;
        }
      }

      if (process.env.WHITELIST_ENABLED === "true") {
        const prisma = databaseService.getClient();
        let walletToCheck: string | null = null;

        if (userPublicKey) {
          walletToCheck = userPublicKey.toString();
        } else {
          const existing = await databaseService
            .getClient()
            .user.findUnique({ where: { email } });
          if (existing && existing.solanaPublicKey) {
            walletToCheck = existing.solanaPublicKey;
          }
        }

        if (!walletToCheck) {
          res.status(403).json(
            StatusFlow({
              code: StatusFlowCodes.FORBIDDEN,
              lang: "es",
              extra: {
                error:
                  "Wallet no vinculado o proporcionado (whitelist requerido)",
              },
            }),
          );
          return;
        }

        const found = await prisma.whitelistEntry.findUnique({
          where: { wallet: walletToCheck },
        });
        if (!found) {
          res.status(403).json(
            StatusFlow({
              code: StatusFlowCodes.FORBIDDEN,
              lang: "es",
              extra: { error: "El wallet no está en la lista blanca" },
            }),
          );
          return;
        }
      }

      const tokensReceived = Math.floor((amount / TOKEN_PRICE) * 1e9);

      const prisma = databaseService.getClient();
      const result = await prisma.$transaction(async (tx: any) => {
        let user = await tx.user.findUnique({ where: { email } });

        if (!user) {
          user = await tx.user.create({
            data: {
              email,
              tokenBalance: BigInt(tokensReceived),
              usdSpent: amount,
            },
          });
        } else {
          user = await tx.user.update({
            where: { email },
            data: {
              tokenBalance: user.tokenBalance + BigInt(tokensReceived),
              usdSpent: user.usdSpent + amount,
            },
          });
        }

        await tx.userTransaction.create({
          data: {
            type: "BUY",
            email,
            amountTokens: BigInt(tokensReceived),
            amountUsd: amount,
            priceAtTx: TOKEN_PRICE,
            status: "completed",
          },
        });

        return user;
      });

      loggerService.logInfo(`Usuario ${email} compró tokens`, {
        context: "Exchange.buyTokens",
        requestId,
        amount,
        tokens: tokensReceived,
        hasSolanaKey: !!userPublicKey,
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            success: true,
            data: {
              email,
              tokensPurchased: (
                BigInt(tokensReceived) / BigInt(1e9)
              ).toString(),
              usdSpent: amount,
              totalBalance: (result.tokenBalance / BigInt(1e9)).toString(),
              totalSpent: result.usdSpent,
              solanaPublicKey: userPublicKey?.toString() || null,
              timestamp: new Date().toISOString(),
            },
            requestId,
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "Exchange.buyTokens",
        requestId,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Error al comprar tokens",
            requestId,
          },
        }),
      );
    }
  }

  async sellTokens(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const { tokens, email } = req.body;

      // Validaciones mejoradas
      if (!email || typeof email !== "string" || email.trim().length === 0) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "El nombre de usuario es requerido",
              requestId,
            },
          }),
        );
        return;
      }

      if (!tokens || isNaN(tokens) || tokens <= 0) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error:
                "La cantidad de tokens debe ser un número válido mayor a 0",
              requestId,
            },
          }),
        );
        return;
      }

      // Validar límites de tokens
      if (tokens > 1000000000) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "La cantidad de tokens excede el límite máximo",
              requestId,
            },
          }),
        );
        return;
      }

      const tokensInNano = BigInt(Math.floor(tokens * 1e9));
      const usdReceived = tokens * TOKEN_PRICE;

      const prisma = databaseService.getClient();
      const result = await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.findUnique({
          where: { email },
        });

        if (!user) {
          throw new Error("Usuario no encontrado");
        }

        if (process.env.WHITELIST_ENABLED === "true") {
          const wallet = user.solanaPublicKey;
          if (!wallet) {
            throw new Error(
              "Wallet del usuario no vinculado (whitelist requerido)",
            );
          }

          const found = await tx.whitelistEntry.findUnique({
            where: { wallet },
          });
          if (!found) {
            throw new Error("El wallet del usuario no está en la lista blanca");
          }
        }

        if (user.tokenBalance < tokensInNano) {
          throw new Error("Saldo de tokens insuficiente");
        }

        const updated = await tx.user.update({
          where: { email },
          data: {
            tokenBalance: user.tokenBalance - tokensInNano,
          },
        });

        await tx.userTransaction.create({
          data: {
            type: "SELL",
            email,
            amountTokens: tokensInNano,
            amountUsd: usdReceived,
            priceAtTx: TOKEN_PRICE,
            status: "completed",
          },
        });

        return updated;
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            success: true,
            data: {
              email,
              tokensSold: tokens,
              usdReceived,
              totalBalance: (result.tokenBalance / BigInt(1e9)).toString(),
              timestamp: new Date().toISOString(),
            },
            requestId,
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "Exchange.sellTokens",
        requestId,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error ? error.message : "Error al vender tokens",
            requestId,
          },
        }),
      );
    }
  }

  async transferTokens(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const { fromUsername, toUsername, tokens } = req.body;

      // Validaciones mejoradas
      if (
        !fromUsername ||
        !toUsername ||
        typeof fromUsername !== "string" ||
        typeof toUsername !== "string" ||
        fromUsername.trim().length === 0 ||
        toUsername.trim().length === 0
      ) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error:
                "Los nombres de usuario remitente y destinatario son requeridos",
              requestId,
            },
          }),
        );
        return;
      }

      if (!tokens || isNaN(tokens) || tokens <= 0) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error:
                "La cantidad de tokens debe ser un número válido mayor a 0",
              requestId,
            },
          }),
        );
        return;
      }

      if (fromUsername === toUsername) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "No puedes transferir a ti mismo",
              requestId,
            },
          }),
        );
        return;
      }

      // Validar límites de tokens
      if (tokens > 1000000000) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "La cantidad de tokens excede el límite máximo",
              requestId,
            },
          }),
        );
        return;
      }

      const tokensInNano = BigInt(Math.floor(tokens * 1e9));

      const prisma = databaseService.getClient();
      const result = await prisma.$transaction(async (tx: any) => {
        const fromUser = await tx.user.findUnique({
          where: { email: fromUsername },
        });

        if (!fromUser) {
          throw new Error("Remitente no encontrado");
        }

        if (process.env.WHITELIST_ENABLED === "true") {
          if (!fromUser.solanaPublicKey) {
            throw new Error(
              "Wallet del remitente no vinculado (whitelist requerido)",
            );
          }

          const found = await tx.whitelistEntry.findUnique({
            where: { wallet: fromUser.solanaPublicKey },
          });
          if (!found) {
            throw new Error(
              "El wallet del remitente no está en la lista blanca",
            );
          }
        }

        if (fromUser.tokenBalance < tokensInNano) {
          throw new Error("Saldo de tokens insuficiente");
        }

        const toUser = await tx.user.findUnique({
          where: { email: toUsername },
        });

        if (!toUser) {
          throw new Error("Destinatario no encontrado");
        }

        const updatedFrom = await tx.user.update({
          where: { email: fromUsername },
          data: {
            tokenBalance: fromUser.tokenBalance - tokensInNano,
          },
        });

        const updatedTo = await tx.user.update({
          where: { email: toUsername },
          data: { tokenBalance: toUser.tokenBalance + tokensInNano },
        });

        await tx.userTransaction.create({
          data: {
            type: "TRANSFER",
            email: fromUsername,
            amountTokens: tokensInNano,
            amountUsd: Number(tokens) * TOKEN_PRICE,
            priceAtTx: TOKEN_PRICE,
            status: "completed",
          },
        });

        return { updatedFrom, updatedTo };
      });

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            success: true,
            data: {
              fromUsername,
              toUsername,
              tokensTransferred: tokens,
              timestamp: new Date().toISOString(),
            },
            requestId,
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "Exchange.transferTokens",
        requestId,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Error al transferir tokens",
            requestId,
          },
        }),
      );
    }
  }

  async getBalance(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();

    try {
      const email = req.params.email;

      // Validación mejorada
      if (!email || typeof email !== "string" || email.trim().length === 0) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "El nombre de usuario es requerido",
              requestId,
            },
          }),
        );
        return;
      }

      // Validar formato de email (solo caracteres alfanuméricos y guiones bajos)
      if (!/^[a-zA-Z0-9_]+$/.test(email)) {
        res.status(400).json(
          StatusFlow({
            code: StatusFlowCodes.BAD_REQUEST,
            lang: "es",
            extra: {
              error: "El nombre de usuario contiene caracteres inválidos",
              requestId,
            },
          }),
        );
        return;
      }

      const prisma = databaseService.getClient();
      const user = await prisma.user.findUnique({
        where: { email },
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

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            success: true,
            data: {
              email: user.email,
              balance: (user.tokenBalance / BigInt(1e9)).toString(),
              totalSpent: user.usdSpent,
              hasTransactions: true,
            },
            requestId,
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "Exchange.getBalance",
        requestId,
      });

      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: { error: "Error al obtener saldo", requestId },
        }),
      );
    }
  }

  async getPrice(req: Request, res: Response): Promise<void> {
    const requestId =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            success: true,
            data: { tokenPrice: TOKEN_PRICE, currency: "USD" },
            requestId,
          },
        }),
      );
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "Exchange.getPrice",
        requestId,
      });
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: { error: "Error al obtener precio", requestId },
        }),
      );
    }
  }
}

export const exchangeController = new ExchangeController();

// ✅ Validators con validación de inputs mejorada
export const exchangeValidators = {
  buyTokens: [
    body("email")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Nombre de usuario es requerido")
      .isLength({ min: 3, max: 50 })
      .withMessage("El nombre de usuario debe tener entre 3 y 50 caracteres")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores",
      ),
    body("amount")
      .isFloat({ min: 0.01, max: 100000 })
      .withMessage("El monto debe estar entre 0.01 y 100000 USD"),
    body("publicKey")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("La clave pública no debe estar vacía")
      .custom((value) => {
        try {
          new PublicKey(value);
          return true;
        } catch (e) {
          throw new Error("Formato de clave pública Solana inválido");
        }
      }),
  ],
  sellTokens: [
    body("email")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Nombre de usuario es requerido")
      .isLength({ min: 3, max: 50 })
      .withMessage("El nombre de usuario debe tener entre 3 y 50 caracteres")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores",
      ),
    body("tokens")
      .isFloat({ min: 0.000000001, max: 1000000000 })
      .withMessage("Los tokens deben estar entre 0.000000001 y 1000000000"),
  ],
  transferTokens: [
    body("fromUsername")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("El email de origen es requerido")
      .isLength({ min: 3, max: 50 })
      .withMessage("El nombre de usuario debe tener entre 3 y 50 caracteres")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores",
      ),
    body("toUsername")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("El email de destino es requerido")
      .isLength({ min: 3, max: 50 })
      .withMessage("El nombre de usuario debe tener entre 3 y 50 caracteres")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores",
      )
      .custom((value, { req }) => {
        if (value === req.body.fromUsername) {
          throw new Error("No puedes transferir a ti mismo");
        }
        return true;
      }),
    body("tokens")
      .isFloat({ min: 0.000000001, max: 1000000000 })
      .withMessage("Los tokens deben estar entre 0.000000001 y 1000000000"),
  ],
  getBalance: [
    param("email")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Nombre de usuario es requerido")
      .isLength({ min: 3, max: 50 })
      .withMessage("El nombre de usuario debe tener entre 3 y 50 caracteres")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores",
      ),
  ],
  getPrice: [],
};
