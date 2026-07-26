import { z } from "zod";

// Esquemas Zod para validación de respuestas del API

export const challenge_response_schema = z.object({
  data: z.object({
    nonce: z.string().optional(),
    message: z.string().optional(),
    expires_at: z.number().optional(),
  }),
  success: z.boolean(),
});

export const wallet_login_response_schema = z.object({
  data: z.object({
    token: z.string(),
    expires_in: z.string(),
    user: z.object({
      id: z.number(),
      username: z.string(),
      is_admin: z.boolean(),
      created_at: z.string(),
    }),
  }),
  success: z.boolean(),
});

export type ChallengeResponse = z.infer<typeof challenge_response_schema>;
export type WalletLoginResponse = z.infer<typeof wallet_login_response_schema>;
export type AuthUser = z.infer<
  typeof wallet_login_response_schema
>["data"]["user"];
