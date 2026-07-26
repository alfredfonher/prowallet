/**
 * Formulario de login (sign in)
 */

import type React from "react";

/**
 * Props para LoginForm
 */
export interface LoginFormProps {
  email: string;
  on_email_change: (email: string) => void;
  password: string;
  on_password_change: (password: string) => void;
  is_loading: boolean;
  on_submit: (e: React.FormEvent) => void;
}

/**
 * Componente de formulario de login
 *
 * Contiene:
 * - Input de email
 * - Input de password
 * - Botón de submit
 * - Estados de carga
 *
 * @param props - Props del formulario
 * @returns Componente React
 *
 * @example
 * <LoginForm
 *   email="user@example.com"
 *   on_email_change={setEmail}
 *   password="password123"
 *   on_password_change={setPassword}
 *   is_loading={false}
 *   on_submit={handleLogin}
 * />
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  on_email_change,
  password,
  on_password_change,
  is_loading,
  on_submit,
}) => {
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
          placeholder="Tu contraseña"
          required
        />
      </div>

      <button
        type="submit"
        disabled={is_loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {is_loading ? "Iniciando..." : "Iniciar Sesión"}
      </button>
    </form>
  );
};

LoginForm.displayName = "LoginForm";
