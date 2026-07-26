import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { use_address_book } from "@/hooks/use-address-book";
import * as addressBookApi from "@/lib/address-book-api";

vi.mock("@/lib/address-book-api", () => ({
  fetch_saved_addresses: vi.fn(),
  add_saved_address: vi.fn(),
  update_saved_address: vi.fn(),
  delete_saved_address: vi.fn(),
}));

describe("use_address_book hook", () => {
  const mock_wallet = "11111111111111111111111111111112";
  const mock_addresses = [
    {
      id: "1",
      wallet_address: mock_wallet,
      recipient_address: "22222222222222222222222222222223",
      label: "Trading Account",
      description: "My trading account",
      is_favorite: true,
      created_at: "2024-12-16T00:00:00Z",
      updated_at: "2024-12-16T00:00:00Z",
    },
    {
      id: "2",
      wallet_address: mock_wallet,
      recipient_address: "33333333333333333333333333333334",
      label: "Savings",
      description: null,
      is_favorite: false,
      created_at: "2024-12-16T00:00:00Z",
      updated_at: "2024-12-16T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with empty state", () => {
    const { result } = renderHook(() =>
      use_address_book({ wallet_address: mock_wallet }),
    );

    expect(result.current.addresses).toEqual([]);
    expect(result.current.total_count).toBe(0);
    expect(result.current.is_loading).toBe(false);
    expect(result.current.is_error).toBe(false);
  });

  it("should load addresses when auto_load is true", async () => {
    vi.mocked(addressBookApi.fetch_saved_addresses).mockResolvedValueOnce({
      data: mock_addresses,
      total: 2,
      limit: 50,
      offset: 0,
    });

    const { result } = renderHook(() =>
      use_address_book({ wallet_address: mock_wallet, auto_load: true }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.addresses).toEqual(mock_addresses);
    expect(result.current.total_count).toBe(2);
  });

  it("should add a new address", async () => {
    const new_address = {
      id: "3",
      wallet_address: mock_wallet,
      recipient_address: "44444444444444444444444444444445",
      label: "New Account",
      description: null,
      is_favorite: false,
      created_at: "2024-12-16T00:00:00Z",
      updated_at: "2024-12-16T00:00:00Z",
    };

    vi.mocked(addressBookApi.add_saved_address).mockResolvedValueOnce({
      success: true,
      data: new_address,
    });

    const { result } = renderHook(() =>
      use_address_book({ wallet_address: mock_wallet }),
    );

    await act(async () => {
      await result.current.add_address(
        "44444444444444444444444444444445",
        "New Account",
      );
    });

    expect(result.current.addresses).toContainEqual(new_address);
    expect(result.current.total_count).toBe(1);
  });

  it("should update an address", async () => {
    vi.mocked(addressBookApi.fetch_saved_addresses).mockResolvedValueOnce({
      data: mock_addresses,
      total: 2,
      limit: 50,
      offset: 0,
    });

    const updated_address = {
      ...mock_addresses[0],
      label: "Updated Trading",
    };

    vi.mocked(addressBookApi.update_saved_address).mockResolvedValueOnce({
      success: true,
      data: updated_address,
    });

    const { result } = renderHook(() =>
      use_address_book({ wallet_address: mock_wallet, auto_load: true }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    await act(async () => {
      await result.current.update_address("1", {
        label: "Updated Trading",
      });
    });

    expect(result.current.addresses[0].label).toBe("Updated Trading");
  });

  it("should delete an address", async () => {
    vi.mocked(addressBookApi.fetch_saved_addresses).mockResolvedValueOnce({
      data: mock_addresses,
      total: 2,
      limit: 50,
      offset: 0,
    });

    vi.mocked(addressBookApi.delete_saved_address).mockResolvedValueOnce({
      success: true,
    });

    const { result } = renderHook(() =>
      use_address_book({ wallet_address: mock_wallet, auto_load: true }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    await act(async () => {
      await result.current.delete_address("1");
    });

    expect(result.current.addresses).not.toContainEqual(mock_addresses[0]);
    expect(result.current.total_count).toBe(1);
  });

  it("should handle errors gracefully", async () => {
    vi.mocked(addressBookApi.add_saved_address).mockResolvedValueOnce({
      success: false,
      error: "Error al agregar dirección",
    });

    const { result } = renderHook(() =>
      use_address_book({ wallet_address: mock_wallet }),
    );

    await act(async () => {
      await result.current.add_address("invalid", "Test");
    });

    expect(result.current.is_error).toBe(true);
    expect(result.current.error_message).toBe("Error al agregar dirección");
  });

  it("should return false for missing wallet_address", async () => {
    const { result } = renderHook(() =>
      use_address_book({ wallet_address: undefined }),
    );

    await act(async () => {
      const add_result = await result.current.add_address(
        "11111111111111111111111111111112",
        "Test",
      );
      expect(add_result.success).toBe(false);
    });
  });

  it("should manage pagination correctly", () => {
    const { result } = renderHook(() =>
      use_address_book({
        wallet_address: mock_wallet,
        limit: 10,
        offset: 0,
      }),
    );

    expect(result.current.limit).toBe(10);
    expect(result.current.offset).toBe(0);
    expect(result.current.has_next_page).toBe(false);
    expect(result.current.has_prev_page).toBe(false);
  });

  it("should clear error messages", async () => {
    const { result } = renderHook(() =>
      use_address_book({ wallet_address: mock_wallet }),
    );

    vi.mocked(addressBookApi.add_saved_address).mockResolvedValueOnce({
      success: false,
      error: "Test error",
    });

    await act(async () => {
      await result.current.add_address("invalid", "Test");
    });

    expect(result.current.is_error).toBe(true);

    act(() => {
      result.current.clear_error();
    });

    expect(result.current.is_error).toBe(false);
    expect(result.current.error_message).toBe("");
  });
});
