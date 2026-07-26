import { describe, it, expect, vi } from "vitest";
import { Keypair, Connection, PublicKey, Transaction } from "@solana/web3.js";

// Create a factory function for Transaction instances to avoid shared state
function create_mock_transaction() {
  return {
    instructions: [],
    recentBlockhash: "",
    feePayer: null,
    add: function (instruction: any) {
      this.instructions.push(instruction);
      return this;
    },
    serialize: vi.fn(),
    sign: vi.fn(),
    verifySignatures: vi.fn(),
  };
}

vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js");
  return {
    ...actual,
    Transaction: vi.fn().mockImplementation(() => create_mock_transaction()),
  };
});

vi.mock("@solana/spl-token", () => ({
  getAssociatedTokenAddress: vi.fn(),
  createTransferInstruction: vi.fn(),
  TOKEN_PROGRAM_ID: new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  ),
}));

import {
  getAssociatedTokenAddress,
  createTransferInstruction,
} from "@solana/spl-token";
import build_p2p_token_transaction from "../transfer-p2p.service";

describe("build_p2p_token_transaction", () => {
  beforeEach(() => {
    // Clear mock history before each test
    vi.clearAllMocks();
  });

  it("builds a transfer tx with feePayer and instruction", async () => {
    // Generar claves válidas para el test
    const fromKeypair = Keypair.generate();
    const toKeypair = Keypair.generate();
    const mintKeypair = Keypair.generate();

    const mint = mintKeypair.publicKey;
    const from = fromKeypair.publicKey;
    const to = toKeypair.publicKey;

    // Mock ATAs - using valid base58 addresses
    const mockFromAta = new PublicKey("11111111111111111111111111111112");
    const mockToAta = new PublicKey("11111111111111111111111111111113");

    // Mock getAssociatedTokenAddress calls
    const mockGetAssociatedTokenAddress = getAssociatedTokenAddress as any;
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockFromAta);
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockToAta);

    // Mock createTransferInstruction
    const mockCreateTransferInstruction = createTransferInstruction as any;
    mockCreateTransferInstruction.mockReturnValue({
      keys: [
        { pubkey: mockFromAta, isSigner: false, isWritable: true },
        { pubkey: mockToAta, isSigner: false, isWritable: true },
        { pubkey: from, isSigner: true, isWritable: false },
      ],
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      data: Buffer.from("mock-transfer-data"),
    });

    const recentBlockhash = "test-blockhash-123";

    const connection = {} as Connection; // not used by function

    const tx = await build_p2p_token_transaction({
      connection,
      mint_pubkey: mint.toString(),
      from_pubkey: from.toString(),
      to_pubkey: to.toString(),
      amount_tokens: 1.5,
      decimals: 9,
      recent_blockhash: recentBlockhash,
    });

    expect(tx).toBeDefined();
    expect(tx.recentBlockhash).toBe(recentBlockhash);
    expect(tx.feePayer?.toString()).toBe(from.toString());
    expect(tx.instructions).toBeDefined();
    expect(tx.instructions.length).toBe(1);

    const ix = tx.instructions[0];
    // Primer key debe ser source ATA
    expect(ix.keys[0].pubkey.toString()).toBe(mockFromAta.toString());
    // Segundo key debe ser destination ATA
    expect(ix.keys[1].pubkey.toString()).toBe(mockToAta.toString());
    // Tercer key debe ser el signer (from)
    expect(ix.keys[2].pubkey.toString()).toBe(from.toString());
  });

  it("converts amount_tokens to raw amount with correct decimals", async () => {
    const fromKeypair = Keypair.generate();
    const toKeypair = Keypair.generate();
    const mintKeypair = Keypair.generate();

    const mockFromAta = new PublicKey("11111111111111111111111111111112");
    const mockToAta = new PublicKey("11111111111111111111111111111113");

    const mockGetAssociatedTokenAddress = getAssociatedTokenAddress as any;
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockFromAta);
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockToAta);

    const mockCreateTransferInstruction = createTransferInstruction as any;
    const instructionMock = vi.fn();
    mockCreateTransferInstruction.mockReturnValue(instructionMock);

    const tx = await build_p2p_token_transaction({
      connection: {} as any,
      mint_pubkey: mintKeypair.publicKey.toString(),
      from_pubkey: fromKeypair.publicKey.toString(),
      to_pubkey: toKeypair.publicKey.toString(),
      amount_tokens: 1.5,
      decimals: 9,
      recent_blockhash: "test-blockhash",
    });

    // Verify that createTransferInstruction was called with correct raw amount
    expect(mockCreateTransferInstruction).toHaveBeenCalledWith(
      mockFromAta,
      mockToAta,
      fromKeypair.publicKey,
      BigInt(1500000000), // 1.5 * 10^9
    );
  });

  it("handles different decimal places correctly", async () => {
    const fromKeypair = Keypair.generate();
    const toKeypair = Keypair.generate();
    const mintKeypair = Keypair.generate();

    const mockFromAta = new PublicKey("11111111111111111111111111111112");
    const mockToAta = new PublicKey("11111111111111111111111111111113");

    const mockGetAssociatedTokenAddress = getAssociatedTokenAddress as any;
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockFromAta);
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockToAta);

    const mockCreateTransferInstruction = createTransferInstruction as any;
    const instructionMock = vi.fn();
    mockCreateTransferInstruction.mockReturnValue(instructionMock);

    await build_p2p_token_transaction({
      connection: {} as any,
      mint_pubkey: mintKeypair.publicKey.toString(),
      from_pubkey: fromKeypair.publicKey.toString(),
      to_pubkey: toKeypair.publicKey.toString(),
      amount_tokens: 0.123456,
      decimals: 6,
      recent_blockhash: "test-blockhash",
    });

    // Verify that createTransferInstruction was called with correct raw amount
    expect(mockCreateTransferInstruction).toHaveBeenCalledWith(
      mockFromAta,
      mockToAta,
      fromKeypair.publicKey,
      BigInt(123456), // 0.123456 * 10^6
    );
  });

  it("handles PublicKey objects directly", async () => {
    const fromKeypair = Keypair.generate();
    const toKeypair = Keypair.generate();
    const mintKeypair = Keypair.generate();

    const mockFromAta = new PublicKey("11111111111111111111111111111112");
    const mockToAta = new PublicKey("11111111111111111111111111111113");

    const mockGetAssociatedTokenAddress = getAssociatedTokenAddress as any;
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockFromAta);
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockToAta);

    const mockCreateTransferInstruction = createTransferInstruction as any;
    const instructionMock = vi.fn();
    mockCreateTransferInstruction.mockReturnValue(instructionMock);

    const tx = await build_p2p_token_transaction({
      connection: {} as any,
      mint_pubkey: mintKeypair.publicKey, // Direct PublicKey object
      from_pubkey: fromKeypair.publicKey, // Direct PublicKey object
      to_pubkey: toKeypair.publicKey, // Direct PublicKey object
      amount_tokens: 1.0,
      decimals: 0,
      recent_blockhash: "test-blockhash",
    });

    expect(tx.feePayer?.toString()).toBe(fromKeypair.publicKey.toString());
    expect(mockCreateTransferInstruction).toHaveBeenCalledWith(
      mockFromAta,
      mockToAta,
      fromKeypair.publicKey,
      BigInt(1), // 1.0 * 10^0
    );
  });

  it("floors the amount to prevent fractional tokens", async () => {
    const fromKeypair = Keypair.generate();
    const toKeypair = Keypair.generate();
    const mintKeypair = Keypair.generate();

    const mockFromAta = new PublicKey("11111111111111111111111111111112");
    const mockToAta = new PublicKey("11111111111111111111111111111113");

    const mockGetAssociatedTokenAddress = getAssociatedTokenAddress as any;
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockFromAta);
    mockGetAssociatedTokenAddress.mockResolvedValueOnce(mockToAta);

    const mockCreateTransferInstruction = createTransferInstruction as any;
    const instructionMock = vi.fn();
    mockCreateTransferInstruction.mockReturnValue(instructionMock);

    // 1.5555 with 4 decimals should be floored to 15555
    await build_p2p_token_transaction({
      connection: {} as any,
      mint_pubkey: mintKeypair.publicKey.toString(),
      from_pubkey: fromKeypair.publicKey.toString(),
      to_pubkey: toKeypair.publicKey.toString(),
      amount_tokens: 1.5555,
      decimals: 4,
      recent_blockhash: "test-blockhash",
    });

    expect(mockCreateTransferInstruction).toHaveBeenCalledWith(
      mockFromAta,
      mockToAta,
      fromKeypair.publicKey,
      BigInt(15555), // 1.5555 * 10^4 = 15555
    );
  });
});
