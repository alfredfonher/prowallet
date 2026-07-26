// Smart Contract Configuration
export const PROWALLET_CONFIG = {
  treasury_wallet: process.env.TREASURY_WALLET,
  token_mint: process.env.TOKEN_MINT,
  program_id: process.env.PROWALLET_PROGRAM_ID,
  decimals: parseInt(process.env.TOKEN_DECIMALS || "9"),
  basePrice: parseFloat(process.env.BASE_TOKEN_PRICE || "0"),
  pricing_mode: process.env.PRICING_MODE || "bonding",
  bonding_curve_multiplier: parseFloat(
    process.env.BONDING_CURVE_MULTIPLIER || "1.5",
  ),
  test_mode_free_token: process.env.TEST_MODE_FREE_TOKEN === "true",
  // Add more configuration as needed
};
