import { loggerService } from "../logging/logger.service";
import { crear_transporte_email } from "./nodemailer.config";

/**
 * Servicio de Email - Maneja envío de verificación y recuperación de contraseña
 * Integrado con Nodemailer para soporte de múltiples proveedores
 */

interface OpcionesEmail {
  para: string;
  asunto: string;
  html: string;
  texto?: string;
}

export class EmailService {
  /**
   * Envía un email de verificación con un enlace clickeable
   * El token debe estar en formato seguro (hexadecimal)
   */
  static async enviar_email_verificacion(
    email: string,
    token_verificacion: string,
    url_base_frontend: string = process.env.FRONTEND_BASE_URL ||
      "http://localhost:3000",
  ): Promise<boolean> {
    try {
      const enlace_verificacion = `${url_base_frontend}/auth/verificar-email?token=${token_verificacion}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #333; margin-bottom: 20px;">¡Bienvenido a ProWallet!</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Haz clic en el siguiente enlace para verificar tu email:
            </p>
            <a href="${enlace_verificacion}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">
              Verificar Email
            </a>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              O copia y pega este enlace en tu navegador:<br/>
              <code style="background-color: #f0f0f0; padding: 10px; display: block; margin-top: 10px; word-break: break-all;">
                ${enlace_verificacion}
              </code>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              Este enlace expira en 24 horas.
            </p>
          </div>
        </div>
      `;

      const texto = `
        Verifica tu email en ProWallet
        
        Haz clic aquí: ${enlace_verificacion}
        
        O copia este enlace: ${enlace_verificacion}
        
        Este enlace expira en 24 horas.
      `;

      return await this.enviar_email({
        para: email,
        asunto: "Verifica tu email - ProWallet",
        html,
        texto,
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        contexto: "enviar_email_verificacion",
        email,
      });
      return false;
    }
  }

  /**
   * Envía un email de recuperación de contraseña con un enlace
   * El token debe estar en formato seguro (hexadecimal)
   */
  static async enviar_email_recuperar_password(
    email: string,
    token_reset: string,
    url_base_frontend: string = process.env.FRONTEND_BASE_URL ||
      "http://localhost:3000",
  ): Promise<boolean> {
    try {
      const enlace_reset = `${url_base_frontend}/auth/recuperar-password?token=${token_reset}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #333; margin-bottom: 20px;">Recuperar contraseña - ProWallet</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Haz clic en el siguiente enlace para resetear tu contraseña:
            </p>
            <a href="${enlace_reset}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">
              Resetear Contraseña
            </a>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              O copia y pega este enlace en tu navegador:<br/>
              <code style="background-color: #f0f0f0; padding: 10px; display: block; margin-top: 10px; word-break: break-all;">
                ${enlace_reset}
              </code>
            </p>
            <p style="color: #666; font-size: 14px; font-weight: bold; margin-top: 20px;">
              ⚠️ Este enlace expira en 2 horas.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
              Si no solicitaste este recupero, puedes ignorar este email.
            </p>
          </div>
        </div>
      `;

      const texto = `
        Recuperar contraseña - ProWallet
        
        Haz clic aquí: ${enlace_reset}
        
        O copia este enlace: ${enlace_reset}
        
        Este enlace expira en 2 horas.
        
        Si no solicitaste esto, ignora este email.
      `;

      return await this.enviar_email({
        para: email,
        asunto: "Recuperar contraseña - ProWallet",
        html,
        texto,
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        contexto: "enviar_email_recuperar_password",
        email,
      });
      return false;
    }
  }

  /**
   * Envía un email de bienvenida al nuevo usuario
   */
  static async enviar_email_bienvenida(
    email: string,
    nombre?: string,
  ): Promise<boolean> {
    try {
      const nombre_usuario = nombre || email.split("@")[0];

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #333; margin-bottom: 20px;">¡Bienvenido a ProWallet, ${nombre_usuario}!</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Tu cuenta ha sido creada exitosamente.
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-top: 20px;">
              Ahora puedes:
            </p>
            <ul style="color: #666; font-size: 16px; line-height: 1.8;">
              <li>✅ Verificar tu email</li>
              <li>💰 Comprar tokens ProWallet</li>
              <li>📤 Transferir tokens a otros usuarios</li>
              <li>📊 Ver tu historial de transacciones</li>
            </ul>
            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              Si tienes preguntas, no dudes en contactarnos.
            </p>
          </div>
        </div>
      `;

      return await this.enviar_email({
        para: email,
        asunto: `¡Bienvenido a ProWallet, ${nombre_usuario}!`,
        html,
      });
    } catch (error) {
      loggerService.logError(error as Error, {
        contexto: "enviar_email_bienvenida",
        email,
      });
      return false;
    }
  }

  /**
   * Función principal para enviar emails
   * Usa Nodemailer en producción
   * Registra a la consola en desarrollo si no hay transporte disponible
   */
  static async enviar_email(opciones: OpcionesEmail): Promise<boolean> {
    try {
      const desde = process.env.EMAIL_FROM || process.env.EMAIL_USER;

      if (!desde) {
        loggerService.logInfo(
          "Email no enviado: EMAIL_FROM no configurado (modo demo)",
          {
            contexto: "enviar_email",
            para: opciones.para,
            asunto: opciones.asunto,
          },
        );
        return true;
      }

      try {
        const transporte = crear_transporte_email();
        const resultado = await transporte.sendMail({
          from: desde,
          to: opciones.para,
          subject: opciones.asunto,
          html: opciones.html,
          text: opciones.texto,
        });

        loggerService.logInfo("Email enviado correctamente", {
          contexto: "enviar_email",
          para: opciones.para,
          asunto: opciones.asunto,
          messageId: resultado.messageId,
        });

        return true;
      } catch (error) {
        // Si hay error en Nodemailer, registra en demo
        if (process.env.NODE_ENV === "development") {
          loggerService.logInfo("Email enviado (modo demo)", {
            contexto: "enviar_email",
            para: opciones.para,
            asunto: opciones.asunto,
          });

          console.log(`\n========== EMAIL (${opciones.para}) ==========`);
          console.log(`Asunto: ${opciones.asunto}`);
          console.log(`\n${opciones.texto || opciones.html}`);
          console.log("==========================================\n");

          return true;
        }

        throw error;
      }
    } catch (error) {
      loggerService.logError(error as Error, {
        contexto: "enviar_email",
        para: opciones.para,
      });
      return false;
    }
  }
}
