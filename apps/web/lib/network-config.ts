/**
 * Network Configuration for Solana
 * Supports multiple environments (devnet, testnet, mainnet-beta)
 */

export type Network = "devnet" | "testnet" | "mainnet-beta";

export interface NetworkConfig {
  network: Network;
  rpcUrl: string;
  wsUrl: string;
  explorer: string;
  displayName: string;
  isTestnet: boolean;
}

const NETWORKS: Record<Network, NetworkConfig> = {
  devnet: {
    network: "devnet",
    rpcUrl: "https://api.devnet.solana.com",
    wsUrl: "wss://api.devnet.solana.com",
    explorer: "https://explorer.solana.com?cluster=devnet",
    displayName: "Devnet (Testing)",
    isTestnet: true,
  },
  testnet: {
    network: "testnet",
    rpcUrl: "https://api.testnet.solana.com",
    wsUrl: "wss://api.testnet.solana.com",
    explorer: "https://explorer.solana.com?cluster=testnet",
    displayName: "Testnet (Testing)",
    isTestnet: true,
  },
  "mainnet-beta": {
    network: "mainnet-beta",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    wsUrl: "wss://api.mainnet-beta.solana.com",
    explorer: "https://explorer.solana.com",
    displayName: "Mainnet (Production)",
    isTestnet: false,
  },
};

// Get network from environment or default to devnet
function getNetworkFromEnv(): Network {
  const env = process.env.NEXT_PUBLIC_SOLANA_NETWORK as Network | undefined;
  if (env && env in NETWORKS) {
    return env;
  }
  return "devnet";
}

export const CURRENT_NETWORK = getNetworkFromEnv();

/**
 * Get configuration for current network
 */
export function getNetworkConfig(): NetworkConfig {
  return NETWORKS[CURRENT_NETWORK];
}

/**
 * Get all available networks
 */
export function getAllNetworks(): NetworkConfig[] {
  return Object.values(NETWORKS);
}

/**
 * Check if we're on a testnet
 */
export function isTestnet(): boolean {
  return NETWORKS[CURRENT_NETWORK].isTestnet;
}

/**
 * Gas fee estimation (in lamports)
 * Solana typically charges 5,000 lamports per transaction
 * SPL token transfers usually cost 5,000 lamports (0.000005 SOL)
 */
export interface GasFeeEstimate {
  lamports: number;
  sol: number;
  usd: number | null; // null if we can't get SOL price
}

// Standard fees for Solana transactions
export const TRANSACTION_FEES = {
  simple_transfer: 5000, // lamports (0.000005 SOL)
  token_transfer: 5000, // lamports (0.000005 SOL)
  multi_instruction: 10000, // lamports for complex transactions
};

/**
 * Estimate gas fees for a transfer
 * @param solPrice Current SOL price in USD (optional)
 */
export function estimateTransferFee(solPrice?: number): GasFeeEstimate {
  const lamports = TRANSACTION_FEES.token_transfer;
  const sol = lamports / 1_000_000_000; // Convert lamports to SOL
  const usd = solPrice ? sol * solPrice : null;

  return {
    lamports,
    sol,
    usd,
  };
}

/**
 * Format gas fee for display
 */
export function formatGasFee(estimate: GasFeeEstimate): string {
  if (estimate.usd !== null && estimate.usd > 0) {
    return `${estimate.sol.toFixed(6)} SOL (~$${estimate.usd.toFixed(4)})`;
  }
  return `${estimate.sol.toFixed(6)} SOL`;
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerUrl(txId: string): string {
  const config = getNetworkConfig();
  return `${config.explorer}&tx=${txId}`;
}

/**
 * Get explorer URL for address
 */
export function getExplorerAddressUrl(address: string): string {
  const config = getNetworkConfig();
  return `${config.explorer}&address=${address}`;
}
