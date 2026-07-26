import { startSettlementWorker } from "./purchase-settlement.worker";

export class PurchaseSettlementService {
  private running = false;

  start() {
    if (this.running) return;
    this.running = true;
    startSettlementWorker();
    console.log("[PurchaseSettlementService] Worker de liquidación iniciado.");
  }
}

export const purchaseSettlementService = new PurchaseSettlementService();
