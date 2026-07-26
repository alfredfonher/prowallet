import { apiClient } from "@/lib/api-client";

export interface SavedAddress {
  id: string;
  wallet_address: string;
  recipient_address: string;
  label: string;
  description?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressBookResponse {
  data: SavedAddress[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetch_saved_addresses(
  wallet_address: string,
  options?: { favorites_only?: boolean; limit?: number; offset?: number },
): Promise<AddressBookResponse> {
  try {
    const params = new URLSearchParams();
    if (options?.favorites_only) params.append("favorites_only", "true");
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());

    const query_string = params.toString();
    const url = `/transfer/addresses/${wallet_address}${query_string ? `?${query_string}` : ""}`;

    const response = await apiClient.get(url);

    if (!response.success || !response.extra?.data) {
      return { data: [], total: 0, limit: 50, offset: 0 };
    }

    return response.extra;
  } catch (error) {
    console.error("Error fetching saved addresses:", error);
    return { data: [], total: 0, limit: 50, offset: 0 };
  }
}

export async function add_saved_address(
  wallet_address: string,
  recipient_address: string,
  label: string,
  description?: string,
  is_favorite?: boolean,
): Promise<{ success: boolean; data?: SavedAddress; error?: string }> {
  try {
    const response = await apiClient.post("/transfer/address", {
      wallet_address,
      recipient_address,
      label,
      description,
      is_favorite: is_favorite ?? false,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.extra?.message || "Error al agregar dirección",
      };
    }

    return { success: true, data: response.extra?.data };
  } catch (error: any) {
    const error_message =
      error?.response?.extra?.message || "Error al agregar dirección";
    return { success: false, error: error_message };
  }
}

export async function update_saved_address(
  address_id: string,
  wallet_address: string,
  updates: Partial<{
    label: string;
    description: string;
    is_favorite: boolean;
  }>,
): Promise<{ success: boolean; data?: SavedAddress; error?: string }> {
  try {
    const response = await apiClient.patch(`/transfer/address/${address_id}`, {
      wallet_address,
      ...updates,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.extra?.message || "Error al actualizar dirección",
      };
    }

    return { success: true, data: response.extra?.data };
  } catch (error: any) {
    const error_message =
      error?.response?.extra?.message || "Error al actualizar dirección";
    return { success: false, error: error_message };
  }
}

export async function delete_saved_address(
  address_id: string,
  wallet_address: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await apiClient.delete(
      `/transfer/address/${address_id}?wallet_address=${wallet_address}`,
    );

    if (!response.success) {
      return {
        success: false,
        error: response.extra?.message || "Error al eliminar dirección",
      };
    }

    return { success: true };
  } catch (error: any) {
    const error_message =
      error?.response?.extra?.message || "Error al eliminar dirección";
    return { success: false, error: error_message };
  }
}
