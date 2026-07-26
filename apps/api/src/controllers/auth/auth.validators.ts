import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { PasswordService } from "../../services/auth/password.service";

/**
 * Valida el formato del email
 * Requiere: formato de email válido (algo@algo.com)
 */
function validar_email(email: string): boolean {
  if (!email || email.trim().length === 0) return false;

  const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email_regex.test(email.trim());
}

/**
 * Valida el formato del password según las reglas de seguridad
 * Requisitos:
 * - Mínimo 8 caracteres
 * - Al menos 1 mayúscula (A-Z)
 * - Al menos 1 minúscula (a-z)
 * - Al menos 1 número (0-9)
 * - Al menos 1 símbolo (@$!%*?&)
 * - No puede contener espacios
 */
function validar_password(password: string): boolean {
  if (!password) return false;

  const validation = PasswordService.validate_password(password);
  return validation.is_valid;
}

/**
 * Obtiene los errores de validación del password
 * Retorna un array de strings con los errores
 */
function obtener_errores_password(password: string): string[] {
  const validation = PasswordService.validate_password(password);
  return validation.errors;
}

/**
 * Busca un usuario por email en la base de datos
 */
async function buscar_usuario_por_email(
  prisma: PrismaClient,
  email: string,
): Promise<any | null> {
  return await prisma.user.findUnique({ where: { email } });
}

/**
 * Verifica que el password proporcionado coincide con el hash almacenado
 */
async function verificar_password(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Determina si el usuario es administrador basado en la lista de admins
 */
function es_admin(email: string): boolean {
  const admin_list = (process.env.ADMIN_USERS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return admin_list.includes(email);
}

/**
 * Genera un mensaje de error amigable que no revela si el usuario existe
 */
function obtener_error_credenciales(): string {
  return "Usuario o password incorrectos";
}

export {
  validar_email,
  validar_password,
  obtener_errores_password,
  buscar_usuario_por_email,
  verificar_password,
  es_admin,
  obtener_error_credenciales,
};
