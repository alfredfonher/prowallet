import { apiClient } from "@/lib/api-client";

export interface WalletUser {
  id: number;
  address: string;
  label: string;
  username?: string;
}

export async function fetch_wallet_holders(): Promise<WalletUser[]> {
  try {
    const response = await apiClient.get("/users/wallets");

    if (!response.success || !response.extra?.wallets) {
      return [];
    }

    const wallet_users: WalletUser[] = (response.extra.wallets || [])
      .map((item: any) => ({
        id: item.id,
        address: item.address,
        label: item.label,
        username: item.username,
      }))
      .filter((w: any) => w.address);

    return wallet_users;
  } catch (error) {
    console.error("Error fetching wallet holders:", error);
    return [];
  }
}

export async function fetch_wallet_balance(
  wallet_address: string,
): Promise<number> {
  try {
    const response = await apiClient.get(`/wallet/balance/${wallet_address}`);
    return response.extra?.balance || 0;
  } catch (error) {
    console.error(`Error fetching balance for ${wallet_address}:`, error);
    return 0;
  }
}

export async function fetch_both_balances(
  from_holder: string,
  to_address: string,
): Promise<{ from_balance: number; to_balance: number }> {
  const [from_response, to_response] = await Promise.all([
    apiClient.get(`/wallet/balance/${from_holder}`),
    apiClient.get(`/wallet/balance/${to_address}`),
  ]);

  return {
    from_balance: from_response.extra?.balance || 0,
    to_balance: to_response.extra?.balance || 0,
  };
}
