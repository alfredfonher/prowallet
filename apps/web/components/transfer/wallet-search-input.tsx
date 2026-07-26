"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface WalletInfo {
  id: string;
  address: string;
  username: string;
  label: string;
}

interface WalletSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (wallet: WalletInfo) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function WalletSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = "Introduce dirección de wallet...",
  disabled = false,
}: WalletSearchInputProps) {
  const [searchResults, setSearchResults] = useState<WalletInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [cacheStatus, setCacheStatus] = useState<any>(null);

  // Search wallets with debouncing
  const searchWallets = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.get(
        `/wallets/search?query=${encodeURIComponent(query)}&limit=5`,
      );
      const wallets = response.extra?.wallets || [];
      setSearchResults(wallets);
      setShowDropdown(wallets.length > 0);
      setCacheStatus(response.extra?.cacheStatus || null);
    } catch (error) {
      console.error("Error searching wallets:", error);
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Force refresh cache
  const refreshCache = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await apiClient.post("/wallets/refresh");
      console.log("Cache refreshed:", response.extra);

      // Re-search with current query ONLY if dropdown is currently open
      if (showDropdown && value.trim() && value.trim().length >= 2) {
        await searchWallets(value);
      }
    } catch (error) {
      console.error("Error refreshing cache:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [value, searchWallets, showDropdown]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value !== lastQuery) {
        searchWallets(value);
        setLastQuery(value);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, lastQuery, searchWallets]);

  // Auto-refresh every 5 seconds ONLY when dropdown is closed
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Only refresh if dropdown is closed, not typing, and not loading
      if (!showDropdown && value === lastQuery && !isLoading) {
        refreshCache();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [value, lastQuery, isLoading, refreshCache, showDropdown]);

  // Hide dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".wallet-search-container")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (wallet: WalletInfo) => {
    onChange(wallet.address);
    onSelect(wallet);
    setShowDropdown(false);
    setSearchResults([]);
    // Stop auto-refresh by setting a flag or clearing lastQuery
    setLastQuery(wallet.address); // Prevent further refreshes
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (newValue.trim().length >= 2) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
      setSearchResults([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const getResultIcon = (wallet: WalletInfo, index: number) => {
    const score = calculateRelevanceScore(wallet, value);

    if (score >= 90) {
      return "⭐"; // Exact match
    } else if (score >= 70) {
      return "🎯"; // Starts with
    } else if (score >= 50) {
      return "🔍"; // Contains
    } else {
      return `${index + 1}.`;
    }
  };

  const calculateRelevanceScore = (
    wallet: WalletInfo,
    query: string,
  ): number => {
    if (!query) return 0;

    const cleanQuery = query.toLowerCase().trim();
    let score = 0;

    if (wallet.address.toLowerCase() === cleanQuery) {
      score = 100;
    } else if (wallet.address.toLowerCase().startsWith(cleanQuery)) {
      score = 80;
    } else if (wallet.username.toLowerCase() === cleanQuery) {
      score = 90;
    } else if (wallet.username.toLowerCase().startsWith(cleanQuery)) {
      score = 70;
    } else if (wallet.address.toLowerCase().includes(cleanQuery)) {
      score = 50;
    } else if (wallet.username.toLowerCase().includes(cleanQuery)) {
      score = 40;
    }

    return score;
  };

  return (
    <div className="wallet-search-container relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
                        w-full px-4 py-3 pr-20 border border-input bg-background rounded-xl
                        focus:outline-none focus:ring-2 focus:ring-primary/20 
                        focus:border-primary transition-all duration-200
                        ${disabled ? "bg-muted cursor-not-allowed" : "bg-background"}
                        ${showDropdown ? "rounded-b-none border-b-0" : ""}
                    `}
        />

        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          {isLoading && (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          )}

          <button
            type="button"
            onClick={refreshCache}
            disabled={isRefreshing}
            className="p-1 text-muted-foreground hover:text-primary transition-colors duration-200 disabled:opacity-50"
            title="Actualizar lista de wallets"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>

          {!isLoading && <Search className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Dropdown Results */}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-50 w-full bg-card border border-border border-t-0 rounded-b-lg shadow-lg max-h-64 overflow-y-auto">
          {searchResults.map((wallet, index) => {
            const relevanceScore = calculateRelevanceScore(wallet, value);
            const isHighRelevance = relevanceScore >= 70;

            return (
              <div
                key={wallet.id}
                onClick={() => handleSelect(wallet)}
                className={`
                                    px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors duration-150
                                    border-b border-border/50 last:border-b-0
                                    ${isHighRelevance ? "bg-secondary/50 font-medium" : ""}
                                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-muted-foreground">
                      {getResultIcon(wallet, index)}
                    </span>
                    <div>
                      <div className="font-medium text-foreground">
                        {wallet.username ||
                          wallet.address.slice(0, 8) +
                            "..." +
                            wallet.address.slice(-8)}
                      </div>
                      {wallet.username && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {wallet.address.slice(0, 12)}...
                          {wallet.address.slice(-12)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {cacheStatus && (
            <div className="px-4 py-2 bg-muted/50 text-xs text-muted-foreground border-t border-border">
              {cacheStatus.isStale
                ? "🔄 Actualizando..."
                : "✅ Lista actualizada"}
              {" • "} {cacheStatus.cacheSize} wallets encontradas
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {showDropdown &&
        searchResults.length === 0 &&
        value.trim().length >= 2 &&
        !isLoading && (
          <div className="absolute z-50 w-full bg-card border border-border border-t-0 rounded-b-lg shadow-lg">
            <div className="px-4 py-3 text-muted-foreground text-sm">
              No se encontraron wallets para "{value}"
            </div>
          </div>
        )}
    </div>
  );
}
