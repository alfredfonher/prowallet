import { Router, Request, Response } from "express";
import { authController } from "../../controllers/auth/AuthController";
import { authChallengeService } from "../../services/auth-challenge.service";
import { validateJWT } from "../../middleware/jwt";
import { validateSolanaAddress } from "../../middleware";
import { login_handler } from "../../controllers/auth/login.handler";
import { register_handler } from "../../controllers/auth/register.handler";
import { forgot_password_handler } from "../../controllers/auth/forgot-password.handler";
import { email_verify_handler } from "../../controllers/auth/email-verify.handler";
import { refresh_token_handler } from "../../controllers/auth/refresh-token.handler";
import { reset_password_handler } from "../../controllers/auth/reset-password.handler";
import {
  limitar_registro,
  limitar_login,
  limitar_recuperar_password,
  limitar_verificar_email,
} from "../../middleware/rate-limiter";

const router: Router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "usuario@ejemplo.com"
 *               password:
 *                 type: string
 *                 example: "contraseña123"
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 */
router.post("/register", limitar_registro, (req: Request, res: Response) => {
  register_handler(req, res);
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login con email y contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "usuario@ejemplo.com"
 *               password:
 *                 type: string
 *                 example: "contraseña123"
 *     responses:
 *       200:
 *         description: Login exitoso, token JWT retornado
 */
router.post("/login", limitar_login, (req: Request, res: Response) => {
  login_handler(req, res);
});

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   get:
 *     summary: Verificar email del usuario
 *     tags: [Auth]
 *     parameters:
 *       - name: token
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verificado exitosamente
 */
router.get(
  "/verify-email",
  limitar_verificar_email,
  (req: Request, res: Response) => {
    email_verify_handler(req, res);
  },
);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Enviar email de recuperación de contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "usuario@ejemplo.com"
 *     responses:
 *       200:
 *         description: Email de recuperación enviado
 */
router.post(
  "/forgot-password",
  limitar_recuperar_password,
  (req: Request, res: Response) => {
    forgot_password_handler(req, res);
  },
);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Resetear contraseña con token de recuperación
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token de recuperación recibido en email
 *               password:
 *                 type: string
 *                 example: "nuevaContraseña123"
 *     responses:
 *       200:
 *         description: Contraseña actualizada exitosamente
 */
router.post("/reset-password", (req: Request, res: Response) => {
  reset_password_handler(req, res);
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refrescar access token usando refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nuevo access token generado
 */
router.post("/refresh", (req: Request, res: Response) => {
  refresh_token_handler(req, res);
});

/**
 * @swagger
 * /api/v1/auth/login-wallet:
 *   post:
 *     summary: Login con firma de wallet Solana
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicKey, message, signature]
 *             properties:
 *               publicKey:
 *                 type: string
 *                 example: "4Nd1m..."
 *               message:
 *                 type: string
 *                 example: "login-nonce-123"
 *               signature:
 *                 type: string
 *                 example: "5K1f..."
 *     responses:
 *       200:
 *         description: Autenticado con wallet y JWT retornado
 */
router.post("/login-wallet", limitar_login, (req: Request, res: Response) => {
  authController.loginWallet(req, res);
});

/**
 * @swagger
 * /api/v1/auth/request-challenge:
 *   post:
 *     summary: Solicitar un challenge para firmar con wallet
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [publicKey]
 *             properties:
 *               publicKey:
 *                 type: string
 *                 example: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD"
 *     responses:
 *       200:
 *         description: Challenge creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     nonce:
 *                       type: string
 *                     message:
 *                       type: string
 */
router.post("/request-challenge", async (req: Request, res: Response) => {
  const { publicKey } = req.body || {};
  if (!publicKey || typeof publicKey !== "string") {
    return res.status(400).json({
      success: false,
      error: "publicKey es requerido",
    });
  }

  try {
    const challenge = await authChallengeService.createChallenge(publicKey);
    return res.json({
      success: true,
      data: {
        message: challenge.message,
        expiresAt: challenge.expiresAt,
      },
    });
  } catch (err) {
    console.error("[AUTH] Error creando challenge:", err);
    return res.status(500).json({
      success: false,
      error: "Error al crear challenge",
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/nonce:
 *   get:
 *     summary: Obtener nonce para firma de wallet
 *     tags: [Auth]
 *     parameters:
 *       - name: wallet
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Nonce obtenido exitosamente
 */
router.get("/nonce", async (req: Request, res: Response) => {
  const publicKey =
    (req.query.wallet as string) || (req.query.publicKey as string);
  if (!publicKey)
    return res.status(400).json({
      success: false,
      error: "Parámetro wallet es requerido",
    });

  try {
    const challenge = await authChallengeService.createChallenge(publicKey);
    return res.json({
      success: true,
      data: {
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Error al crear challenge",
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Obtener usuario actual desde JWT
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario actual
 */
router.get("/me", validateJWT, (req: Request, res: Response) => {
  authController.me(req, res);
});

/**
 * @swagger
 * /api/v1/auth/link-wallet:
 *   post:
 *     summary: Vincular un wallet Solana al usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [solanaPublicKey]
 *             properties:
 *               solanaPublicKey:
 *                 type: string
 *                 example: "4Nd1m..."
 *     responses:
 *       200:
 *         description: Wallet vinculado al usuario
 */
router.post(
  "/link-wallet",
  validateJWT,
  validateSolanaAddress("solanaPublicKey"),
  (req: Request, res: Response) => {
    authController.linkWallet(req, res);
  },
);

/**
 * @swagger
 * /api/v1/auth/unlink-wallet:
 *   delete:
 *     summary: Desvincular wallet del usuario (mantiene sesión activa)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet desvinculada correctamente, sesión mantiene
 */
router.delete("/unlink-wallet", validateJWT, (req: Request, res: Response) => {
  authController.unlink_wallet(req, res);
});

/**
 * @swagger
 * /api/v1/auth/verify:
 *   get:
 *     summary: Verificar token JWT
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token es válido
 *       401:
 *         description: Token es inválido o expirado
 */
router.get("/verify", validateJWT, (req: Request, res: Response) => {
  authController.verify(req, res);
});

export default router;
