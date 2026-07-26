import { useState, useCallback } from "react";

export interface WalletUser {
  id: number;
  address: string;
  label: string;
  username?: string;
}

export interface WalletSearchResult {
  id: number;
  address: string;
  label: string;
  username?: string;
}

export function use_wallet_search(wallet_users: WalletUser[]) {
  const [search_query, set_search_query] = useState("");
  const [is_open, set_is_open] = useState(false);

  const filter_wallets = useCallback(
    (query: string): WalletSearchResult[] => {
      if (!query.trim()) {
        return wallet_users.slice(0, 5);
      }

      const lower_query = query.toLowerCase();
      return wallet_users
        .filter(
          (w) =>
            w.address.toLowerCase().includes(lower_query) ||
            w.username?.toLowerCase().includes(lower_query),
        )
        .slice(0, 5);
    },
    [wallet_users],
  );

  const handle_search = useCallback((query: string) => {
    set_search_query(query);
  }, []);

  const handle_select = useCallback((address: string) => {
    set_search_query("");
    set_is_open(false);
    return address;
  }, []);

  const handle_toggle = useCallback(() => {
    set_is_open((prev) => !prev);
  }, []);

  const results = filter_wallets(search_query);

  return {
    search_query,
    is_open,
    results,
    handle_search,
    handle_select,
    handle_toggle,
    set_search_query,
    set_is_open,
  };
}
