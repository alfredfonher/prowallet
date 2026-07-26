import { getRequiredEnvVar } from "../utils/env";

export const PROWALLET_CONFIG = {
  // Token configuration
  token_mint: getRequiredEnvVar("TOKEN_MINT_ADDRESS"),
  program_id: getRequiredEnvVar("PROWALLET_PROGRAM_ID"),
  treasury_wallet: getRequiredEnvVar("TREASURY_WALLET"),

  // Purchase limits
  min_purchase: parseFloat(process.env.MIN_PURCHASE_AMOUNT || "0.000000001"), // Allow 9 decimals
  max_purchase: parseInt(process.env.MAX_PURCHASE_AMOUNT || "10000"),

  // Price parameters - PROWALLET tokens are now FREE
  base_price: parseFloat(process.env.BASE_TOKEN_PRICE || "0"),
  price_increment: parseFloat(
    process.env.BONDING_CURVE_MULTIPLIER || "0.00001",
  ),
  max_slippage: 5,

  // Gas and fees
  gas_cost: parseFloat(process.env.GAS_ESTIMATE_SOL || "0.0015"),
  fee_percentage: 1,

  // Token info
  decimals: parseInt(process.env.TOKEN_DECIMALS || "9"),
  max_supply: parseInt(process.env.MAX_SUPPLY || "1000000000000000000"),
};
