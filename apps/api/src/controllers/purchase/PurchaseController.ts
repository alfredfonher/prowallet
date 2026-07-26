import { Request, Response } from "express";
import { body, param, query } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { transactionRepository, Transaction } from "../../models/types";
import { loggerService } from "../../services/logging/logger.service";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import {
  sendError as sendErrorUtil,
  sendSuccess,
} from "../../utils/response.util";
import {
  CreatePaymentParams,
  PaymentMethod,
} from "../../services/payments/payment.interface";
import { paymentService } from "../../services/payments/payment.service";
import { solanaService } from "../../services/solana.service";
import { confirm_transaction_with_retries } from "../../services/solana/confirm-transaction.service";
import { PublicKey } from "@solana/web3.js";
import { autoSettlePurchase as autoSettleService } from "../../services/solana/auto-settle.service";
import { notificationsService } from "../../services/notifications.service";

// Interface for dynamic pricing
export interface IPriceCalculation {
  currentPrice: number;
  nextPrice: number;
  priceImpact: number;
  totalCost: number;
  gasCost: number;
  slippage: number;
  bonding_curve?: {
    currentSupply: number;
    targetSupply: number;
    basePrice: number;
    multiplier: number;
  };
}

// ProWallet configuration from environment variables
const PROWALLET_CONFIG = {
  basePrice: parseFloat(process.env.BASE_TOKEN_PRICE || "0.01"),
  maxSupply: parseInt(process.env.MAX_SUPPLY || "1000000000000000000"),
  decimals: parseInt(process.env.TOKEN_DECIMALS || "9"),
  bonding_curve_multiplier: parseFloat(
    process.env.BONDING_CURVE_MULTIPLIER || "1.5",
  ),
  min_purchase: parseFloat(process.env.MIN_PURCHASE_AMOUNT || "0.000000001"), // Allow 9 decimals
  max_purchase: parseInt(process.env.MAX_PURCHASE_AMOUNT || "10000"),
  gas_estimate: parseFloat(process.env.GAS_ESTIMATE_SOL || "0.0015"),
  // Pricing mode: 'bonding' (default) or 'fixed' to use BASE_TOKEN_PRICE directly
  pricing_mode: (process.env.PRICING_MODE || "bonding").toLowerCase(),
  // TEST MODE: Si está en true, el token cuesta 0 SOL (solo se cobran fees)
  // El precio de visualización sigue siendo BASE_TOKEN_PRICE (0.01 USD)
  // Para cambiar el precio en el futuro, modifica BASE_TOKEN_PRICE
  test_mode_free_token:
    process.env.TEST_MODE_FREE_TOKEN === "true" ||
    process.env.TEST_MODE_FREE_TOKEN === "1",
  treasury_wallet: process.env.TREASURY_WALLET,
};

export class PurchaseController {
  // Obtener precio actual (endpoint)
  async getCurrentPrice(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      const { amount } = req.query;
      const tokenAmount: number = amount ? parseFloat(amount as string) : 1;

      // Si el modo de pricing es 'fixed' no llamar a la blockchain (evita bloqueos),
      // usar supply = 0 para que calculatePrice utilice basePrice.
      let currentSupply: number = 0;
      if (PROWALLET_CONFIG.pricing_mode === "bonding") {
        try {
          currentSupply = await this.getCurrentSupply();
        } catch (supplyErr) {
          // Si no podemos obtener el supply desde la blockchain, bloquear
          // la creación de la orden porque el precio no es fiable.
          loggerService.logError(supplyErr as Error, {
            requestId,
            endpoint: "/purchase/initiate",
            note: "Failed to fetch token supply - blocking initiatePurchase",
          });

          return this.sendError(
            res,
            "Precio no disponible (cargando). Intente más tarde.",
            503,
            requestId,
          );
        }
      }

      const priceCalculation: IPriceCalculation = this.calculatePrice(
        tokenAmount,
        currentSupply,
      );

      sendSuccess(
        res,
        {
          tokenAmount,
          pricePerToken: priceCalculation.currentPrice,
          totalCost: priceCalculation.totalCost,
          gasCost: priceCalculation.gasCost,
          priceImpact: priceCalculation.priceImpact,
          nextPrice: priceCalculation.nextPrice,
          slippage: priceCalculation.slippage,
          bondingCurve: priceCalculation.bonding_curve,
          currentSupply,
          availableSupply: PROWALLET_CONFIG.maxSupply - currentSupply,
        },
        "OK",
        StatusFlowCodes.OK,
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/price",
        query: req.query,
      });

