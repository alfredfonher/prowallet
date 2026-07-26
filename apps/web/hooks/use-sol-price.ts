"use client";

import { useState, useEffect } from "react";

/**
 * Hook to fetch current SOL price in USD
 * Uses Solana price API as fallback if market data unavailable
 */
export function useSolPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try coingecko first (free, no auth needed)
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch SOL price");
        }

        const data = await response.json();
        const solPrice = data.solana?.usd;

        if (solPrice) {
          setPrice(solPrice);
        } else {
          throw new Error("Invalid price data");
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error fetching price";
        setError(errorMsg);
        console.warn("[SOL-PRICE] Error fetching SOL price:", errorMsg);
        // Continue anyway, just without USD conversion
        setPrice(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();

    // Refresh price every 30 seconds
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  return { price, loading, error };
}
