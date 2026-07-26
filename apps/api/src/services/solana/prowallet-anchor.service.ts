import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

// Cargar el IDL desde el archivo generado por Anchor
const PROWALLET_IDL_PATH = path.resolve(
  __dirname,
  "../../../idl/prowallet_contract.json",
);
const PROWALLET_IDL = JSON.parse(
  fs.readFileSync(PROWALLET_IDL_PATH, "utf8"),
);

export class ProWalletAnchorService {
  private connection: Connection;
  private programId: PublicKey;
  private idl: any;

  constructor(connection: Connection, programId: string) {
    this.connection = connection;
    this.programId = new PublicKey(programId);
    this.idl = PROWALLET_IDL;
  }

  /**
   * Serializa un u64 little-endian en un Buffer de 8 bytes
   */
  private u64ToBufferLE(value: number | bigint) {
    const v = BigInt(Math.floor(Number(value)));
    const buf = Buffer.alloc(8);
    let tmp = v;
    for (let i = 0; i < 8; i++) {
      buf[i] = Number(tmp & 0xffn);
      tmp = tmp >> 8n;
    }
    return buf;
  }

  /**
   * Construye una TransactionInstruction para la instrucción `pay` usando el discriminador del IDL
   * @param payer dirección del comprador
   * @param merchant dirección del merchant/tesorería
   * @param amount cantidad a pagar (u64)
   */
  async buildPayInstruction(payer: string, merchant: string, amount: number) {
    // Buscar la instrucción `pay` en el IDL
    const instr = (this.idl.instructions || []).find(
      (i: any) => i.name === "pay",
    );
    if (!instr) throw new Error("Instruction 'pay' not found in IDL");

    // Discriminador (primeros 8 bytes)
    const discriminator = Buffer.from(instr.discriminator || []);

    // Serializar argumentos: amount como u64 LE
    const amountBuf = this.u64ToBufferLE(amount);

    const data = Buffer.concat([discriminator, amountBuf]);

    // Construir keys según IDL (esperamos payer y merchant en ese orden)
    const keys = [
      {
        pubkey: new PublicKey(payer),
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(merchant),
        isSigner: false,
        isWritable: false,
      },
    ];

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }

  /**
   * Construye una TransactionInstruction para la instrucción `restrictedTransfer` usando el discriminador del IDL
   * @param fromWallet dirección de la wallet origen
   * @param toWallet dirección de la wallet destino
   * @param fromTokenAccount cuenta de token origen
   * @param toTokenAccount cuenta de token destino
   * @param amount cantidad a transferir (u64)
   */
  async buildTransferInstruction(
    fromWallet: string,
    toWallet: string,
    fromTokenAccount: string,
    toTokenAccount: string,
    amount: number,
  ) {
    // Buscar la instrucción `restrictedTransfer` en el IDL
    const instr = (this.idl.instructions || []).find(
      (i: any) => i.name === "restrictedTransfer",
    );
    if (!instr)
      throw new Error("Instruction 'restrictedTransfer' not found in IDL");

    // Discriminador (primeros 8 bytes)
    const discriminator = Buffer.from(instr.discriminator || []);

    // Serializar argumentos: amount como u64 LE
    const amountBuf = this.u64ToBufferLE(amount);

    const data = Buffer.concat([discriminator, amountBuf]);

    // Construir keys según IDL
    const keys = [
      {
        pubkey: new PublicKey(fromWallet),
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: new PublicKey(toWallet),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: new PublicKey(fromTokenAccount),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(toTokenAccount),
        isSigner: false,
        isWritable: true,
      },
    ];

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }
}