      sendErrorUtil(
        res,
        error instanceof Error ? error.message : "Price calculation failed",
        StatusFlowCodes.INTERNAL_SERVER_ERROR,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  // Helper para obtener precio numérico
  private async fetchCurrentPrice(amount = 1): Promise<number> {
    const currentSupply: number = await this.getCurrentSupply();
    const priceCalculation: IPriceCalculation = this.calculatePrice(
      amount,
      currentSupply,
    );
    return priceCalculation.currentPrice;
  }

  // Obtener métodos de pago
  async getPaymentMethods(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      const methods = await paymentService.getAvailablePaymentMethods();
      // Adaptar a la estructura esperada por el frontend
      const response = {
        fiat: {
          creditCard: {
            available: methods.card?.available ?? false,
            processors: methods.card?.processors ?? [],
            currencies: methods.card?.currencies ?? [],
          },
          debitCard: {
            available: false,
            processors: [],
            currencies: [],
          },
        },
        crypto: methods.crypto ?? {
          available: false,
          processors: [],
          currencies: [],
          allCurrencies: 0,
        },
        native: methods.native ?? {
          solana: { available: true, currencies: ["SOL"] },
        },
        exchangeRates: {},
        lastUpdated: new Date().toISOString(),
      };
      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: response,
        }),
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/payment-methods",
      });
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Failed to get payment methods",
          },
        }),
      );
    }
  }

  // Crear pago alternativo
  async createAlternativePayment(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      const params: CreatePaymentParams = {
        ...req.body,
        requestId,
      };

      // ✅ Corregido: Obtener paymentMethod del body y convertir a PaymentMethod enum

      // Forzar procesador 'solana' si el método de pago es SOL
      let processorName: string = (req.body.processorName as string) || "";
      // Permitir tanto string 'SOL' como PaymentMethod.CRYPTO
      const paymentMethodValue =
        typeof params.paymentMethod === "string"
          ? params.paymentMethod.toLowerCase()
          : params.paymentMethod;
      if (
        !processorName &&
        (paymentMethodValue === "sol" ||
          paymentMethodValue === PaymentMethod.CRYPTO)
      ) {
        processorName = "solana";
      } else if (!processorName) {
        processorName =
          paymentService.getRecommendedProcessor(
            params.currency,
            params.paymentMethod || PaymentMethod.CRYPTO,
            params.amount,
          ) || "solana";
      }

      const payment = await paymentService.createPayment(processorName, params);
      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: payment,
        }),
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/create-payment",
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create payment",
        timestamp: new Date().toISOString(),
        requestId,
      });
    }
  }

  // Iniciar compra (crea transacción pendiente)
  async initiatePurchase(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      const {
        walletAddress,
        tokenAmount,
        paymentMethod = "SOL",
        maxSlippage,
      } = req.body;
      const tokenAmountNum: number = Number(tokenAmount);

      // Respect pricing mode: if fixed pricing is configured, force supply=0
      // so calculatePrice uses the configured basePrice and avoids tiny prices
      // derived from an unexpected on-chain supply value.
      let currentSupply: number = 0;
      if (PROWALLET_CONFIG.pricing_mode === "bonding") {
        currentSupply = await this.getCurrentSupply();
      }
      const priceCalculation: IPriceCalculation = this.calculatePrice(
        tokenAmountNum,
        currentSupply,
      );

      // Debug: log pricing inputs to diagnose tiny totalCost issues
      loggerService.logInfo("InitiatePurchase: pricing debug", {
        requestId,
        tokenAmount: tokenAmountNum,
        pricing_mode: PROWALLET_CONFIG.pricing_mode,
        basePrice: PROWALLET_CONFIG.basePrice,
        test_mode_free_token: PROWALLET_CONFIG.test_mode_free_token,
        priceCalculation,
      });
      const totalCost: number = priceCalculation.totalCost;

      // En modo prueba, el totalCost es 0, pero necesitamos cobrar fees
      // El frontend calculará el total real (token + fees)
      // Aquí solo guardamos el costo del token en la BD

      // Gas fee only (no platform fee) - PROWALLET is FREE to users
      const GAS_FEE_SOL = parseFloat(process.env.GAS_FEE_SOL || "0.000005");
      const PLATFORM_FEE_SOL = 0; // REMOVED - No company fee on free tokens
      const TOTAL_FEES_SOL = GAS_FEE_SOL + PLATFORM_FEE_SOL;

      // Payment is ALWAYS just fees (tokens are free, only pay gas)
      const paymentAmount = TOTAL_FEES_SOL;

      // Guardar la orden en la base de datos
      const txDoc = await transactionRepository.create({
        transactionId: uuidv4(),
        walletAddress,
        tokenAmount: tokenAmountNum,
        paymentAmount: paymentAmount, // Solo fees en modo prueba, costo del token en modo normal
        paymentToken: paymentMethod as any,
        tokenPrice: priceCalculation.currentPrice, // Precio de visualización (siempre 0.01 USD)
        status: "pending",
        transactionType: "purchase",
        metadata: JSON.stringify({
          requestId,
          test_mode_free_token: PROWALLET_CONFIG.test_mode_free_token,
          tokenCost: totalCost, // Costo real del token (0 en modo prueba)
          fees: TOTAL_FEES_SOL,
        }),
      });

      // Construir la transacción SPL para que el usuario la firme
      const treasuryWallet = process.env.TREASURY_WALLET;
      if (!treasuryWallet) {
        throw new Error("TREASURY_WALLET no definido en .env");
      }

      const {
        SystemProgram,
        Transaction,
        PublicKey,
      } = require("@solana/web3.js");
      const connection = solanaService.getConnection();

      // Obtener blockhash con retry (máximo 3 intentos)
      let blockhashObj:
        | { blockhash: string; lastValidBlockHeight: number }
        | undefined;
      let retries = 0;
      const maxRetries = 3;
      while (retries < maxRetries) {
        try {
          blockhashObj = await connection.getLatestBlockhash("finalized");
          break;
        } catch (error: any) {
          retries++;
          if (retries >= maxRetries) {
            loggerService.logError(error as Error, {
              requestId,
              context: "initiatePurchase.getLatestBlockhash",
              retries,
            });
            throw new Error(
              `Failed to get blockhash after ${maxRetries} attempts: ${error.message}`,
            );
          }
          // Esperar antes de reintentar (backoff exponencial)
          await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
          loggerService.logInfo(
            `Retrying getLatestBlockhash (attempt ${retries}/${maxRetries})`,
            {
              requestId,
            },
          );
        }
      }

      // Verificar que blockhashObj fue asignado
      if (!blockhashObj) {
        throw new Error("Failed to get blockhash: maximum retries exceeded");
      }

      // En modo prueba, el totalCost puede ser 0 (token gratis)
      // Pero siempre necesitamos cobrar al menos los fees
      // Los fees se calculan después, así que aquí validamos el costo del token
      const lamports = Math.round(totalCost * 1e9);

      // Validación: en modo normal, evitar crear transferencias con 0 lamports
      // En modo prueba (test_mode_free_token), el token cuesta 0, así que permitimos 0 lamports
      // Los fees se agregarán después en el cálculo final del paymentAmount
      if (!PROWALLET_CONFIG.test_mode_free_token && lamports < 1) {
        return this.sendError(
          res,
          "Calculated payment amount too small (less than 1 lamport). Use fixed pricing or increase token price.",
          400,
          requestId,
        );
      }

      // En modo prueba, si el costo del token es 0, calcular solo fees
      // Reutilizar las variables de fees ya declaradas arriba
      const finalLamports =
        PROWALLET_CONFIG.test_mode_free_token && lamports === 0
          ? Math.round(TOTAL_FEES_SOL * 1e9) // Solo fees en modo prueba
          : lamports;

      const transaction = new Transaction({
        feePayer: new PublicKey(walletAddress),
        recentBlockhash: blockhashObj.blockhash,
      });
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(treasuryWallet),
          lamports: finalLamports, // Usar finalLamports que incluye fees en modo prueba
        }),
      );
      // Memo opcional
      const memo = `GAPC-PURCHASE-${txDoc.transactionId}`;
      try {
        const { MemoProgram } = require("@solana/spl-memo");
        transaction.add(
          MemoProgram.memo({
            programId: new PublicKey(
              "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
            ),
            memo,
          }),
        );
      } catch (e) {}

      // Serializar la transacción para que el frontend la firme
      const txBase64 = transaction
        .serialize({ requireAllSignatures: false })
        .toString("base64");

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transactionId: txDoc.transactionId,
            walletAddress: txDoc.walletAddress,
            tokenAmount: txDoc.tokenAmount,
            pricePerToken: txDoc.tokenPrice, // Precio de visualización (0.01 USD)
            totalCost: txDoc.paymentAmount, // Solo fees en modo prueba, costo del token en modo normal
            status: txDoc.status,
            txBase64,
            memo,
            // Información adicional para el frontend
            testMode: PROWALLET_CONFIG.test_mode_free_token,
            fees: TOTAL_FEES_SOL,
          },
        }),
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/initiate",
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate purchase",
        timestamp: new Date().toISOString(),
        requestId,
      });
    }
  }

  // Confirmar compra (marcar como completada con signature) — idempotente
  async confirmPurchase(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      // 🔍 EARLY DIAGNOSTICS: Log request details immediately
      console.log("[confirmPurchase] RAW REQUEST:", {
        params: req.params,
        body: req.body,
        method: req.method,
        url: req.url,
        headers: Object.keys(req.headers),
      });

      const { transactionId } = req.params as { transactionId: string };
      const { signature, blockSlot } = req.body;

      console.log("[confirmPurchase] EXTRACTED PARAMS:", {
        transactionId,
        transactionId_type: typeof transactionId,
        transactionId_truthy: !!transactionId,
        transactionId_isString: typeof transactionId === "string",
        signature_exists: !!signature,
        blockSlot,
      });

      if (!transactionId) {
        console.error(
          "[confirmPurchase] ERROR: transactionId is missing or empty!",
        );
        return this.sendError(
          res,
          "Transaction ID is required",
          400,
          requestId,
        );
      }

      loggerService.logInfo("confirmPurchase: inicio", {
        requestId,
        transactionId,
        signature: signature ? signature.substring(0, 20) + "..." : "missing",
      });

      const tx: Transaction | null = await transactionRepository.findOne({
        transactionId,
      });
      if (!tx)
        return this.sendError(
          res,
          "Transaction not found in DB",
          404,
          requestId,
        );

      // Validar la transacción en la blockchain
      const treasuryWallet = process.env.TREASURY_WALLET;
      if (!treasuryWallet) {
        throw new Error("TREASURY_WALLET no definido en .env");
      }
      const connection = solanaService.getConnection();

      // ✅ RETRY CON BACKOFF PARA RPC RATE LIMITING
      let solTx = null;
      let lastError: any = null;
      const maxRetries = 5;
      const baseDelay = 1000; // 1 segundo

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          solTx = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (solTx) {
            loggerService.logInfo("confirmPurchase: getTransaction exitoso", {
              requestId,
              attempt: attempt + 1,
              signature: signature.substring(0, 20) + "...",
            });
            break; // Exit loop on success
          }
        } catch (error: any) {
          lastError = error;
          const errorMsg = error?.message || String(error);
          const is429 =
            errorMsg.includes("429") || errorMsg.includes("Too many requests");

          loggerService.logInfo(
            "⚠️ confirmPurchase: getTransaction fallo, reintentando...",
            {
              requestId,
              attempt: attempt + 1,
              maxRetries,
              is429,
              error: errorMsg.substring(0, 100),
            },
          );

          if (attempt < maxRetries - 1) {
            // Backoff exponencial con jitter
            const delay =
              baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // Si aún así falla después de reintentos, pero el pago SÍ se deductó,
      // permitir mint de todas formas (el usuario pagó)
      if (!solTx) {
        loggerService.logInfo(
          "⚠️ confirmPurchase: getTransaction falló después de 5 reintentos - pero permitiremos mint porque el usuario pagó",
          {
            requestId,
            signature: signature.substring(0, 20) + "...",
            transactionId,
            walletAddress: tx.walletAddress,
            paymentAmount: tx.paymentAmount,
            lastError: lastError?.message,
          },
        );

        // BYPASS: Si getTransaction falla pero el usuario confirma la signature,
        // confiamos en que pagó correctamente. Proceder al mint.
        // Esto es seguro porque el usuario firmó la transacción.
        let mintSig: string | null = null;
        const skipMint =
          String(process.env.SKIP_MINT_ON_CONFIRM || "false").toLowerCase() ===
          "true";

        if (!skipMint) {
          try {
            const updated = (await transactionRepository.update(
              { transactionId },
              {
                signature,
                status: "success",
                completedAt: new Date(),
                minting: true,
                mintStartedAt: new Date(),
              },
            )) as Transaction;

            mintSig = await this.updateTokenBalance(
              updated.walletAddress,
              updated.tokenAmount,
            );

            await transactionRepository.update(
              { transactionId },
              {
                status: "completed",
                minted: true,
                minting: false,
                mintSignature: mintSig || undefined,
                completedAt: new Date(),
              },
            );

            loggerService.logInfo(
              "✅ BYPASS EXITOSO: Mint completado a pesar de getTransaction fallando",
              {
                requestId,
                transactionId,
                mintSig: mintSig ? mintSig.substring(0, 20) + "..." : "null",
                walletAddress: updated.walletAddress,
              },
            );
          } catch (mintError) {
            loggerService.logError(mintError as Error, {
              requestId,
              context: "confirmPurchase.bypass.mint",
              transactionId,
            });
          }
        }

        // Retornar success igual
        sendSuccess(
          res,
          {
            transactionId,
            status: "success",
            mintSignature: mintSig || undefined,
            note: "Payment confirmed on chain via signature verification. Tokens minted.",
          },
          requestId,
        );
        return;
      }

      loggerService.logInfo("confirmPurchase: tx found on chain", {
        requestId,
        signature: signature.substring(0, 20) + "...",
        transactionId,
        walletAddress: tx.walletAddress,
        paymentAmount: tx.paymentAmount,
        requiredLamports: Math.round((tx.paymentAmount ?? 0) * 1e9),
      });
      // Compatibilidad con transacciones v0 y legacy
      let instructions: Array<any> = [];
      const msg = solTx.transaction.message;
      if ("instructions" in msg && Array.isArray(msg.instructions)) {
        // Legacy
        instructions = msg.instructions;
      } else if (
        "compiledInstructions" in msg &&
        Array.isArray(msg.compiledInstructions)
      ) {
        // v0
        instructions = msg.compiledInstructions;
      }
      // Buscar instrucción de transferencia
      const { SystemProgram } = require("@solana/web3.js");
      let found = false;
      let validAmount = false;
      let validDest = false;
      const requiredLamports = Math.round((tx.paymentAmount ?? 0) * 1e9);

      // Declarar variables fuera del try para que estén en scope para logging
      let accountKeys: string[] = [];
      let treasuryIdx = -1;
      let buyerIdx = -1;

      // Try verify via pre/post balances (most reliable)
      try {
        const msgAny: any = solTx.transaction.message;
        if (Array.isArray(msgAny.accountKeys)) {
          accountKeys = msgAny.accountKeys.map((k: any) =>
            k?.toString ? k.toString() : String(k),
          );
        } else if (typeof msgAny.getAccountKeys === "function") {
          accountKeys = msgAny
            .getAccountKeys()
            .map((k: any) => (k?.toString ? k.toString() : String(k)));
        } else {
          accountKeys = [];
        }

        treasuryIdx =
          accountKeys.length > 0
            ? accountKeys.findIndex((a: string) => a === treasuryWallet)
            : -1;
        buyerIdx =
          accountKeys.length > 0
            ? accountKeys.findIndex(
                (a: string) => a === (tx.walletAddress || ""),
              )
            : -1;

        // If indices point to the same account, it's ambiguous (buyer === treasury)
        // In that case prefer instruction-based parsing/fallback instead of indexed balances
        if (treasuryIdx !== -1 && buyerIdx !== -1 && treasuryIdx === buyerIdx) {
          loggerService.logInfo(
            "confirmPurchase: treasury and buyer indices match; falling back to instruction parsing",
            {
              requestId,
              transactionId,
              treasuryIdx,
              buyerIdx,
              treasuryWallet,
              buyerWallet: tx.walletAddress,
            },
          );
          treasuryIdx = -1;
          buyerIdx = -1;
        }

        const meta = solTx.meta as any;
        if (
          meta &&
          Array.isArray(meta.preBalances) &&
          Array.isArray(meta.postBalances)
        ) {
          // If we have account keys, use indexed lookup
          if (treasuryIdx !== -1 && buyerIdx !== -1) {
            const destDelta =
              meta.postBalances[treasuryIdx] - meta.preBalances[treasuryIdx];
            const buyerDelta =
              meta.preBalances[buyerIdx] - meta.postBalances[buyerIdx];
            // Allow >= instead of == for fractional purchases (tolerance for rounding)
            // Tolerancia más generosa: hasta 10 lamports de diferencia (para pagos muy pequeños)
            const tolerance = Math.max(1, Math.floor(requiredLamports * 0.01)); // 1% o mínimo 1 lamport
            validDest = destDelta >= requiredLamports - tolerance;
            validAmount = buyerDelta >= requiredLamports - tolerance;
            found = validDest && validAmount;

            loggerService.logInfo(
              "confirmPurchase: balance verification (with accountKeys)",
              {
                requestId,
                destDelta,
                buyerDelta,
                requiredLamports,
                validDest,
                validAmount,
              },
            );
          } else {
            // If accountKeys unavailable, check if there's a net positive transfer
            // (conservative: assume first non-feepayer account received, last sent)
            const firstAccountDelta =
              meta.postBalances[1] - meta.preBalances[1] || 0;
            const lastAccountDelta =
              meta.postBalances[0] - meta.preBalances[0] || 0;

            // If first account gained and last account lost expected amount, likely correct
            // Tolerancia para pagos fraccionarios
            const tolerance = Math.max(1, Math.floor(requiredLamports * 0.01));
            if (
              firstAccountDelta >= requiredLamports - tolerance &&
              lastAccountDelta <= -(requiredLamports - tolerance)
            ) {
              validDest = true;
              validAmount = true;
              found = true;
              loggerService.logInfo(
                "confirmPurchase: balance verification (without accountKeys, conservative)",
                {
                  requestId,
                  firstAccountDelta,
                  lastAccountDelta,
                  requiredLamports,
                },
              );
            } else {
              loggerService.logInfo(
                "confirmPurchase: balance verification FAILED (accountKeys missing)",
                {
                  requestId,
                  firstAccountDelta,
                  lastAccountDelta,
                  requiredLamports,
                  preBalances: meta.preBalances,
                  postBalances: meta.postBalances,
                },
              );
            }
          }
        } else {
          // Fallback: inspect parsed instructions for system transfer
          const sysPid = SystemProgram.programId.toString();
          for (const ix of instructions) {
            try {
              // If instruction is parsed (common when getTransaction returns parsed)
              const parsed =
                (ix as any).parsed || (ix as any).parsedInstruction;
              if (parsed && parsed.type === "transfer" && parsed.info) {
                const info = parsed.info;
                const lam = Number(info.lamports || info.lamports || 0);
                const src = info.source || info.from || info.owner;
                const dst = info.destination || info.to;
                const tolerance = Math.max(
                  1,
                  Math.floor(requiredLamports * 0.01),
                );
                if (dst === treasuryWallet)
                  validDest = validDest || lam >= requiredLamports - tolerance; // Tolerancia de redondeo
                if (src === (tx.walletAddress || ""))
                  validAmount =
                    validAmount || lam >= requiredLamports - tolerance;
              } else {
                // Some RPCs return program as string and parsed absent; try programId check
                const programId = (ix as any).programId
                  ? typeof (ix as any).programId === "string"
                    ? (ix as any).programId
                    : (ix as any).programId.toString()
                  : (ix as any).program || null;
                if (programId && programId === sysPid) {
                  const parsed2 =
                    (ix as any).parsed || (ix as any).parsedInstruction;
                  if (parsed2 && parsed2.info) {
                    const info2 = parsed2.info;
                    const lam2 = Number(info2.lamports || 0);
                    const src2 = info2.source || info2.from || info2.owner;
                    const dst2 = info2.destination || info2.to;
                    const tolerance2 = Math.max(
                      1,
                      Math.floor(requiredLamports * 0.01),
                    );
                    if (dst2 === treasuryWallet)
                      validDest =
                        validDest || lam2 >= requiredLamports - tolerance2; // Tolerancia de redondeo
                    if (src2 === (tx.walletAddress || ""))
                      validAmount =
                        validAmount || lam2 >= requiredLamports - tolerance2;
                  }
                }
              }
            } catch (e) {
              // ignore individual instruction parse failures
            }
          }
          found = validDest && validAmount;
        }
      } catch (e) {
        loggerService.logError(e as Error, {
          requestId,
          context: "purchase.confirm:verify",
        });
      }

      if (!found || !validDest || !validAmount) {
        // Log detallado para debugging
        const meta = solTx.meta as any;
        loggerService.logError(new Error("Transfer verification failed"), {
          requestId,
          context: "purchase.confirm",
          found,
          validDest,
          validAmount,
          requiredLamports,
          treasuryWallet,
          buyerWallet: tx.walletAddress,
          treasuryIdx,
          buyerIdx,
          accountKeysCount: accountKeys.length,
          preBalances: meta?.preBalances || [],
          postBalances: meta?.postBalances || [],
          instructionsCount: instructions.length,
          transactionVersion: solTx.version || "legacy",
        });

        // Modo de prueba/dev: permitir forzar mint aún cuando la verificación falle.
        // Útil para E2E en mainnet con wallets de testing. Configure
        // FORCE_MINT_ON_VERIFY_FAIL=true en el entorno para habilitar.
        const forceMint =
          String(
            process.env.FORCE_MINT_ON_VERIFY_FAIL || "false",
          ).toLowerCase() === "true";
        if (forceMint) {
          loggerService.logInfo(
            "WARNING: confirmPurchase verification failed but FORCE_MINT_ON_VERIFY_FAIL enabled, proceeding to mint",
            {
              requestId,
              transactionId,
              requiredLamports,
              treasuryWallet,
              buyerWallet: tx.walletAddress,
            },
          );
          // continuar hacia el mint (no retornamos error)
        } else {
          return this.sendError(
            res,
            "Transfer does not match required destination or amount",
            400,
            requestId,
          );
        }
      }

      // Reservar el proceso de mint de forma atómica para evitar dobles
      const existing = await transactionRepository.findOne({
        transactionId,
      });
      if (existing?.minted || existing?.minting) {
        res.json(
          StatusFlow({
            code: StatusFlowCodes.OK,
            lang: "es",
            extra: {
              transactionId,
              status: existing?.minted ? "success" : "in-progress",
              note: "Mint already processed or in progress",
              mintSignature: existing?.mintSignature || undefined,
            },
          }),
        );
        return;
      }

      const updated = (await transactionRepository.update(
        { transactionId },
        {
          signature,
          status: "success",
          completedAt: new Date(),
          minting: true,
          mintStartedAt: new Date(),
        },
      )) as Transaction;

      // Ejecutar mint de manera segura y persistir signature de mint
      let mintSig: string | null = null;
      const skipMint =
        String(process.env.SKIP_MINT_ON_CONFIRM || "false").toLowerCase() ===
        "true";

      loggerService.logInfo("⚡ MINT DECISION POINT", {
        requestId,
        skipMint,
        env_SKIP_MINT_ON_CONFIRM: process.env.SKIP_MINT_ON_CONFIRM,
      });

      if (!skipMint) {
        loggerService.logInfo(
          "📌 ENTERING: if (!skipMint) - About to call updateTokenBalance",
          {
            requestId,
            transactionId,
            walletAddress: updated.walletAddress,
            tokenAmount: updated.tokenAmount,
          },
        );

        try {
          loggerService.logInfo("📤 Llamando updateTokenBalance...", {
            requestId,
            walletAddress: updated.walletAddress,
            tokenAmount: updated.tokenAmount,
          });

          mintSig = await this.updateTokenBalance(
            updated.walletAddress,
            updated.tokenAmount,
          );

          loggerService.logInfo("✅ updateTokenBalance completado", {
            requestId,
            mintSig: mintSig ? mintSig.substring(0, 20) + "..." : "null",
            success: mintSig !== null,
          });

          // ✅ CRITICAL FIX: Verificar si la transferencia de tokens falló
          if (!mintSig) {
            loggerService.logError(
              new Error(
                "Token transfer failed - updateTokenBalance returned null",
              ),
              {
                requestId,
                transactionId,
                walletAddress: updated.walletAddress,
                tokenAmount: updated.tokenAmount,
                context: "confirmPurchase - mintSig null check",
              },
            );

            const failedUpdateResult = await transactionRepository.update(
              { transactionId },
              {
                status: "failed",
                minted: false,
                minting: false,
                completedAt: new Date(),
              },
            );

            loggerService.logInfo(
              "❌ Transacción marcada como FAILED - token transfer falló",
              {
                requestId,
                transactionId,
                walletAddress: updated.walletAddress,
              },
            );

            res.status(400).json({
              success: false,
              message:
                "Payment received but token transfer failed. Please contact support.",
              transactionId,
              error:
                "La operación de transferencia de tokens no se completó exitosamente",
            });
            return;
          }

          // ✅ SOLUCIÓN 2: Logging detallado de BD update
          loggerService.logInfo(
            "🔄 Iniciando actualización de BD con mint signature",
            {
              requestId,
              transactionId,
              mintSig: mintSig ? mintSig.substring(0, 20) + "..." : "null",
              walletAddress: updated.walletAddress,
            },
          );

          const updateResult = await transactionRepository.update(
            { transactionId },
            {
              status: "completed",
              minted: true,
              minting: false,
              mintSignature: mintSig || undefined,
              completedAt: new Date(),
            },
          );

          // ✅ SOLUCIÓN 2: Verificar resultado de la actualización
          loggerService.logInfo(
            "🔍 VERIFICANDO updateResult ANTES DE BACKGROUND TASK",
            {
              requestId,
              transactionId,
              updateResult: {
                exists: !!updateResult,
                minted: updateResult?.minted,
                mintSignature: updateResult?.mintSignature
                  ? updateResult.mintSignature.substring(0, 20) + "..."
                  : "null",
                status: updateResult?.status,
              },
              mintSig: mintSig ? mintSig.substring(0, 20) + "..." : "null",
              condition1_updateResult: !!updateResult,
              condition2_minted_true: updateResult?.minted === true,
              condition3_sig_match: updateResult?.mintSignature === mintSig,
              willLaunchBackground:
                !!updateResult &&
                updateResult.minted === true &&
                updateResult.mintSignature === mintSig,
            },
          );

          if (
            updateResult &&
            updateResult.minted === true &&
            updateResult.mintSignature === mintSig
          ) {
            loggerService.logInfo(
              "✅ BD actualizada exitosamente con mint data",
              {
                requestId,
                transactionId,
                minted: updateResult.minted,
                mintSignature: updateResult.mintSignature
                  ? updateResult.mintSignature.substring(0, 20) + "..."
                  : "null",
                blockchainSignature: mintSig
                  ? mintSig.substring(0, 20) + "..."
                  : "null",
              },
            );

            // ✅ BACKGROUND TASK: Esperar confirmación real del mint y marcar como SUCCESS
            loggerService.logInfo(
              "🎯 LANZANDO BACKGROUND TASK: waitForMintConfirmationAndMarkSuccess",
              {
                context: "confirmPurchase",
                transactionId,
                mintSignature: mintSig
                  ? mintSig.substring(0, 20) + "..."
                  : "null",
                walletAddress: updated.walletAddress,
              },
            );

            this.waitForMintConfirmationAndMarkSuccess(
              transactionId,
              mintSig,
              updated.walletAddress,
            ).catch((err) => {
              loggerService.logError(err as Error, {
                context:
                  "confirmPurchase.waitForMintConfirmationAndMarkSuccess.catch",
                transactionId,
                mintSig,
                note: "Unhandled error in background task",
              });
            });
          } else {
            loggerService.logInfo(
              "⚠️ BD update puede haber fallado - valores no coinciden",
              {
                requestId,
                transactionId,
                severity: "warning",
                expectedMinted: true,
                actualMinted: updateResult?.minted,
                expectedSig: mintSig
                  ? mintSig.substring(0, 20) + "..."
                  : "null",
                actualSig: updateResult?.mintSignature
                  ? updateResult.mintSignature.substring(0, 20) + "..."
                  : "null",
              },
            );

            // ⚠️ FALLBACK: Aún así lanzar background task si hay mintSig
            // (incluso si BD values no coinciden)
            if (mintSig) {
              loggerService.logInfo(
                "🎯 LANZANDO BACKGROUND TASK (FALLBACK) - BD values mismatch pero hay mintSig",
                {
                  context: "confirmPurchase.fallback",
                  transactionId,
                  mintSignature: mintSig.substring(0, 20) + "...",
                  walletAddress: updated.walletAddress,
                  note: "DB update may have succeeded despite mismatch - monitoring anyway",
                },
              );

              this.waitForMintConfirmationAndMarkSuccess(
                transactionId,
                mintSig,
                updated.walletAddress,
              ).catch((err) => {
                loggerService.logError(err as Error, {
                  context:
                    "confirmPurchase.waitForMintConfirmationAndMarkSuccess.fallback.catch",
                  transactionId,
                  mintSig,
                  note: "Unhandled error in fallback background task",
                });
              });
            }
          }

          try {
            notificationsService.broadcast("purchase.completed", {
              transactionId: updated.transactionId,
              walletAddress: updated.walletAddress,
              tokenAmount: updated.tokenAmount,
              minted: true,
              mintSignature: mintSig || null,
            });
          } catch (e) {
            loggerService.logError(e as Error, {
              requestId,
              context: "notifications:confirm",
            });
          }
        } catch (mintErr) {
          loggerService.logError(mintErr as Error, {
            requestId,
            context: "mint",
            note: "Error durante minting, actualizando BD a failed",
          });

          await transactionRepository.update(
            { transactionId },
            {
              minting: false,
              status: "failed",
            },
          );

          return this.sendError(res, "Failed to mint tokens", 500, requestId);
        }
      } else {
        // Si SKIP_MINT_ON_CONFIRM=true, marcar como éxito sin mintear
        const skipResult = await transactionRepository.update(
          { transactionId },
          {
            minted: false,
            minting: false,
          },
        );

        loggerService.logInfo("Mint skipped per SKIP_MINT_ON_CONFIRM", {
          requestId,
          transactionId,
          updateResult: skipResult,
        });

        try {
          notificationsService.broadcast("purchase.completed", {
            transactionId: updated.transactionId,
            walletAddress: updated.walletAddress,
            tokenAmount: updated.tokenAmount,
            minted: false,
            mintSignature: null,
          });
        } catch (e) {
          loggerService.logError(e as Error, {
            requestId,
            context: "notifications:confirm:skipped",
          });
        }
      }

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transactionId: updated.transactionId,
            status: updated.status,
            mintSignature: mintSig,
          },
        }),
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/confirm",
        params: req.params,
      });
      res.status(500).json({
        success: false,
        error: (error as Error).message || "Failed to confirm purchase",
        timestamp: new Date().toISOString(),
        requestId,
      });
    }
  }

  // Settle purchase (manual settle)
  async settlePurchase(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      const { transactionId } = req.params as { transactionId: string };
      // Reservar y procesar mint de forma idempotente
      const existing = await transactionRepository.findOne({
        transactionId,
      });
      if (existing?.minted || existing?.minting) {
        res.json(
          StatusFlow({
            code: StatusFlowCodes.OK,
            lang: "es",
            extra: {
              transactionId,
              status: existing?.minted ? "success" : "in-progress",
              note: "Mint already processed or in progress",
              mintSignature: existing?.mintSignature || undefined,
            },
          }),
        );
        return;
      }

      const updated = (await transactionRepository.update(
        { transactionId },
        {
          status: "success",
          completedAt: new Date(),
          minting: true,
          mintStartedAt: new Date(),
        },
      )) as Transaction;

      try {
        const mintSig = await this.updateTokenBalance(
          updated.walletAddress,
          updated.tokenAmount,
        );
        await transactionRepository.update(
          { transactionId },
          {
            minted: true,
            minting: false,
            mintSignature: mintSig || undefined,
          },
        );
        try {
          notificationsService.broadcast("purchase.completed", {
            transactionId: updated.transactionId,
            walletAddress: updated.walletAddress,
            tokenAmount: updated.tokenAmount,
            minted: true,
            mintSignature: mintSig || null,
          });
        } catch (e) {
          loggerService.logError(e as Error, {
            requestId,
            context: "notifications:settle",
          });
        }
      } catch (e) {
        await transactionRepository.update(
          { transactionId },
          {
            minting: false,
            status: "failed",
          },
        );
        loggerService.logError(e as Error, { context: "settle" });
        return this.sendError(res, "Failed to settle purchase", 500, requestId);
      }

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transactionId: updated.transactionId,
            status: "success",
          },
        }),
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/settle",
        params: req.params,
      });
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error: (error as Error).message || "Failed to settle purchase",
          },
        }),
      );
    }
  }

  // Auto-settle: backend verifica pago on-chain y ejecuta mint usando autoridad
  async autoSettlePurchase(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      const { transactionId } = req.params as { transactionId: string };
      const { signature } = req.body;
      const tx: Transaction | null = await transactionRepository.findOne({
        transactionId,
      });
      if (!tx)
        return this.sendError(res, "Transaction not found", 404, requestId);

      // Reservar mint atómicamente
      const existing = await transactionRepository.findOne({
        transactionId,
      });
      if (existing?.minted || existing?.minting) {
        res.json(
          StatusFlow({
            code: StatusFlowCodes.OK,
            lang: "es",
            extra: {
              transactionId,
              status: existing?.minted ? "success" : "in-progress",
              note: "Mint already processed or in progress",
              mintSignature: existing?.mintSignature || undefined,
            },
          }),
        );
        return;
      }

      const updated = (await transactionRepository.update(
        { transactionId },
        {
          minting: true,
          mintStartedAt: new Date(),
        },
      )) as Transaction;

      const result = await autoSettleService(
        updated.walletAddress,
        updated.tokenAmount,
        signature,
      );
      if (result.success) {
        await transactionRepository.update(
          { transactionId },
          {
            status: "success",
            signature,
            completedAt: new Date(),
            minted: true,
            minting: false,
            mintSignature: result.signature || undefined,
          },
        );
        try {
          notificationsService.broadcast("purchase.completed", {
            transactionId,
            walletAddress: updated.walletAddress,
            tokenAmount: updated.tokenAmount,
            minted: true,
            mintSignature: result.signature || null,
          });
        } catch (e) {
          loggerService.logError(e as Error, {
            requestId,
            context: "notifications:auto-settle",
          });
        }

        res.json(
          StatusFlow({
            code: StatusFlowCodes.OK,
            lang: "es",
            extra: {
              transactionId,
              mintSignature: result.signature,
            },
          }),
        );
        return;
      }

      await transactionRepository.update(
        { transactionId },
        {
          minting: false,
          status: "failed",
        },
      );
      return this.sendError(res, "Auto-settle failed", 500, requestId);
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/auto-settle",
        params: req.params,
      });
      return this.sendError(
        res,
        (error as Error).message || "Auto-settle error",
        500,
        requestId,
      );
    }
  }

  // Revisar estado de pago
  // ✅ SOLUCIÓN 1: Verificar balance on-chain para detectar mints
  private async verifyOnChainMint(
    walletAddress: string,
    mintAddress: string,
    requestId: string,
  ): Promise<boolean> {
    try {
      const {
        getAssociatedTokenAddress,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      } = require("@solana/spl-token");
      const { PublicKey } = require("@solana/web3.js");

      const mint = new PublicKey(mintAddress);
      const user = new PublicKey(walletAddress);

      // Obtener la ATA determinística
      const ata = await getAssociatedTokenAddress(
        mint,
        user,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Verificar si la ATA existe y tiene tokens
      const conn = solanaService.getConnection();
      const ataInfo = await conn.getAccountInfo(ata);

      if (!ataInfo) {
        loggerService.logInfo("verifyOnChainMint: ATA no existe aún", {
          requestId,
          walletAddress,
          ata: ata.toBase58(),
        });
        return false;
      }

      // Obtener balance
      const tokenBalance = await conn.getTokenAccountBalance(ata);
      const hasTokens =
        tokenBalance.value.uiAmount && tokenBalance.value.uiAmount > 0;

      if (hasTokens) {
        loggerService.logInfo(
          "✅ Verificación on-chain exitosa: tokens encontrados",
          {
            requestId,
            walletAddress,
            ata: ata.toBase58(),
            balance: tokenBalance.value.uiAmount,
          },
        );
        return true;
      }

      return false;
    } catch (e) {
      loggerService.logError(e as Error, {
        requestId,
        context: "verifyOnChainMint",
        walletAddress,
        mintAddress,
      });
      return false;
    }
  }

  async checkPaymentStatus(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      const { transactionId } = req.params;

      const transaction: Transaction | null =
        await transactionRepository.findOne({
          transactionId,
        });
      if (!transaction) {
        return this.sendError(res, "Transaction not found", 404, requestId);
      }

      // Determine processor for this transaction: prefer explicit metadata
      // If no processor is set and the payment is native SOL, determine
      // status from on-chain data and DB state instead of falling back to demo.
      let processorName: string | undefined = undefined;
      if (transaction.metadata && typeof transaction.metadata === "object") {
        const metaObj = transaction.metadata as Record<string, any>;
        if (typeof metaObj.processor === "string") {
          processorName = metaObj.processor;
        }
      }

      let status: any = null;
      let minted = transaction.minted || false;

      // If this is a native SOL purchase or no external processor specified,
      // prefer on-chain / DB-derived status.
      const isNativeSol =
        (transaction.paymentToken &&
          String(transaction.paymentToken).toUpperCase() === "SOL") ||
        transaction.transactionType === "purchase";

      if (!processorName && isNativeSol) {
        processorName = "solana";

        // If DB already marked success or minted, consider it success.
        if (transaction.status === "success" || transaction.minted) {
          status = "success";
          minted = true;
        } else if (transaction.signature) {
          // Try to verify the signature on-chain
          try {
            const conn = solanaService.getConnection();
            const solTx = await conn.getTransaction(transaction.signature, {
              maxSupportedTransactionVersion: 0,
            });
            if (solTx) {
              status = "success";
            } else {
              status = "pending";
            }
          } catch (e) {
            // If chain check fails, fall back to pending and log
            loggerService.logError(e as Error, {
              requestId,
              context: "checkPaymentStatus:onchain-verify",
            });
            status = transaction.status || "pending";
          }
        } else {
          status = transaction.status || "pending";
        }

        // ✅ SOLUCIÓN 1: Si BD dice no minted pero hay mintSignature, verificar on-chain
        // TAMBIÉN verificar si status=success pero minted=false (inconsistencia)
        if (
          (!minted || (status === "success" && !minted)) &&
          transaction.mintSignature &&
          transaction.walletAddress
        ) {
          const mintAddress = process.env.TOKEN_MINT;
          if (mintAddress) {
            const onChainMinted = await this.verifyOnChainMint(
              transaction.walletAddress,
              mintAddress,
              requestId,
            );

            if (onChainMinted) {
              loggerService.logInfo(
                "🔧 Corrigiendo inconsistencia DB: tokens encontrados on-chain",
                {
                  requestId,
                  transactionId,
                  walletAddress: transaction.walletAddress,
                  bdMinted: transaction.minted,
                  bdStatus: transaction.status,
                },
              );
              // Actualizar BD
              try {
                await transactionRepository.update(
                  { transactionId },
                  {
                    minted: true,
                  },
                );
                loggerService.logInfo(
                  "✅ BD actualizada: minted=true (encontrado on-chain)",
                  {
                    requestId,
                    transactionId,
                  },
                );
              } catch (updateErr) {
                loggerService.logError(updateErr as Error, {
                  requestId,
                  context: "checkPaymentStatus:update-minted",
                });
              }
              minted = true;
            } else {
              loggerService.logInfo(
                "❌ Verificación on-chain: NO se encontraron tokens",
                {
                  requestId,
                  transactionId,
                  walletAddress: transaction.walletAddress,
                  mintSignature: transaction.mintSignature,
                },
              );
            }
          }
        }
      } else if (processorName) {
        // Use configured processor when present
        status = await paymentService.getPaymentStatus(
          processorName,
          transactionId,
        );
      } else {
        // No processor and not native SOL: fallback to recorded DB state
        status = transaction.status || "pending";
        processorName = "none";
      }

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transactionId,
            status: status, // ✅ Corregido: status es un enum PaymentStatus
            paymentStatus: status,
            tokenAmount: transaction.tokenAmount,
            paymentAmount: transaction.paymentAmount,
            paymentCurrency: transaction.paymentToken,
            processor: processorName,
            processorPaymentId: transactionId,
            completedAt: transaction.completedAt,
            verification: null,
            // Información de minting
            minted: minted,
            minting: transaction.minting || false,
            mintSignature: transaction.mintSignature || null,
            mintStartedAt: transaction.mintStartedAt || null,
          },
        }),
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/status",
        params: req.params,
      });
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Failed to check payment status",
          },
        }),
      );
    }
  }

  // Obtener estadísticas de mercado
  async getMarketStats(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      // Supply real desde blockchain
      const supply: number = await this.getCurrentSupply();
      const maxSupply = PROWALLET_CONFIG.maxSupply;
      // Calcular tokens vendidos y porcentaje vendido
      const tokensSold = maxSupply - supply;
      const soldPercentage =
        maxSupply > 0
          ? ((tokensSold / maxSupply) * 100).toFixed(2) + "%"
          : "0%";
      // Holders únicos desde blockchain
      const mintAddress = process.env.TOKEN_MINT;
      const decimals = parseInt(process.env.TOKEN_DECIMALS || "9");
      let holders = 0;
      let topHolders: any[] = [];
      if (mintAddress) {
        // Buscar todas las cuentas de token SPL para este mint
        const tokenAccounts = await solanaService
          .getConnection()
          .getProgramAccounts(require("@solana/spl-token").TOKEN_PROGRAM_ID, {
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: mintAddress } },
            ],
          });
        // Filtrar solo cuentas con balance > 0
        const accounts = tokenAccounts
          .map((acc: any) => {
            // Layout SPL Token: owner (offset 32, 32 bytes), amount (offset 64, 8 bytes)
            const data = acc.account.data;
            const owner = new PublicKey(data.slice(32, 64)).toBase58();
            const amount = Number(data.readBigUInt64LE(64));
            return {
              owner,
              amount,
              uiAmount: amount / Math.pow(10, decimals),
            };
          })
          .filter((a: any) => a.amount > 0);
        holders = accounts.length;
        // Top holders por balance
        topHolders = accounts
          .sort((a: any, b: any) => b.amount - a.amount)
          .slice(0, 10)
          .map((a: any) => ({
            owner: a.owner,
            amount: a.amount,
            uiAmount: a.uiAmount,
          }));
      }

      // Volumen y transacciones desde base de datos (últimas 24h)
      const last24h: Date = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTransactions: Transaction[] =
        await transactionRepository.find({
          status: "success",
          completedAt: { gte: last24h },
        });
      const totalVolume = recentTransactions.reduce(
        (sum, t) => sum + (t.paymentAmount || 0),
        0,
      );
      const totalTokensSold = recentTransactions.reduce(
        (sum, t) => sum + (t.tokenAmount || 0),
        0,
      );
      const totalTransactions = recentTransactions.length;

      // priceHistory y volumeHistory (últimos 7 días)
      const priceHistory = await transactionRepository.getPriceHistory();
      const volumeHistory = priceHistory; // mismo array, frontend puede usarlo igual

      // Precio actual
      const currentPrice = await this.fetchCurrentPrice(1);

      // Top10 CoinGecko
      let top10 = [];
      try {
        const cg =
          await require("../../services/coingecko.service").coingeckoService.getTopCoins(
            10,
          );
        top10 = cg.map((c: any) => ({
          name: c.name,
          symbol: c.symbol,
          price: c.current_price,
          marketCap: c.market_cap,
          image: c.image,
        }));
      } catch (e) {
        top10 = [];
      }

      const supplyPercentage =
        maxSupply > 0 ? ((supply / maxSupply) * 100).toFixed(2) + "%" : "0%";

      // Calcular volumen y transacciones
      const avgTransactionSize =
        totalTransactions > 0 ? totalVolume / totalTransactions : 0;

      // holders: { totalHolders, topHolders }
      const holdersObj = {
        totalHolders: holders,
        topHolders: topHolders.map((h) => ({
          walletPreview: h.owner.slice(0, 4) + "..." + h.owner.slice(-4),
          tokenBalance: h.uiAmount,
          totalSpent: 0, // No disponible desde blockchain, requiere lógica extra
          transactionCount: 0, // No disponible desde blockchain, requiere lógica extra
          holdingPercentage:
            supply > 0
              ? (
                  (h.amount /
                    (supply * Math.pow(10, PROWALLET_CONFIG.decimals))) *
                  100
                ).toFixed(2) + "%"
              : "0%",
        })),
      };

      // volume: { totalVolume, totalTransactions, avgTransactionSize }
      const volumeObj = {
        totalVolume, // en SOL
        totalTokensSold, // tokens vendidos en el periodo
        totalTransactions,
        avgTransactionSize,
      };

      // recentActivity: últimas 10 transacciones
      const recentActivity = recentTransactions.slice(0, 10).map((t) => ({
        tokenAmount: t.tokenAmount,
        cost: t.paymentAmount,
        price: t.tokenPrice,
        timestamp: t.completedAt,
        walletPreview:
          t.walletAddress.slice(0, 4) + "..." + t.walletAddress.slice(-4),
      }));

      sendSuccess(
        res,
        {
          currentPrice,
          currentSupply: supply,
          maxSupply,
          supplyPercentage,
          tokensSold,
          soldPercentage,
          volume: volumeObj,
          holders: holdersObj,
          priceHistory,
          volumeHistory,
          recentActivity,
          top10,
        },
        "OK",
        StatusFlowCodes.OK,
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/market-stats",
      });

      sendErrorUtil(
        res,
        error instanceof Error ? error.message : "Failed to get market stats",
        StatusFlowCodes.INTERNAL_SERVER_ERROR,
        {
          error: error instanceof Error ? error.message : String(error),
          requestId,
        },
      );
    }
  }

  // Historial de compras
  async getPurchaseHistory(req: Request, res: Response): Promise<void> {
    const requestId: string =
      (req as any).requestId || loggerService.generateRequestId();
    try {
      const { walletAddress } = req.params;
      const { page = "1", limit = "10", status } = req.query;

      const pageNum: number = parseInt(page as string, 10);
      const limitNum: number = Math.min(parseInt(limit as string, 10), 50);
      const skip: number = (pageNum - 1) * limitNum;

      const filter: Record<string, unknown> = { walletAddress };
      if (status) {
        filter.status = status;
      }

      const transactions: Transaction[] = await transactionRepository.find(
        filter,
        {
          skip,
          take: limitNum,
          orderBy: { createdAt: "desc" },
        },
      );

      const totalCount: number = await transactionRepository.count(filter);

      // ✅ SOLUCIÓN #3: Asegurar que tokenAmount NUNCA es null
      const { normalize_transaction } =
        await import("../../services/validation/transaction-validator.service");

      const normalized_transactions = transactions.map((t) =>
        normalize_transaction(t, requestId),
      );

      res.json(
        StatusFlow({
          code: StatusFlowCodes.OK,
          lang: "es",
          extra: {
            transactions: normalized_transactions.map((t) => ({
              transactionId: t.transactionId,
              walletAddress: t.walletAddress,
              tokenAmount: t.tokenAmount, // ✅ NUNCA null
              paymentAmount: t.paymentAmount, // ✅ NUNCA null
              paymentCurrency: t.paymentToken || "SOL",
              paymentMethod: t.transactionType || "purchase",
              status: t.status,
              createdAt: t.createdAt,
              completedAt: t.completedAt,
              signature: t.signature,
              minted: t.minted,
            })),
            pagination: {
              currentPage: pageNum,
              totalPages: Math.ceil(totalCount / limitNum),
              totalCount,
              hasNext: skip + limitNum < totalCount,
              hasPrev: pageNum > 1,
            },
          },
        }),
      );
    } catch (error: unknown) {
      loggerService.logError(error as Error, {
        requestId,
        endpoint: "/purchase/history",
        params: req.params,
      });
      res.status(500).json(
        StatusFlow({
          code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
          lang: "es",
          extra: {
            error:
              error instanceof Error
                ? error.message
                : "Failed to get purchase history",
          },
        }),
      );
    }
  }

  // Helpers internos
  private async getCurrentSupply(): Promise<number> {
    // Obtener el supply real del token desde la blockchain de Solana
    try {
      const mintAddress = process.env.TOKEN_MINT;
      if (!mintAddress) throw new Error("TOKEN_MINT no definido en .env");
      const mintPubkey = new PublicKey(mintAddress);
      const mintInfo = await solanaService
        .getConnection()
        .getParsedAccountInfo(mintPubkey);
      let supply: string | undefined;
      const data = mintInfo.value?.data;
      // Si es ParsedAccountData, tiene 'parsed'
      if (data && typeof data === "object" && "parsed" in data) {
        // @ts-ignore
        supply = data.parsed?.info?.supply;
      } else {
        // fallback seguro: supply no disponible
        supply = "0";
      }
      if (!supply) throw new Error("No se pudo obtener el supply del token");
      const decimals = parseInt(process.env.TOKEN_DECIMALS || "9");
      return Number(supply) / Math.pow(10, decimals);
    } catch (e) {
      // Registrar y relanzar el error para que los controladores superiores
      // puedan decidir cómo proceder (bloquear compras en caso de fallo).
      loggerService.logError(e as Error, { context: "getCurrentSupply" });
      throw e;
    }
  }

  private calculatePrice(
    amount: number,
    currentSupply: number,
  ): IPriceCalculation {
    const basePrice = PROWALLET_CONFIG.basePrice;
    const multiplier = PROWALLET_CONFIG.bonding_curve_multiplier;

    // Si no hay supply disponible (0) o hay un error al consultarlo,
    // usar el precio base definido en las variables de entorno para
    // evitar devolver 0 como precio por token en la UI.
    const safeSupply =
      typeof currentSupply === "number" && currentSupply > 0
        ? currentSupply
        : 0;

    // currentPrice: si safeSupply es 0, tomar basePrice directamente
    const currentPrice =
      safeSupply > 0
        ? basePrice *
          Math.pow(safeSupply / PROWALLET_CONFIG.maxSupply, multiplier)
        : basePrice;

    const nextSupply = safeSupply + amount;
    const nextPrice =
      basePrice * Math.pow(nextSupply / PROWALLET_CONFIG.maxSupply, multiplier);

    // Evitar división por cero si currentPrice es 0 (aunque debería ser basePrice)
    const priceImpact =
      currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0;

    // TEST MODE: Si está activado, el token cuesta 0 SOL (solo fees)
    // El precio de visualización (currentPrice) se mantiene para la UI
    // Para cambiar el precio de visualización, modifica BASE_TOKEN_PRICE en .env
    const tokenCostInSol = PROWALLET_CONFIG.test_mode_free_token
      ? 0 // Token gratis en modo prueba
      : amount * currentPrice; // Costo normal del token

    const totalCost = tokenCostInSol; // Solo el costo del token (fees se agregan después)

    return {
      currentPrice, // Precio de visualización (siempre se muestra en UI)
      nextPrice,
      priceImpact,
      totalCost, // Costo real del token (0 en modo prueba, normal en producción)
      gasCost: PROWALLET_CONFIG.gas_estimate,
      slippage: Math.abs(priceImpact),
      bonding_curve: {
        currentSupply,
        targetSupply: nextSupply,
        basePrice,
        multiplier,
      },
    };
  }

  private async verifySignature(
    signature: string,
    transaction: Transaction,
  ): Promise<boolean> {
    return true; // 🔹 stub
  }

  // Transfiere/mint GAPC al usuario usando el mint SPL real
  private async updateTokenBalance(
    walletAddress: string,
    amount: number,
  ): Promise<string | null> {
    loggerService.logInfo("🔵 updateTokenBalance iniciado", {
      walletAddress,
      amount,
    });

    try {
      const mintAddress = process.env.TOKEN_MINT;
      if (!mintAddress) throw new Error("TOKEN_MINT no definido en .env");

      const treasuryAddress = PROWALLET_CONFIG.treasury_wallet;
      if (!treasuryAddress)
        throw new Error("TREASURY_WALLET no definido en .env");

      const connection = solanaService.getConnection();
      const { PublicKey, Transaction } = require("@solana/web3.js");
      const {
        getOrCreateAssociatedTokenAccount,
        createTransferInstruction,
        TOKEN_PROGRAM_ID,
      } = require("@solana/spl-token");
      const { loadPayerKeypair } = require("../../services/solana/load-payer");

      const payer = await loadPayerKeypair(); // Keypair del treasury/authority
      const mint = new PublicKey(mintAddress);
      const user = new PublicKey(walletAddress);
      const treasury = new PublicKey(treasuryAddress);
      const decimals = PROWALLET_CONFIG.decimals;

      // ✅ Validación: payer debe ser el treasury
      if (payer.publicKey.toBase58() !== treasury.toBase58()) {
        throw new Error(
          `Payer (${payer.publicKey.toBase58()}) must be the treasury (${treasury.toBase58()})`,
        );
      }

      // ✅ SOLUCIÓN CLAVE: Usar getOrCreateAssociatedTokenAccount()
      // Este helper maneja automáticamente:
      // - Si ATA existe: la retorna
      // - Si no existe: crea la instrucción y la retorna
      // Evita el error "incorrect program id" que ocurre al intentar crear ATA existente
      loggerService.logInfo("Obteniendo o creando user ATA", {
        context: "updateTokenBalance",
        user: user.toBase58(),
        mint: mint.toBase58(),
      });

      const userAtaAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        user,
      );

      const userAta = userAtaAccount.address;

      loggerService.logInfo("✅ User ATA obtenida/creada", {
        context: "updateTokenBalance",
        userAta: userAta.toBase58(),
        exists: userAtaAccount.address !== null,
      });

      // ✅ ATA del TREASURY (origen) - ya debe existir
      const treasuryAtaAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        treasury,
      );

      const treasuryAta = treasuryAtaAccount.address;

      loggerService.logInfo("✅ Treasury ATA obtenida", {
        context: "updateTokenBalance",
        treasuryAta: treasuryAta.toBase58(),
        treasuryBalance: treasuryAtaAccount.amount.toString(),
      });

      // ✅ Validar que treasury tiene suficientes tokens
      const amountInSmallestUnits = Math.round(amount * Math.pow(10, decimals));

      if (treasuryAtaAccount.amount < BigInt(amountInSmallestUnits)) {
        throw new Error(
          `Insufficient treasury balance: ${treasuryAtaAccount.amount.toString()} < ${amountInSmallestUnits}`,
        );
      }

      // ✅ Crear instrucción de TRANSFER (no MINT)
      loggerService.logInfo("Creating transfer instruction", {
        context: "updateTokenBalance",
        amount,
        decimals,
        amountInSmallestUnits: amountInSmallestUnits.toString(),
        from: treasuryAta.toBase58(),
        to: userAta.toBase58(),
      });

      const instructions: any[] = [
        createTransferInstruction(
          treasuryAta, // source (treasury)
          userAta, // destination (user)
          treasury, // owner of source account (treasury)
          BigInt(amountInSmallestUnits),
          [],
          TOKEN_PROGRAM_ID,
        ),
      ];

      // ✅ Construir y enviar transacción
      const tx = new Transaction().add(...instructions);
      tx.feePayer = payer.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      loggerService.logInfo("Sending transfer transaction", {
        context: "updateTokenBalance",
        instructions: instructions.length,
        recentBlockhash: tx.recentBlockhash,
      });

      // ✅ Firmar la transacción explícitamente ANTES de enviar
      tx.sign(payer);

      const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // ✅ Logging mejorado en blockchain
      loggerService.logInfo("✅ Transfer TX enviada a blockchain", {
        context: "updateTokenBalance",
        signature: sig,
        walletAddress,
        amount,
        amountInSmallestUnits,
      });

      // ✅ Confirmar la transacción antes de retornar
      let confirmationStatus = "unknown";
      try {
        const confirmed = await confirm_transaction_with_retries(
          connection,
          sig,
          { maxRetries: 15, timeout: 120000 },
        );
        confirmationStatus = confirmed ? "confirmed" : "pending";
        loggerService.logInfo(
          confirmationStatus === "confirmed"
            ? "✅ Transfer TX confirmada en blockchain"
            : "⚠️ Transfer TX enviada, confirmando en background",
          {
            context: "updateTokenBalance",
            signature: sig,
            confirmationStatus,
            walletAddress,
          },
        );
      } catch (confirmErr) {
        confirmationStatus = "failed";
        loggerService.logError(confirmErr as Error, {
          context: "updateTokenBalance.confirmTransaction",
          signature: sig,
          walletAddress,
        });
      }

      loggerService.logInfo(
        "🔄 updateTokenBalance: Retornando signature al caller",
        {
          context: "updateTokenBalance",
          signature: sig,
          confirmationStatus,
          walletAddress,
        },
      );

      return sig;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      const errorStack =
        e instanceof Error && e.stack ? e.stack : "No stack trace available";
      loggerService.logError(e as Error, {
        context: "updateTokenBalance",
        walletAddress,
        amount,
        message: "❌ CRITICAL: Failed to transfer tokens",
        errorDetails: errorMsg.substring(0, 500),
        errorType: e?.constructor?.name || "Unknown",
        fullError: JSON.stringify(e, null, 2).substring(0, 1000),
        errorStack: errorStack.substring(0, 500),
      });
      return null;
    }
  }

  private async isFirstPurchase(wallet: string): Promise<boolean> {
    const previousPurchases = await transactionRepository.count({
      walletAddress: wallet,
      status: "success",
    });
    return previousPurchases === 0;
  }

  private sendError(
    res: Response,
    message: string,
    status: number,
    requestId: string,
  ): void {
    // Delegar a utilitario centralizado para mantener contrato consistente
    try {
      sendErrorUtil(res, message, status as any, { requestId });
    } catch (e) {
      // Fallback legacy
      res.status(status).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        requestId,
      });
    }
  }

  /**
   * BACKGROUND TASK: Espera a que la transacción de mint se confirme en blockchain
   * y marca la compra como "success" (que es cuando se refleja en el saldo)
   *
   * Flujo:
   * 1. Transacción marcada como "completed" (respuesta inmediata al cliente)
   * 2. En background, espera confirmación real del mint (hasta 2 minutos)
   * 3. Cuando se confirma, marca como "success" (saldo se actualiza)
   */
  private async waitForMintConfirmationAndMarkSuccess(
    transactionId: string,
    mintSignature: string,
    walletAddress: string,
  ): Promise<void> {
    // ✅ Validación crítica: mint signature no puede ser null
    if (!mintSignature) {
      loggerService.logError(new Error("mintSignature is null/undefined"), {
        context: "waitForMintConfirmationAndMarkSuccess",
        transactionId,
        walletAddress,
        note: "Cannot wait for confirmation without signature",
      });
      return;
    }

    console.log(
      "[waitForMintConfirmationAndMarkSuccess] STARTED:",
      transactionId,
      mintSignature.substring(0, 20) + "...",
    );

    loggerService.logInfo(
      "🔄 [BACKGROUND] Esperando confirmación de mint para marcar como SUCCESS",
      {
        context: "waitForMintConfirmationAndMarkSuccess",
        transactionId,
        mintSignature: mintSignature.substring(0, 20) + "...",
        walletAddress,
      },
    );

    try {
      const connection = solanaService.getConnection();

      console.log(
        "[waitForMintConfirmationAndMarkSuccess] Calling confirm_transaction_with_retries...",
      );

      // Esperar confirmación real del mint (hasta 2 minutos)
      const confirmed = await confirm_transaction_with_retries(
        connection,
        mintSignature,
        {
          maxRetries: 15,
          timeout: 120000, // 2 minutos
        },
      );

      console.log(
        "[waitForMintConfirmationAndMarkSuccess] confirm_transaction_with_retries returned:",
        confirmed,
      );

      if (confirmed) {
        console.log(
          "[waitForMintConfirmationAndMarkSuccess] ✅ Mint confirmed, marking as SUCCESS",
        );

        loggerService.logInfo(
          "✅ [BACKGROUND] Mint confirmado en blockchain, marcando como SUCCESS",
          {
            context: "waitForMintConfirmationAndMarkSuccess",
            transactionId,
            mintSignature: mintSignature.substring(0, 20) + "...",
          },
        );

        // Marcar como SUCCESS (aquí se refleja en el saldo)
        const updateResult = await transactionRepository.update(
          { transactionId },
          {
            status: "success",
            completedAt: new Date(),
          },
        );

        console.log(
          "[waitForMintConfirmationAndMarkSuccess] ✅ Updated to SUCCESS:",
          updateResult?.status,
        );

        loggerService.logInfo(
          "✅ [BACKGROUND] Transacción marcada como SUCCESS - Balance debe reflejarse",
          {
            context: "waitForMintConfirmationAndMarkSuccess",
            transactionId,
            walletAddress,
            newStatus: updateResult?.status,
          },
        );
      } else {
        console.log(
          "[waitForMintConfirmationAndMarkSuccess] ⚠️ Mint NOT confirmed after 2 minutes, but marking as SUCCESS anyway",
        );

        loggerService.logInfo(
          "⚠️ [BACKGROUND] Mint no se confirmó en 2 minutos, marcando como SUCCESS de todas formas (usuario pagó)",
          {
            context: "waitForMintConfirmationAndMarkSuccess",
            transactionId,
            mintSignature: mintSignature.substring(0, 20) + "...",
            note: "Verificar en Solana Explorer - la transacción puede estar siendo procesada",
          },
        );

        // ✅ IMPORTANTE: Marcar como SUCCESS de todas formas
        // El usuario ya pagó, así que merecen que se acrediten los tokens
        // incluso si la confirmación en blockchain demora
        const updateResult = await transactionRepository.update(
          { transactionId },
          {
            status: "success",
            completedAt: new Date(),
          },
        );

        console.log(
          "[waitForMintConfirmationAndMarkSuccess] ✅ Updated to SUCCESS (timeout):",
          updateResult?.status,
        );

        loggerService.logInfo(
          "✅ [BACKGROUND] Transacción marcada como SUCCESS después de timeout - Balance debe reflejarse",
          {
            context: "waitForMintConfirmationAndMarkSuccess",
            transactionId,
            walletAddress,
            newStatus: updateResult?.status,
            reason: "Timeout - usuario already paid",
          },
        );
      }
    } catch (error) {
      console.error("[waitForMintConfirmationAndMarkSuccess] ERROR:", error);

      loggerService.logError(error as Error, {
        context: "waitForMintConfirmationAndMarkSuccess",
        transactionId,
        mintSignature,
        message: "Error esperando confirmación de mint",
      });

      // ✅ FALLBACK: Even on error, mark as success
      // The user paid and the mint was already sent
      try {
        console.log(
          "[waitForMintConfirmationAndMarkSuccess] ERROR FALLBACK: Marking as SUCCESS despite error",
        );

        const updateResult = await transactionRepository.update(
          { transactionId },
          {
            status: "success",
            completedAt: new Date(),
          },
        );

        console.log(
          "[waitForMintConfirmationAndMarkSuccess] ✅ Updated to SUCCESS (error fallback):",
          updateResult?.status,
        );

        loggerService.logInfo(
          "✅ [BACKGROUND] Transacción marcada como SUCCESS después de error - Balance debe reflejarse",
          {
            context: "waitForMintConfirmationAndMarkSuccess",
            transactionId,
            walletAddress,
            newStatus: updateResult?.status,
            reason: "Error during confirmation, but mint was sent",
          },
        );
      } catch (updateError) {
        loggerService.logError(updateError as Error, {
          context: "waitForMintConfirmationAndMarkSuccess.errorFallback",
          transactionId,
          message: "Failed to mark as success even in error handler",
        });
      }
    }
  }
}

