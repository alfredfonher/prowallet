import nodemailer from "nodemailer";

/**
 * Configuración de Nodemailer para envío de emails
 * Soporta múltiples proveedores:
 * - Gmail con App Passwords
 * - Outlook/Hotmail
 * - SMTP personalizado
 * - Mailtrap (desarrollo)
 * - SendGrid (producción)
 */

interface EmailTransporterConfig {
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Obtiene la configuración del transporte según el proveedor
 */
function obtener_config_transporte(): EmailTransporterConfig {
  const provider = process.env.EMAIL_PROVIDER || "gmail";
  const user = process.env.EMAIL_USER || "";
  const pass = process.env.EMAIL_PASSWORD || "";

  if (!user || !pass) {
    throw new Error(
      "EMAIL_USER y EMAIL_PASSWORD deben estar configuradas en .env",
    );
  }

  const configs: Record<string, EmailTransporterConfig> = {
    // Gmail con App Passwords
    gmail: {
      service: "gmail",
      auth: {
        user,
        pass,
      },
    },

    // Outlook / Hotmail
    outlook: {
      service: "outlook",
      auth: {
        user,
        pass,
      },
    },

    // Mailtrap (para desarrollo)
    mailtrap: {
      host: process.env.MAILTRAP_HOST || "live.smtp.mailtrap.io",
      port: parseInt(process.env.MAILTRAP_PORT || "2525"),
      secure: process.env.MAILTRAP_SECURE === "true",
      auth: {
        user,
        pass,
      },
    },

    // SMTP personalizado
    smtp: {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user,
        pass,
      },
    },
  };

  const config = configs[provider];

  if (!config) {
    throw new Error(
      `Proveedor de email no soportado: ${provider}. Usa uno de: ${Object.keys(configs).join(", ")}`,
    );
  }

  return config;
}

/**
 * Crea un transporte de Nodemailer configurado
 */
export function crear_transporte_email() {
  try {
    const config = obtener_config_transporte();
    return nodemailer.createTransport(config);
  } catch (error) {
    console.error("Error configurando transporte de email:", error);
    throw error;
  }
}

/**
 * Verifica que la configuración de email sea válida
 */
export async function verificar_conexion_email(): Promise<boolean> {
  try {
    const transporte = crear_transporte_email();
    await transporte.verify();
    console.log("✅ Conexión de email verificada correctamente");
    return true;
  } catch (error) {
    console.error(
      "❌ Error verificando conexión de email:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Obtiene la información del transporte para logging
 */
export function obtener_info_transporte() {
  const provider = process.env.EMAIL_PROVIDER || "gmail";
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || "";

  return {
    proveedor: provider,
    usuario: process.env.EMAIL_USER,
    desde: from,
    entorno: process.env.NODE_ENV,
  };
}
