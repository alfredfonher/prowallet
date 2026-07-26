import { Connection, PublicKey, clusterApiUrl, Cluster } from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  Wallet,
  setProvider,
} from "@coral-xyz/anchor";
import {
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { RpcThrottler, RpcCache } from "../config/rpc.config";

// Types
export interface SolanaConfig {
  network: Cluster;
  rpcUrl: string;
  programId: string;
}

export interface TokenBalance {
  wallet: string;
  balance: number;
  decimals: number;
  uiAmount: number;
}

export class SolanaService {
  private connection: Connection;
  private programId: PublicKey;
  private network: Cluster;

  constructor() {
    this.network = (process.env.SOLANA_NETWORK as Cluster) || "devnet";
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(this.network);
    this.connection = new Connection(rpcUrl, "confirmed");
    const programIdString = process.env.PROWALLET_PROGRAM_ID;
    if (!programIdString) {
      throw new Error("PROWALLET_PROGRAM_ID environment variable is required");
    }
    this.programId = new PublicKey(programIdString);

    console.log(`🔗 Connected to Solana ${this.network}`);
    console.log(`📍 ProWallet Program ID: ${this.programId.toString()}`);
  }

  // Get connection instance
  getConnection(): Connection {
    return this.connection;
  }

  // Get program ID
  getProgramId(): PublicKey {
    return this.programId;
  }

  // Get network info
  getNetworkInfo() {
    return {
      network: this.network,
      rpcUrl: this.connection.rpcEndpoint,
      programId: this.programId.toString(),
    };
  }

  // Check Solana network connectivity
  async checkConnection(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      console.log("Solana version:", version);
      return true;
    } catch (error) {
      console.error("Failed to connect to Solana:", error);
      return false;
    }
  }

  // Get account info
  async getAccountInfo(publicKey: string) {
    try {
      const pubKey = new PublicKey(publicKey);
      const accountInfo = await this.connection.getAccountInfo(pubKey);
      return accountInfo;
    } catch (error) {
      console.error("Error getting account info:", error);
      throw new Error(`Failed to get account info for ${publicKey}`);
    }
  }

  // Get SOL balance
  async getSolBalance(publicKey: string): Promise<number> {
    try {
      const pubKey = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pubKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error("Error getting SOL balance:", error);
      throw new Error(`Failed to get SOL balance for ${publicKey}`);
    }
  }

  // Get token balance
  async getTokenBalance(
    wallet: string,
    mintAddress: string,
  ): Promise<TokenBalance> {
    try {
      const walletPubkey = new PublicKey(wallet);
      const mintPubkey = new PublicKey(mintAddress);

      // Get associated token account
      const tokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey,
      );

      // Get account info
      const accountInfo = await getAccount(this.connection, tokenAccount);

      return {
        wallet,
        balance: Number(accountInfo.amount),
        decimals: 9, // ProWallet (GAPC) has 9 decimals
        uiAmount: Number(accountInfo.amount) / Math.pow(10, 9),
      };
    } catch (error) {
      console.error("Error getting token balance:", error);
      // Return zero balance if account doesn't exist
      return {
        wallet,
        balance: 0,
        decimals: 9,
        uiAmount: 0,
      };
    }
  }

  // Get recent transactions
  async getRecentTransactions(publicKey: string, limit: number = 10) {
    try {
      const pubKey = new PublicKey(publicKey);
      const signatures = await this.connection.getSignaturesForAddress(pubKey, {
        limit,
      });

      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await this.connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
          return {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            confirmationStatus: sig.confirmationStatus,
            err: sig.err,
            transaction: tx,
          };
        }),
      );

      return transactions;
    } catch (error) {
      console.error("Error getting recent transactions:", error);
      throw new Error(`Failed to get transactions for ${publicKey}`);
    }
  }

  // Validate Solana address
  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  // Get program account data
  async getProgramAccounts() {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId);
      return accounts.map((account) => ({
        pubkey: account.pubkey.toString(),
        account: {
          ...account.account,
          data: account.account.data.toString("base64"),
        },
      }));
    } catch (error) {
      console.error("Error getting program accounts:", error);
      throw new Error("Failed to get program accounts");
    }
  }

  // Get transaction details
  async getTransaction(signature: string) {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });
      return transaction;
    } catch (error) {
      console.error("Error getting transaction:", error);
      throw new Error(`Failed to get transaction ${signature}`);
    }
  }

  // Get token mint information (supply, decimals, etc)
  async getTokenMintInfo(mintAddress: string) {
    try {
      const mint = new PublicKey(mintAddress);
      const accountInfo = await this.connection.getAccountInfo(mint);

      if (!accountInfo) {
        throw new Error("Token mint account not found");
      }

      // Parse token mint data using spl-token
      const { getMint } = await import("@solana/spl-token");
      const mintData = await getMint(this.connection, mint);

      return {
        mint: mintAddress,
        supply: mintData.supply.toString(),
        decimals: mintData.decimals,
        isInitialized: mintData.isInitialized,
        freezeAuthority: mintData.freezeAuthority?.toString() || null,
        mintAuthority: mintData.mintAuthority?.toString() || null,
      };
    } catch (error) {
      console.error("Error getting token mint info:", error);
      throw new Error(`Failed to get token mint info for ${mintAddress}`);
    }
  }

  // Get all token accounts for a specific mint
  async getTokenHolders(mintAddress: string): Promise<any[]> {
    try {
      const mint = new PublicKey(mintAddress);

      // Get all token accounts for this mint
      const accounts = await this.connection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID,
        {
          filters: [
            {
              dataSize: 165, // Token account size
            },
            {
              memcmp: {
                offset: 0, // mint is at offset 0
                bytes: mint.toBase58(),
              },
            },
          ],
        },
      );

      const holders: any[] = [];
      for (const account of accounts) {
        const parsedInfo = (account.account.data as any).parsed.info;
        holders.push({
          owner: parsedInfo.owner,
          tokenAmount: parsedInfo.tokenAmount.uiAmount,
          decimals: parsedInfo.tokenAmount.decimals,
          address: account.pubkey.toString(),
        });
      }

      return holders;
    } catch (error) {
      console.error("Error getting token holders:", error);
      throw new Error(`Failed to get token holders for ${mintAddress}`);
    }
  }

  // Get total circulating supply from all holders
  async getCirculatingSupply(mintAddress: string): Promise<number> {
    try {
      const holders = await this.getTokenHolders(mintAddress);
      const total = holders.reduce(
        (sum, holder) => sum + (holder.tokenAmount || 0),
        0,
      );
      return total;
    } catch (error) {
      console.error("Error getting circulating supply:", error);
      return 0;
    }
  }
}

// Export singleton instance
export const solanaService = new SolanaService();
