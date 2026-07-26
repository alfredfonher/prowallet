import { buildPurchaseTransactions } from "./build-transactions.service";
import { processPurchase } from "./process-transactions.service";

export class TransactionService {
  buildPurchaseTransactions = buildPurchaseTransactions;
  processPurchase = processPurchase;
}

export const transactionService = new TransactionService();
