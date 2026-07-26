import { z } from "zod";

/**
 * Validador de dirección Solana
 * Patrón: 32-44 caracteres base58 (excluyendo 0, O, I, l)
 */
const solana_address_regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const solana_address_schema = z
  .string()
  .min(1, "Dirección requerida")
  .refine(
    (addr) => solana_address_regex.test(addr),
    "Dirección Solana inválida",
  );

/**
 * Validación de monto de transferencia
 */
const transfer_amount_schema = z
  .number()
  .positive("El monto debe ser mayor a 0")
  .finite("El monto debe ser un número válido")
  .refine((val) => val >= 0.000000001, "El monto mínimo es 0.000000001 tokens");

/**
 * Esquema para iniciar una transferencia
 */
export const initiate_transfer_schema = z.object({
  from_wallet: solana_address_schema.describe("Dirección de origen"),
  to_wallet: solana_address_schema.describe("Dirección de destino"),
  amount: transfer_amount_schema.describe("Cantidad de tokens"),
});

export type InitiateTransferDTO = z.infer<typeof initiate_transfer_schema>;

/**
 * Esquema para confirmar una transferencia
 */
export const confirm_transfer_schema = z.object({
  signed_transaction: z
    .string()
    .min(1, "Transacción firmada requerida")
    .refine((tx) => {
      try {
        Buffer.from(tx, "base64");
        return true;
      } catch {
        return false;
      }
    }, "Formato de transacción inválido (debe ser base64)")
    .describe("Transacción firmada en base64"),
  from_wallet: solana_address_schema
    .optional()
    .describe("Dirección de origen (para logging)"),
});

export type ConfirmTransferDTO = z.infer<typeof confirm_transfer_schema>;

/**
 * Esquema para agregar una dirección guardada
 */
export const add_saved_address_schema = z.object({
  wallet_address: solana_address_schema.describe("Tu dirección de wallet"),
  recipient_address: solana_address_schema.describe(
    "Dirección del destinatario a guardar",
  ),
  label: z
    .string()
    .min(1, "Etiqueta requerida")
    .max(100, "La etiqueta no puede exceder 100 caracteres")
    .regex(
      /^[a-zA-Z0-9\s\-_.]+$/,
      "Solo se permiten letras, números, espacios y guiones",
    )
    .describe("Nombre/etiqueta para la dirección"),
  description: z
    .string()
    .max(500, "La descripción no puede exceder 500 caracteres")
    .optional()
    .describe("Descripción opcional"),
  is_favorite: z
    .boolean()
    .default(false)
    .optional()
    .describe("Marcar como favorita"),
});

export type AddSavedAddressDTO = z.infer<typeof add_saved_address_schema>;

/**
 * Esquema para actualizar una dirección guardada
 */
export const update_saved_address_schema = z.object({
  label: z
    .string()
    .min(1, "Etiqueta requerida")
    .max(100, "La etiqueta no puede exceder 100 caracteres")
    .regex(
      /^[a-zA-Z0-9\s\-_.]+$/,
      "Solo se permiten letras, números, espacios y guiones",
    )
    .optional()
    .describe("Nuevo nombre/etiqueta"),
  description: z
    .string()
    .max(500, "La descripción no puede exceder 500 caracteres")
    .optional()
    .describe("Nueva descripción"),
  is_favorite: z.boolean().optional().describe("Actualizar estado favorito"),
});

export type UpdateSavedAddressDTO = z.infer<typeof update_saved_address_schema>;

/**
 * Esquema para listar direcciones guardadas (query params)
 */
export const list_saved_addresses_schema = z.object({
  wallet_address: solana_address_schema.describe("Tu dirección de wallet"),
  favorites_only: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Mostrar solo favoritas"),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => val > 0 && val <= 100, "Límite debe estar entre 1-100")
    .describe("Cantidad de registros"),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .refine((val) => val >= 0, "Offset no puede ser negativo")
    .describe("Desplazamiento"),
});

export type ListSavedAddressesDTO = z.infer<typeof list_saved_addresses_schema>;

/**
 * Esquema para eliminar una dirección guardada
 */
export const delete_saved_address_schema = z.object({
  id: z.string().cuid("ID inválido").describe("ID de la dirección guardada"),
  wallet_address: solana_address_schema.describe(
    "Tu dirección de wallet (para validación)",
  ),
});

export type DeleteSavedAddressDTO = z.infer<typeof delete_saved_address_schema>;
