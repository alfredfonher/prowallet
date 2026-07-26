"use client";

import { useState, useCallback, useEffect } from "react";
import {
  SavedAddress,
  AddressBookResponse,
  fetch_saved_addresses,
  add_saved_address,
  update_saved_address,
  delete_saved_address,
} from "@/lib/address-book-api";

interface UseAddressBookOptions {
  wallet_address?: string;
  auto_load?: boolean;
  limit?: number;
  offset?: number;
}

export function use_address_book(options: UseAddressBookOptions = {}) {
  const {
    wallet_address,
    auto_load = false,
    limit = 50,
    offset: initial_offset = 0,
  } = options;

  const [addresses, set_addresses] = useState<SavedAddress[]>([]);
  const [total_count, set_total_count] = useState(0);
  const [is_loading, set_is_loading] = useState(false);
  const [is_error, set_is_error] = useState(false);
  const [error_message, set_error_message] = useState("");
  const [offset, set_offset] = useState(initial_offset);

  const load_addresses = useCallback(
    async (filters_offset: number = offset) => {
      if (!wallet_address) {
        set_is_error(true);
        set_error_message("Dirección de wallet requerida");
        return;
      }

      set_is_loading(true);
      set_is_error(false);

      const result = await fetch_saved_addresses(wallet_address, {
        limit,
        offset: filters_offset,
      });

      set_addresses(result.data);
      set_total_count(result.total);
      set_offset(filters_offset);
      set_is_loading(false);
    },
    [wallet_address, limit, offset],
  );

  const add_address = useCallback(
    async (
      recipient_address: string,
      label: string,
      description?: string,
      is_favorite?: boolean,
    ) => {
      if (!wallet_address) {
        set_is_error(true);
        set_error_message("Dirección de wallet requerida");
        return { success: false };
      }

      set_is_loading(true);
      const result = await add_saved_address(
        wallet_address,
        recipient_address,
        label,
        description,
        is_favorite,
      );

      if (result.success && result.data) {
        set_addresses((prev) => [result.data, ...prev]);
        set_total_count((prev) => prev + 1);
      } else {
        set_is_error(true);
        set_error_message(result.error || "Error al agregar dirección");
      }

      set_is_loading(false);
      return result;
    },
    [wallet_address],
  );

  const update_address = useCallback(
    async (
      address_id: string,
      updates: Partial<{
        label: string;
        description: string;
        is_favorite: boolean;
      }>,
    ) => {
      if (!wallet_address) {
        set_is_error(true);
        set_error_message("Dirección de wallet requerida");
        return { success: false };
      }

      set_is_loading(true);
      const result = await update_saved_address(
        address_id,
        wallet_address,
        updates,
      );

      if (result.success && result.data) {
        set_addresses((prev) =>
          prev.map((addr) => (addr.id === address_id ? result.data : addr)),
        );
      } else {
        set_is_error(true);
        set_error_message(result.error || "Error al actualizar dirección");
      }

      set_is_loading(false);
      return result;
    },
    [wallet_address],
  );

  const delete_address = useCallback(
    async (address_id: string) => {
      if (!wallet_address) {
        set_is_error(true);
        set_error_message("Dirección de wallet requerida");
        return { success: false };
      }

      set_is_loading(true);
      const result = await delete_saved_address(address_id, wallet_address);

      if (result.success) {
        set_addresses((prev) => prev.filter((addr) => addr.id !== address_id));
        set_total_count((prev) => prev - 1);
      } else {
        set_is_error(true);
        set_error_message(result.error || "Error al eliminar dirección");
      }

      set_is_loading(false);
      return result;
    },
    [wallet_address],
  );

  const clear_error = useCallback(() => {
    set_is_error(false);
    set_error_message("");
  }, []);

  const has_next_page = offset + limit < total_count;
  const has_prev_page = offset > 0;

  // Auto-load inicial
  useEffect(() => {
    if (auto_load && wallet_address) {
      load_addresses(0);
    }
  }, [auto_load, wallet_address, load_addresses]);

  // Refresh automático cada 30 segundos
  useEffect(() => {
    if (!wallet_address) return;

    const refresh_interval = setInterval(() => {
      load_addresses(offset);
    }, 30000); // 30 segundos

    return () => clearInterval(refresh_interval);
  }, [wallet_address, offset, load_addresses]);

  return {
    addresses,
    total_count,
    is_loading,
    is_error,
    error_message,
    offset,
    limit,
    has_next_page,
    has_prev_page,
    load_addresses,
    add_address,
    update_address,
    delete_address,
    clear_error,
  };
}
