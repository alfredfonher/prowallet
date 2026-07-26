import { Transaction, TransactionSignature } from "@solana/web3.js";

export type PurchaseResult = {
  solTxId: string;
  mintTxId: string;
};

export type PurchaseTransactions = {
  solTransaction: Transaction;
  mintTransaction: Transaction;
};
