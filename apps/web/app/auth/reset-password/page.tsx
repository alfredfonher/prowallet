"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Validadores de password
const validar_requisitos_password = (pwd: string) => {
  return {
    longitud: pwd.length >= 8,
    mayuscula: /[A-Z]/.test(pwd),
    minuscula: /[a-z]/.test(pwd),
    numero: /\d/.test(pwd),
    simbolo: /[@$!%*?&]/.test(pwd),
  };
};

const password_valido = (pwd: string): boolean => {
  const req = validar_requisitos_password(pwd);
  return (
    req.longitud && req.mayuscula && req.minuscula && req.numero && req.simbolo
  );
};

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Calcular requisitos del password en tiempo real
  const requisitos = useMemo(
    () => validar_requisitos_password(password),
    [password],
  );
  const es_password_valido = useMemo(
    () => password_valido(password),
    [password],
  );

  useEffect(() => {
    if (!token) {
      setError(
        "No se proporcionó token de recuperación. Por favor, solicita un nuevo enlace.",
      );
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Token inválido. Por favor, solicita un nuevo enlace.");
      return;
    }

    // Validar contraseñas
    if (!password || !confirmPassword) {
      setError("Todos los campos son requeridos");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    // Validar que el password cumpla requisitos
    if (!es_password_valido) {
      const req_faltantes = [];
      if (!requisitos.longitud) req_faltantes.push("Mínimo 8 caracteres");
      if (!requisitos.mayuscula) req_faltantes.push("Mayúscula (A-Z)");
      if (!requisitos.minuscula) req_faltantes.push("Minúscula (a-z)");
      if (!requisitos.numero) req_faltantes.push("Número (0-9)");
      if (!requisitos.simbolo) req_faltantes.push("Símbolo (@$!%*?&)");
      setError(`Password incompleto: ${req_faltantes.join(", ")}`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3001/api/v1/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, password }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.extra?.error) {
          setError(data.extra.error);
        } else if (data.error) {
          setError(data.error);
        } else {
          setError(
            `Error ${response.status}: ${data.message || "Error al resetear contraseña"}`,
          );
        }
        setLoading(false);
        return;
      }

      if (data.success) {
        setMessage(data.data.message || "Contraseña actualizada exitosamente");
        setPassword("");
        setConfirmPassword("");

        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          router.push("/auth/login");
        }, 3000);
      }
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
              Restablecer Contraseña
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Ingresa tu nueva contraseña
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-md text-sm">
              ✓ {message}
              <p className="text-xs mt-2">
                Serás redirigido al login en 3 segundos...
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Ejemplo: MiPassword123!"
                  required
                  disabled={!token}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              {/* Mostrar requisitos en tiempo real */}
              {password && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Requisitos del password:
                  </p>
                  <div className="space-y-1">
                    <div
                      className={`text-xs flex items-center ${
                        requisitos.longitud
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      <span className="mr-2">
                        {requisitos.longitud ? "✓" : "✗"}
                      </span>
                      Mínimo 8 caracteres
                    </div>
                    <div
                      className={`text-xs flex items-center ${
                        requisitos.mayuscula
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      <span className="mr-2">
                        {requisitos.mayuscula ? "✓" : "✗"}
                      </span>
                      Una mayúscula (A-Z)
                    </div>
                    <div
                      className={`text-xs flex items-center ${
                        requisitos.minuscula
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      <span className="mr-2">
                        {requisitos.minuscula ? "✓" : "✗"}
                      </span>
                      Una minúscula (a-z)
                    </div>
                    <div
                      className={`text-xs flex items-center ${
                        requisitos.numero
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      <span className="mr-2">
                        {requisitos.numero ? "✓" : "✗"}
                      </span>
                      Un número (0-9)
                    </div>
                    <div
                      className={`text-xs flex items-center ${
                        requisitos.simbolo
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      <span className="mr-2">
                        {requisitos.simbolo ? "✓" : "✗"}
                      </span>
                      Un símbolo (@$!%*?&)
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirmar Nueva Contraseña
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="Repite tu contraseña"
                required
                disabled={!token}
              />
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !token ||
                !es_password_valido ||
                password !== confirmPassword
              }
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Actualizando..." : "Actualizar Contraseña"}
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
                  Iniciar Sesión
                </button>
              </p>
            </div>

            <p>
              ¿No recibiste el enlace?{" "}
              <button
                type="button"
                onClick={() => router.push("/auth/forgot-password")}
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
              >
                Solicitar nuevo
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
