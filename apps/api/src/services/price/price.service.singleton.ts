/**
 * Price Service Singleton
 * Provides a single instance of PriceService for use across the application
 */
import { PriceService } from "./price.service";

export const priceService = new PriceService();
