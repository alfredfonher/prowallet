import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import * as fs from "fs";
import { loggerService } from "../../logging/logger.service";
import {
  CreatePaymentParams,
  PaymentMethod,
  PaymentProcessor,
  PaymentResponse,
  PaymentStatus,
  PaymentVerificationResult,
  SupportedCryptoCurrency,
  WebhookResult,
} from "../payment.interface";

export class SolanaProcessor implements PaymentProcessor {
  name = "Solana Native Processor";
  supportedCurrencies = ["SOL"];
  supportedPaymentMethods = [PaymentMethod.CRYPTO];

  private connection: Connection | null = null;
  private authorityKeypair: any;
  private mint: PublicKey;
  private treasury: PublicKey;
  private decimals: number;

  constructor() {
    this.mint = new PublicKey(process.env.TOKEN_MINT!);
    this.treasury = new PublicKey(process.env.TREASURY_WALLET!);
    this.decimals = parseInt(process.env.TOKEN_DECIMALS || "9");
    // Cargar keypair del authority
    const keypairPath = process.env.AUTHORITY_KEYPAIR_PATH!;
    const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Keypair } = require("@solana/web3.js");
    this.authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  }

  private getConnection(): Connection {
    if (!this.connection) {
      this.connection = new Connection(
        process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
        "confirmed",
      );
    }
    return this.connection;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
    try {
      // Validar parámetros
      if (!params.customerWallet) throw new Error("customerWallet is required");
      if (!params.tokenAmount || params.tokenAmount <= 0)
        throw new Error("tokenAmount must be > 0");
      const buyer = new PublicKey(params.customerWallet);
      const solAmount = params.amount;
      // Construir y enviar transacción de SOL
      const tx = new Transaction().add(
        // Transferencia de SOL al treasury
        require("@solana/web3.js").SystemProgram.transfer({
          fromPubkey: buyer,
          toPubkey: this.treasury,
          lamports: Math.round(solAmount * LAMPORTS_PER_SOL),
        }),
      );
      // Aquí deberías pedir la firma del usuario comprador (fuera del backend)
      // El backend solo debe firmar la transacción de mint
      // Guardar el paymentId y estado en base de datos si es necesario
      return {
        paymentId: `solana_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`,
        paymentUrl: "",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        status: PaymentStatus.PENDING,
        metadata: {
          processor: "solana",
          instructions:
            "Firma y envía la transacción de SOL desde tu wallet. Luego confirma la compra.",
        },
      };
    } catch (error) {
      loggerService.logError(error as Error, {
        context: "SolanaProcessor.createPayment",
      });
      throw new Error(
        `Failed to create Solana payment: ${(error as Error).message}`,
      );
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
    // Implementa la lógica para verificar en la blockchain si la transacción de SOL fue confirmada
    // Busca el paymentId en tu base de datos y verifica el estado
    return {
      isValid: true,
      status: PaymentStatus.CONFIRMED,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    // Implementa la lógica para consultar el estado real del pago
    return PaymentStatus.CONFIRMED;
  }

  async handleWebhook(
    payload: any,
    signature?: string,
  ): Promise<WebhookResult> {
    // No aplica para pagos nativos en Solana
    return {
      processed: false,
      paymentId: "",
      status: PaymentStatus.FAILED,
    };
  }

  async getSupportedCryptoCurrencies(): Promise<SupportedCryptoCurrency[]> {
    return [
      {
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        minAmount: 0.01,
        maxAmount: 10000,
      },
    ];
  }

  supportsCardPayments(): boolean {
    return false;
  }

  supportsCryptoPayments(): boolean {
    return true;
  }
}
