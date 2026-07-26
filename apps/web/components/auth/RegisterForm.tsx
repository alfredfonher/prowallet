/**
 * Formulario de registro (sign up)
 */

import type React from "react";
import { PasswordRequirementsDisplay } from "./PasswordRequirementsDisplay";
import { is_password_valid } from "@/lib/auth";

/**
 * Props para RegisterForm
 */
export interface RegisterFormProps {
  email: string;
  on_email_change: (email: string) => void;
  password: string;
  on_password_change: (password: string) => void;
  confirm_password: string;
  on_confirm_password_change: (password: string) => void;
  is_loading: boolean;
  on_submit: (e: React.FormEvent) => void;
}

/**
 * Componente de formulario de registro
 *
 * Contiene:
 * - Input de email
 * - Input de password con requisitos en tiempo real
 * - Input de confirmar password
 * - Botón de submit con validación
 *
 * @param props - Props del formulario
 * @returns Componente React
 *
 * @example
 * <RegisterForm
 *   email="user@example.com"
 *   on_email_change={setEmail}
 *   password="Password123!"
 *   on_password_change={setPassword}
 *   confirm_password="Password123!"
 *   on_confirm_password_change={setConfirmPassword}
 *   is_loading={false}
 *   on_submit={handleRegister}
 * />
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({
  email,
  on_email_change,
  password,
  on_password_change,
  confirm_password,
  on_confirm_password_change,
  is_loading,
  on_submit,
}) => {
  const password_is_valid = is_password_valid(password);
  const passwords_match = password === confirm_password;

  const can_submit =
    !!email &&
    !!password &&
    !!confirm_password &&
    password_is_valid &&
    passwords_match &&
    !is_loading;

  return (
    <form onSubmit={on_submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => on_email_change(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          placeholder="ejemplo@demo.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => on_password_change(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          placeholder="Ejemplo: MiPassword123!"
          required
        />

        {password && <PasswordRequirementsDisplay password={password} />}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Confirmar Password
        </label>
        <input
          type="password"
          value={confirm_password}
          onChange={(e) => on_confirm_password_change(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          placeholder="Repite tu contraseña"
          required
          minLength={8}
        />

        {confirm_password && password !== confirm_password && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            ✗ Las contraseñas no coinciden
          </p>
        )}

        {confirm_password && password === confirm_password && (
          <p className="mt-2 text-xs text-green-600 dark:text-green-400">
            ✓ Las contraseñas coinciden
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!can_submit}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {is_loading ? "Registrando..." : "Registrarse"}
      </button>
    </form>
  );
};

RegisterForm.displayName = "RegisterForm";
