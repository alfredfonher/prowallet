/**
 * Página completa de autenticación - orquestador
 * Maneja login, registro, y el flujo entre ambos
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { AuthPageLayout } from "./AuthPageLayout";
import {
  handle_login_submit,
  handle_register_submit,
  is_password_valid,
  get_missing_password_requirements,
} from "@/lib/auth";

/**
 * Props para AuthPage
 */
export interface AuthPageProps {
  api_url: string;
}

/**
 * Página de autenticación completa
 *
 * Maneja:
 * - Switching entre Login y Register
 * - Validación de inputs
 * - Llamadas a handleLogin / handleRegister
 * - Mensajes de error
 * - Redirecciones después de éxito
 *
 * @param props - Props con api_url
 * @returns Componente React
 */
export const AuthPage: React.FC<AuthPageProps> = ({ api_url }) => {
  const router = useRouter();

  // Auth mode (login o register)
  const [auth_mode, set_auth_mode] = useState<"login" | "register">("login");

  // Form state
  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [confirm_password, set_confirm_password] = useState("");
  const [auth_loading, set_auth_loading] = useState(false);
  const [auth_error, set_auth_error] = useState("");

  /**
   * Manejador del formulario de login
   */
  const handle_login = async (e: React.FormEvent) => {
    e.preventDefault();
    set_auth_loading(true);
    set_auth_error("");

    const result = await handle_login_submit(email, password, api_url);

    if (result.success) {
      set_auth_loading(false);
      window.location.href = "/";
    } else {
      set_auth_error(result.error || "Error desconocido");
      set_auth_loading(false);
    }
  };

  /**
   * Manejador del formulario de registro
   */
  const handle_register = async (e: React.FormEvent) => {
    e.preventDefault();
    set_auth_error("");

    // Validar password antes de enviar
    if (!is_password_valid(password)) {
      const missing = get_missing_password_requirements(password);
      set_auth_error(`Password incompleto: ${missing.join(", ")}`);
      return;
    }

    set_auth_loading(true);

    const result = await handle_register_submit(
      email,
      password,
      confirm_password,
      api_url,
    );

    if (result.success) {
      set_auth_loading(false);
      window.location.href = "/";
    } else {
      set_auth_error(result.error || "Error desconocido");
      set_auth_loading(false);
    }
  };

  /**
   * Cambiar modo (login <-> register)
   */
  const handle_mode_switch = (mode: "login" | "register") => {
    set_auth_mode(mode);
    set_auth_error("");
    set_email("");
    set_password("");
    set_confirm_password("");
  };

  return (
    <AuthPageLayout
      title={auth_mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
      subtitle={
        auth_mode === "login" ? "Bienvenido de nuevo" : "Únete a nosotros hoy"
      }
      footer={
        auth_mode === "login" ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ¿Olvidaste tu contraseña?{" "}
            <button
              type="button"
              onClick={() => router.push("/auth/forgot-password")}
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
            >
              Recupérala aquí
            </button>
          </p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Al registrarte, recibirás un email de verificación
          </p>
        )
      }
      info_box={undefined}
    >
      {/* Mode Toggle */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <button
          type="button"
          onClick={() => handle_mode_switch("login")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            auth_mode === "login"
              ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          Iniciar Sesión
        </button>
        <button
          type="button"
          onClick={() => handle_mode_switch("register")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            auth_mode === "register"
              ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          Registrarse
        </button>
      </div>

      {/* Error Message */}
      {auth_error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md">
          {auth_error}
        </div>
      )}

      {/* Login Form */}
      {auth_mode === "login" && (
        <LoginForm
          email={email}
          on_email_change={set_email}
          password={password}
          on_password_change={set_password}
          is_loading={auth_loading}
          on_submit={handle_login}
        />
      )}

      {/* Register Form */}
      {auth_mode === "register" && (
        <RegisterForm
          email={email}
          on_email_change={set_email}
          password={password}
          on_password_change={set_password}
          confirm_password={confirm_password}
          on_confirm_password_change={set_confirm_password}
          is_loading={auth_loading}
          on_submit={handle_register}
        />
      )}
    </AuthPageLayout>
  );
};

AuthPage.displayName = "AuthPage";