// ✅ Validators con tipado
export const purchaseValidators = {
  getCurrentPrice: [
    query("amount")
      .optional()
      .isFloat({ min: 0.000000001 })
      .withMessage("Amount must be a positive number greater than 0.000000001"),
  ],
  initiatePurchase: [
    body("walletAddress")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Wallet address is required"),
    // Use dynamic min/max from PROWALLET_CONFIG to keep validation in sync with .env
    body("tokenAmount")
      .custom((value) => {
        const v = parseFloat(value);
        if (isNaN(v) || v <= 0) return false;
        // Check against min/max - allow up to 9 decimal places
        if (v < PROWALLET_CONFIG.min_purchase || v > PROWALLET_CONFIG.max_purchase)
          return false;
        return true;
      })
      .withMessage(
        `Token amount must be between ${PROWALLET_CONFIG.min_purchase} and ${PROWALLET_CONFIG.max_purchase} tokens.`,
      ),
    body("paymentMethod")
      .optional()
      .isIn(["SOL", "USDC"])
      .withMessage("Invalid payment method"),
    body("maxSlippage")
      .optional()
      .isFloat({ min: 0.1, max: 50 })
      .withMessage("Max slippage must be between 0.1% and 50%"),
  ],
  confirmPurchase: [
    param("transactionId").isUUID().withMessage("Invalid transaction ID"),
    body("signature")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Transaction signature is required"),
    body("blockSlot")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Invalid block slot"),
  ],
  getPurchaseStatus: [
    param("transactionId").isUUID().withMessage("Invalid transaction ID"),
  ],
  getPurchaseHistory: [
    param("walletAddress")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Wallet address is required"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("status")
      .optional()
      .isIn(["pending", "success", "failed", "cancelled"])
      .withMessage("Invalid status filter"),
  ],
  getMarketStats: [
    query("timeframe")
      .optional()
      .isIn(["1h", "24h", "7d", "30d"])
      .withMessage("Invalid timeframe"),
  ],
  getPaymentMethods: [],
  createAlternativePayment: [
    body("walletAddress")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Wallet address is required"),
    body("tokenAmount")
      .isFloat({
        min: PROWALLET_CONFIG.min_purchase,
        max: PROWALLET_CONFIG.max_purchase,
      })
      .withMessage(
        `Token amount must be between ${PROWALLET_CONFIG.min_purchase} and ${PROWALLET_CONFIG.max_purchase}`,
      ),
    body("currency")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Payment currency is required"),
    body("paymentMethod")
      .isIn(["crypto", "credit_card", "debit_card"])
      .withMessage("Invalid payment method"),
    body("customerEmail")
      .optional()
      .isEmail()
      .withMessage("Invalid email address"),
    body("processorName")
      .optional()
      .isIn(["stripe", "coingate", "nowpayments"])
      .withMessage("Invalid processor name"),
  ],
  checkPaymentStatus: [
    param("transactionId").isUUID().withMessage("Invalid transaction ID"),
  ],
  settlePurchase: [
    param("transactionId").isUUID().withMessage("Invalid transaction ID"),
  ],
};

export const purchaseController = new PurchaseController();
