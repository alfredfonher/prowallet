import { databaseService } from "../../services/database/database.service";
import { loggerService } from "../../services/logging/logger.service";

export interface GetOrCreateUserInput {
  public_key: string;
}

export interface GetOrCreateUserResult {
  id: number;
  email: string;
  solanaPublicKey: string | null;
  is_admin: boolean;
  created_at: string;
}

/**
 * Obtiene un usuario existente o crea uno nuevo basado en su wallet
 * Implementa: creación automática de usuario por solanaPublicKey
 */
export const get_or_create_user = async (
  input: GetOrCreateUserInput,
): Promise<GetOrCreateUserResult> => {
  const prisma = databaseService.getClient();
  const admin_list = (process.env.ADMIN_USERS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  try {
    // Buscar usuario existente por solanaPublicKey
    let user = await prisma.user.findUnique({
      where: { solanaPublicKey: input.public_key },
    });

    // Si no existe, crear uno nuevo
    if (!user) {
      const short_key = input.public_key.substring(0, 8);
      const email = `wallet-${short_key}@prowallet.local`;

      user = await prisma.user.create({
        data: {
          email,
          solanaPublicKey: input.public_key,
          tokenBalance: BigInt(0),
          usdSpent: 0,
        },
      });

      loggerService.logInfo("Usuario creado automáticamente por wallet", {
        context: "get_or_create_user",
        user_id: user.id,
        email: user.email,
        public_key: input.public_key.substring(0, 8) + "...",
      });
    }

    const is_admin = admin_list.includes(user.email);

    return {
      id: user.id,
      email: user.email,
      solanaPublicKey: user.solanaPublicKey,
      is_admin,
      created_at: user.createdAt.toISOString(),
    };
  } catch (error) {
    loggerService.logError(error as Error, {
      context: "get_or_create_user",
      public_key: input.public_key.substring(0, 8) + "...",
    });
    throw error;
  }
};
