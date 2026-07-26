import { Request, Response, Router } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { databaseService } from "../../services/database/database.service";
import { validateJWT } from "../../middleware/jwt";

const router: Router = Router();

// POST /exchange/withdraw - solicitar retiro on-chain de tokens (cola para worker)
router.post("/withdraw", validateJWT, async (req: Request, res: Response) => {
  try {
    const prisma = databaseService.getClient();
    const tokenUser = (req as any).user as any;
    const username = tokenUser?.username;
    const { amount, to } = req.body;

    if (!username || !amount || !to) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.INVALID_INPUT,
          lang: "es",
          extra: { error: "Se requieren amount y to" },
        }),
      );
    }

    // Calcular balance interno del usuario (suma de transacciones exitosas)
    // Buscar tanto por username como por publicKey (wallet address real)
    const publicKey = tokenUser?.publicKey;
    const walletCandidates = [username];
    if (publicKey) walletCandidates.push(publicKey);

    const userTransactions = await prisma.transaction.findMany({
      where: {
        OR: walletCandidates.map((w) => ({ walletAddress: w })),
        status: "success",
      },
    });

    let userBalance = 0;
    for (const tx of userTransactions) {
      if (tx.transactionType === "purchase" || tx.transactionType === "claim") {
        userBalance += tx.tokenAmount;
      } else if (tx.transactionType === "stake") {
        userBalance -= tx.tokenAmount;
      } else if (tx.transactionType === "unstake") {
        userBalance += tx.tokenAmount;
      } else if (tx.transactionType === "transfer") {
        userBalance -= tx.tokenAmount;
      }
    }

    if (userBalance < amount) {
      return res.status(400).json(
        StatusFlow({
          code: StatusFlowCodes.INVALID_INPUT,
          lang: "es",
          extra: {
            error: "Saldo insuficiente para retirar",
            currentBalance: userBalance,
            requestedAmount: amount,
          },
        }),
      );
    }

    // Crear transacción de retiro en ledger y marcarla como 'success' internamente
    // para reservar/sustraer el balance del usuario. El envío on-chain se realizará
    // por el worker y actualizará los campos de mint/signature.
    const withdrawWalletAddress = publicKey || username;
    const transaction = await prisma.transaction.create({
      data: {
        transactionId: `withdraw-${Date.now()}-${withdrawWalletAddress.slice(-6)}`,
        walletAddress: withdrawWalletAddress,
        transactionType: "transfer",
        tokenAmount: -Math.abs(parseFloat(amount)),
        status: "success",
        metadata: JSON.stringify({
          to,
          originalAmount: parseFloat(amount),
          requestedAt: new Date().toISOString(),
          pendingOnChain: true,
        }),
      },
    });

    // Respondemos con el id de transacción
    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: {
          message: "Retiro solicitado",
          transaction,
        },
      }),
    );
  } catch (error) {
    console.error("Error in withdraw endpoint:", error);
    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: {
          error:
            error instanceof Error
              ? error.message
              : "Error al solicitar retiro",
        },
      }),
    );
  }
});

export default router;
