import { z } from "zod";
import { PublicKey } from "@solana/web3.js";

// Esquemas de validación Zod para autenticación por wallet
export const wallet_login_request_schema = z.object({
  public_key: z
    .string()
    .min(1, "Public key requerida")
    .refine((pk) => {
      try {
        new PublicKey(pk);
        return true;
      } catch {
        return false;
      }
    }, "Public key inválida para Solana"),
  message: z.string().min(10, "Mensaje debe tener al menos 10 caracteres"),
  signature: z.string().min(10, "Firma debe tener al menos 10 caracteres"),
});

export const request_challenge_schema = z.object({
  public_key: z
    .string()
    .min(1, "Public key requerida")
    .refine((pk) => {
      try {
        new PublicKey(pk);
        return true;
      } catch {
        return false;
      }
    }, "Public key inválida para Solana"),
});

export const wallet_login_response_schema = z.object({
  token: z.string(),
  expires_in: z.string(),
  user: z.object({
    id: z.number(),
    username: z.string(),
    is_admin: z.boolean(),
    created_at: z.string(),
  }),
});

export const challenge_response_schema = z.object({
  nonce: z.string(),
  message: z.string(),
  expires_at: z.number(),
});

// Tipos derivados de los esquemas
export type WalletLoginRequest = z.infer<typeof wallet_login_request_schema>;
export type RequestChallengeInput = z.infer<typeof request_challenge_schema>;
export type WalletLoginResponse = z.infer<typeof wallet_login_response_schema>;
export type ChallengeResponse = z.infer<typeof challenge_response_schema>;
