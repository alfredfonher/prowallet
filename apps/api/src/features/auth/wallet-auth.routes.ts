import {
  Router,
  Request,
  Response,
  NextFunction,
  type Router as ExpressRouter,
} from "express";
import { request_challenge_handler } from "./request-challenge.handler";
import { login_wallet_handler } from "./login-wallet.handler";

const auth_wallet_router: ExpressRouter = Router();

/**
 * POST /api/v1/auth/request-challenge
 * Crea un challenge para que el usuario lo firme
 *
 * Body: { public_key: string }
 * Response: { nonce: string, message: string, expires_at: number }
 */
auth_wallet_router.post(
  "/request-challenge",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await request_challenge_handler(req, res);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/auth/login-wallet
 * Verifica la firma y crea sesión
 *
 * Body: { public_key: string, message: string, signature: string }
 * Response: { token: string, expires_in: string, user: {...} }
 */
auth_wallet_router.post(
  "/login-wallet",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await login_wallet_handler(req, res);
    } catch (error) {
      next(error);
    }
  },
);

export default auth_wallet_router;
