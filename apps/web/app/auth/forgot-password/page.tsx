"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // Validación básica
    if (!email.trim()) {
      setError("El email es requerido");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3001/api/v1/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        // Mejor manejo de errores
        if (data.extra?.error) {
          setError(data.extra.error);
        } else if (data.error) {
          setError(data.error);
        } else {
          setError(
            `Error ${response.status}: ${data.message || "No se pudo procesar tu solicitud"}`,
          );
        }
        setLoading(false);
        return;
      }

      // Mostrar mensaje de éxito
      setMessage(
        data.data?.message ||
          "Si el email existe, recibirás un enlace para recuperar tu contraseña en breve",
      );
      setEmail("");
      setLoading(false);
    } catch (err) {
      setError(
        "Error de conexión: " +
          (err instanceof Error
            ? err.message
            : "No se pudo conectar al servidor"),
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full mx-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Recuperar Contraseña
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Ingresa tu email para recibir instrucciones de recuperación
            </p>
          </div>

          {message && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-md text-sm">
              ✓ {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="ejemplo@demo.com"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!message}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading
                ? "Enviando..."
                : message
                  ? "Enlace Enviado"
                  : "Enviar Enlace de Recuperación"}
            </button>
          </form>

          <div className="space-y-2 text-center text-sm text-gray-600 dark:text-gray-400">
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p>
                ¿Recordaste tu contraseña?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  Inicia sesión
                </button>
              </p>
            </div>

            <p>
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => router.push("/auth/register")}
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
              >
                Regístrate
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
