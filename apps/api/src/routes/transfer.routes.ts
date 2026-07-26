import { Router, Request, Response } from "express";
import { StatusFlow, StatusFlowCodes } from "status-flow";
import { transferController } from "../controllers/transfer/transfer.controller";
import { address_book_controller } from "../controllers/transfer/address-book.controller";
import { validateJWT } from "../middleware/jwt";
import {
  TRANSFER_INITIATE_RATE_LIMITER,
  TRANSFER_CONFIRM_RATE_LIMITER,
} from "../middleware/rateLimiter";

const router: Router = Router();

/**
 * @swagger
 * /api/v1/transfer/initiate:
 *   post:
 *     summary: Inicia una transferencia entre carteras whitelisteadas
 *     tags: [Transfers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromWallet
 *               - toWallet
 *               - amount
 *             properties:
 *               fromWallet:
 *                 type: string
 *                 description: Dirección de la cartera origen
 *               toWallet:
 *                 type: string
 *                 description: Dirección de la cartera destino
 *               amount:
 *                 type: number
 *                 description: Cantidad a transferir
 *     responses:
 *       200:
 *         description: Transacción lista para ser firmada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction:
 *                   type: string
 *                   description: Transacción serializada en base64
 */
router.post(
  "/initiate",
  validateJWT,
  TRANSFER_INITIATE_RATE_LIMITER,
  transferController.initiateTransfer,
);

/**
 * @swagger
 * /api/v1/transfer/confirm:
 *   post:
 *     summary: Confirma una transferencia con la transacción firmada
 *     tags: [Transfers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signedTransaction
 *               - fromWallet
 *             properties:
 *               signedTransaction:
 *                 type: string
 *                 description: Transacción firmada en base64
 *               fromWallet:
 *                 type: string
 *                 description: Dirección de la cartera origen (para logging)
 *     responses:
 *       200:
 *         description: Transacción confirmada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transactionId:
 *                   type: string
 */
router.post(
  "/confirm",
  validateJWT,
  TRANSFER_CONFIRM_RATE_LIMITER,
  transferController.confirmTransfer,
);

// ============================================================================
// ADDRESS BOOK ROUTES (Libreta de Direcciones)
// ============================================================================

/**
 * @swagger
 * /api/v1/transfer/address:
 *   post:
 *     summary: Agregar una dirección a la libreta de direcciones
 *     tags: [Address Book]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_address
 *               - recipient_address
 *               - label
 *             properties:
 *               wallet_address:
 *                 type: string
 *                 description: Tu dirección de wallet
 *               recipient_address:
 *                 type: string
 *                 description: Dirección del destinatario a guardar
 *               label:
 *                 type: string
 *                 description: Nombre/etiqueta para la dirección
 *               description:
 *                 type: string
 *                 description: Descripción opcional
 *               is_favorite:
 *                 type: boolean
 *                 description: Marcar como favorita
 *     responses:
 *       201:
 *         description: Dirección guardada exitosamente
 */
router.post("/address", address_book_controller.add_saved_address);

/**
 * @swagger
 * /api/v1/transfer/addresses/{walletAddress}:
 *   get:
 *     summary: Listar direcciones guardadas del usuario
 *     tags: [Address Book]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: favorites_only
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Lista de direcciones guardadas
 */
router.get(
  "/addresses/:walletAddress",
  (req: Request, res: Response, next: any) => {
    // Pasar wallet_address desde param a query para validación
    req.query.wallet_address = req.params.walletAddress;
    next();
  },
  address_book_controller.get_saved_addresses,
);

/**
 * @swagger
 * /api/v1/transfer/address/{id}:
 *   patch:
 *     summary: Actualizar una dirección guardada
 *     tags: [Address Book]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *               description:
 *                 type: string
 *               is_favorite:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Dirección actualizada exitosamente
 */
router.patch("/address/:id", address_book_controller.update_saved_address);

/**
 * @swagger
 * /api/v1/transfer/address/{id}:
 *   delete:
 *     summary: Eliminar una dirección guardada
 *     tags: [Address Book]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_address
 *             properties:
 *               wallet_address:
 *                 type: string
 *                 description: Tu dirección de wallet (para validación)
 *     responses:
 *       200:
 *         description: Dirección eliminada exitosamente
 */
router.delete("/address/:id", address_book_controller.delete_saved_address);

// ============================================================================
// TRANSFER HISTORY ROUTES
// ============================================================================

/**
 * @swagger
 * /api/v1/transfer/history/{walletAddress}:
 *   get:
 *     summary: Obtener historial de transferencias del usuario
 *     tags: [Transfers]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, success, failed]
 *     responses:
 *       200:
 *         description: Historial de transferencias
 */
router.get(
  "/history/:walletAddress",
  validateJWT,
  transferController.getTransferHistory,
);

/**
 * @swagger
 * /api/v1/transfer/{transactionId}:
 *   get:
 *     summary: Obtener detalles de una transacción específica
 *     tags: [Transfers]
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalles de la transacción
 *       404:
 *         description: Transacción no encontrada
 */
router.get(
  "/:transactionId",
  validateJWT,
  transferController.getTransactionDetail,
);

export default router;
