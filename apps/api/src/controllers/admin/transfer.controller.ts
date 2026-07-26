import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.util";
import { StatusFlowCodes } from "status-flow";
import { transferTokens } from "../../services/solana/transfer.service";
import { solanaService } from "../../services/solana.service";
import { PublicKey } from "@solana/web3.js";
import { loggerService } from "../../services/logging/logger.service";

class TransferController {
  async transferToTest(req: Request, res: Response) {
    try {
      loggerService.logInfo("admin.transferToTest called", {
        context: "transferController",
      });
      const requestId =
        (req as any).requestId || loggerService.generateRequestId();
      loggerService.logInfo("admin.transferToTest request", {
        requestId,
        body: req.body,
      });
      const adminKey = (req.headers["x-admin-key"] as string) || "";
      const secret = process.env.MANUAL_SETTLE_KEY || "";
      if (!secret || adminKey !== secret) {
        return sendError(res, "Unauthorized", StatusFlowCodes.FORBIDDEN, {
          error: "Unauthorized",
        });
      }

      const dest =
        (req.body && req.body.destination) ||
        process.env.TEST_WALLET ||
        "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD";
      const mintStr = process.env.TOKEN_MINT;
      const decimals = Number(process.env.TOKEN_DECIMALS || 9);
      if (!mintStr)
        return sendError(
          res,
          "TOKEN_MINT no configurado",
          StatusFlowCodes.INTERNAL_SERVER_ERROR,
          { error: "TOKEN_MINT no configurado" },
        );

      const connection = solanaService.getConnection();
      const mintPub = new PublicKey(mintStr);
      const destPub = new PublicKey(dest);

      const authorityKeypairPath =
        process.env.AUTHORITY_KEYPAIR_PATH ||
        process.env.KEYPAIR_PATH ||
        "apps/api/idl/prowallet.json";

      const sig = await transferTokens({
        connection,
        authorityKeypairPath,
        mintPubkey: mintPub,
        destinationPubkey: destPub,
        amountTokens: 1,
        decimals,
      });

      return sendSuccess(
        res,
        { signature: sig, destination: dest, amount: 1 },
        "OK",
        StatusFlowCodes.OK,
      );
    } catch (e) {
      loggerService.logError(e as Error, { context: "transferToTest" });
      return sendError(
        res,
        (e as Error).message || String(e),
        StatusFlowCodes.INTERNAL_SERVER_ERROR,
        { error: (e as Error).message || String(e) },
      );
    }
  }
}

export const transferController = new TransferController();
