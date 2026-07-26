"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface MarketData {
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  ath: number;
  atl: number;
  circulatingSupply: number;
  totalSupply: number;
  lastUpdated: string;
}

interface UseMarketStatsReturn {
  marketData: MarketData | null;
  topCryptos: any[];
  priceHistory: any[];
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  fetchMarketStats(): Promise<void>;
  fetchTopCryptos(limit?: number): Promise<void>;
  fetchPriceHistory(
    timeframe: "1h" | "1d" | "7d" | "30d" | "1y",
  ): Promise<void>;
}

export function useMarketStats(): UseMarketStatsReturn {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [topCryptos, setTopCryptos] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stats = await apiClient.getMarketStats();

      if (stats) {
        const formatted: MarketData = {
          currentPrice: stats.current_price || 0,
          marketCap: stats.market_cap || 0,
          volume24h: stats.total_volume || 0,
          priceChange24h: stats.price_change_24h || 0,
          priceChangePercent24h: stats.price_change_percentage_24h || 0,
          high24h: stats.high_24h || 0,
          low24h: stats.low_24h || 0,
          ath: stats.ath || 0,
          atl: stats.atl || 0,
          circulatingSupply: stats.circulating_supply || 0,
          totalSupply: stats.total_supply || 0,
          lastUpdated: new Date().toISOString(),
        };
        setMarketData(formatted);
      }
    } catch (err: any) {
      const errorMsg =
        err.message || "Error al obtener estadísticas del mercado";
      setError(errorMsg);
      console.error("Error fetching market stats:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTopCryptos = useCallback(async (limit: number = 10) => {
    setIsLoading(true);
    setError(null);

    try {
      const cryptos = await apiClient.getTopCryptos(limit);
      setTopCryptos(cryptos || []);
    } catch (err: any) {
      const errorMsg = err.message || "Error al obtener top criptos";
      setError(errorMsg);
      console.error("Error fetching top cryptos:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPriceHistory = useCallback(
    async (timeframe: "1h" | "1d" | "7d" | "30d" | "1y") => {
      setIsLoadingHistory(true);
      setError(null);

      try {
        const history = await apiClient.getPriceHistory(timeframe);
        setPriceHistory(history || []);
      } catch (err: any) {
        const errorMsg = err.message || "Error al obtener historial de precios";
        setError(errorMsg);
        console.error("Error fetching price history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [],
  );

  // Auto-fetch al montar
  useEffect(() => {
    fetchMarketStats();
    fetchTopCryptos();

    // Refrescar cada 30 segundos
    const interval = setInterval(() => {
      fetchMarketStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchMarketStats, fetchTopCryptos]);

  return {
    marketData,
    topCryptos,
    priceHistory,
    isLoading,
    isLoadingHistory,
    error,
    fetchMarketStats,
    fetchTopCryptos,
    fetchPriceHistory,
  };
}
