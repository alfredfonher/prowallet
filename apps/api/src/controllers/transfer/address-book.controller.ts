import { Request, Response } from "express";
import { loggerService } from "../../services/logging/logger.service";
import { catchAsync } from "../../utils/catchAsync";
import { databaseService } from "../../services/database/database.service";
import {
  add_saved_address_schema,
  update_saved_address_schema,
  list_saved_addresses_schema,
  delete_saved_address_schema,
} from "../../validations/transfer.validations";
import { ZodError } from "zod";

export class AddressBookController {
  private prisma = databaseService.getClient();

  /**
   * Agregar una dirección a la libreta de direcciones
   */
  add_saved_address = catchAsync(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;

    // Validar con Zod
    const validation_result = add_saved_address_schema.safeParse(req.body);
    if (!validation_result.success) {
      loggerService.logError(new Error("Validation failed"), {
        requestId,
        context: "add_saved_address",
        errors: validation_result.error.errors,
      });

      return res.status(400).json({
        success: false,
        message: "Validación fallida",
        errors: validation_result.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    const {
      wallet_address,
      recipient_address,
      label,
      description,
      is_favorite,
    } = validation_result.data;

    // Validar que no sea la misma dirección
    if (wallet_address.toLowerCase() === recipient_address.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "No puedes guardar tu propia dirección en la libreta",
      });
    }

    try {
      // Verificar si ya existe
      const existing = await this.prisma.savedAddress.findUnique({
        where: {
          wallet_address_recipient_address: {
            wallet_address,
            recipient_address,
          },
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Esta dirección ya está guardada en tu libreta",
          id: existing.id,
        });
      }

      // Crear dirección guardada
      const saved_address = await this.prisma.savedAddress.create({
        data: {
          wallet_address,
          recipient_address,
          label,
          description: description || null,
          is_favorite: is_favorite || false,
        },
      });

      loggerService.logInfo("✅ Dirección guardada exitosamente", {
        requestId,
        wallet_address,
        recipient_address,
        saved_address_id: saved_address.id,
      });

      return res.status(201).json({
        success: true,
        message: "Dirección guardada exitosamente",
        data: saved_address,
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        requestId,
        context: "add_saved_address",
        wallet_address,
        recipient_address,
      });

      return res.status(500).json({
        success: false,
        message: "Error al guardar la dirección",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Listar direcciones guardadas del usuario
   */
  get_saved_addresses = catchAsync(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;

    // Validar query params
    const validation_result = list_saved_addresses_schema.safeParse(req.query);
    if (!validation_result.success) {
      loggerService.logError(new Error("Query validation failed"), {
        requestId,
        context: "get_saved_addresses",
        errors: validation_result.error.errors,
      });

      return res.status(400).json({
        success: false,
        message: "Parámetros inválidos",
        errors: validation_result.error.errors,
      });
    }

    const { wallet_address, favorites_only, limit, offset } =
      validation_result.data;

    try {
      // Construir filtro
      const where: any = { wallet_address };
      if (favorites_only) {
        where.is_favorite = true;
      }

      // Obtener total
      const total = await this.prisma.savedAddress.count({ where });

      // Obtener registros con paginación
      const addresses = await this.prisma.savedAddress.findMany({
        where,
        orderBy: [{ is_favorite: "desc" }, { created_at: "desc" }],
        take: limit,
        skip: offset,
      });

      loggerService.logInfo("✅ Direcciones listadas", {
        requestId,
        wallet_address,
        total,
        returned: addresses.length,
        favorites_only,
      });

      return res.json({
        success: true,
        message: "Direcciones obtenidas exitosamente",
        data: {
          addresses,
          pagination: {
            total,
            limit,
            offset,
            returned: addresses.length,
          },
        },
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        requestId,
        context: "get_saved_addresses",
        wallet_address,
      });

      return res.status(500).json({
        success: false,
        message: "Error al obtener direcciones",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Actualizar una dirección guardada
   */
  update_saved_address = catchAsync(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;
    const { id } = req.params;

    // Validar data
    const validation_result = update_saved_address_schema.safeParse(req.body);
    if (!validation_result.success) {
      return res.status(400).json({
        success: false,
        message: "Validación fallida",
        errors: validation_result.error.errors,
      });
    }

    try {
      // Verificar que existe
      const existing = await this.prisma.savedAddress.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Dirección no encontrada",
        });
      }

      // Actualizar
      const updated = await this.prisma.savedAddress.update({
        where: { id },
        data: validation_result.data,
      });

      loggerService.logInfo("✅ Dirección actualizada", {
        requestId,
        id,
        wallet_address: existing.wallet_address,
      });

      return res.json({
        success: true,
        message: "Dirección actualizada exitosamente",
        data: updated,
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        requestId,
        context: "update_saved_address",
        id,
      });

      return res.status(500).json({
        success: false,
        message: "Error al actualizar la dirección",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Eliminar una dirección guardada
   */
  delete_saved_address = catchAsync(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;

    // Validar
    const validation_result = delete_saved_address_schema.safeParse({
      id: req.params.id,
      wallet_address: req.body.wallet_address,
    });

    if (!validation_result.success) {
      return res.status(400).json({
        success: false,
        message: "Validación fallida",
        errors: validation_result.error.errors,
      });
    }

    const { id, wallet_address } = validation_result.data;

    try {
      // Verificar que existe y pertenece al usuario
      const existing = await this.prisma.savedAddress.findFirst({
        where: {
          id,
          wallet_address,
        },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Dirección no encontrada o no tienes permiso para eliminarla",
        });
      }

      // Eliminar
      await this.prisma.savedAddress.delete({ where: { id } });

      loggerService.logInfo("✅ Dirección eliminada", {
        requestId,
        id,
        wallet_address,
        recipient_address: existing.recipient_address,
      });

      return res.json({
        success: true,
        message: "Dirección eliminada exitosamente",
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        requestId,
        context: "delete_saved_address",
        id,
        wallet_address,
      });

      return res.status(500).json({
        success: false,
        message: "Error al eliminar la dirección",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

export const address_book_controller = new AddressBookController();
