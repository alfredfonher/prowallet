"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Calcular requisitos del password en tiempo real
  const requisitos = useMemo(
    () => validar_requisitos_password(password),
    [password],
  );
  const es_password_valido = useMemo(
    () => password_valido(password),
    [password],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validar que los campos no estén vacíos
    if (!email || !password || !confirmPassword) {
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
        "http://localhost:3001/api/v1/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await response.json();

      // Log detallado para debugging
      console.log("📤 Enviado:", {
        email,
        password: password.substring(0, 5) + "...",
      });
      console.log("📥 Respuesta:", data);
      console.log("Status:", response.status);

      if (!response.ok) {
        // Si el backend devuelve detalles de error, mostrarlos
        if (data.extra?.details && Array.isArray(data.extra.details)) {
          setError(`Error: ${data.extra.details.join(", ")}`);
        } else if (data.extra?.error) {
          setError(data.extra.error);
        } else if (data.message) {
          setError(data.message);
        } else {
          setError(`Error ${response.status}: ${JSON.stringify(data)}`);
        }
        setLoading(false);
        return;
      }

      if (data.success) {
        // Guardar token y usuario en sessionStorage
        sessionStorage.setItem("token", data.data.access_token);
        sessionStorage.setItem("user", JSON.stringify(data.data.user));

        // Redirigir al dashboard automáticamente
        router.push("/");
      }
    } catch (err) {
      console.error("❌ Error de conexión:", err);
      setError(
        "Error de conexión: " +
          (err instanceof Error ? err.message : String(err)),
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
              Crear Cuenta
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Al registrarte, recibirás un email de verificación antes de poder
              iniciar sesión
            </p>
          </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="Ejemplo: MiPassword123!"
                required
              />

              {/* Mostrar requisitos en tiempo real */}
              {password && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Requisitos del password:
                  </p>
                  <div className="space-y-1">
                    <div
                      className={`text-xs flex items-center ${requisitos.longitud ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      <span
                        className={`mr-2 ${requisitos.longitud ? "✓" : "✗"}`}
                      >
                        {requisitos.longitud ? "✓" : "✗"}
                      </span>
                      Mínimo 8 caracteres
                    </div>
                    <div
                      className={`text-xs flex items-center ${requisitos.mayuscula ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      <span className="mr-2">
                        {requisitos.mayuscula ? "✓" : "✗"}
                      </span>
                      Una mayúscula (A-Z)
                    </div>
                    <div
                      className={`text-xs flex items-center ${requisitos.minuscula ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      <span className="mr-2">
                        {requisitos.minuscula ? "✓" : "✗"}
                      </span>
                      Una minúscula (a-z)
                    </div>
                    <div
                      className={`text-xs flex items-center ${requisitos.numero ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      <span className="mr-2">
                        {requisitos.numero ? "✓" : "✗"}
                      </span>
                      Un número (0-9)
                    </div>
                    <div
                      className={`text-xs flex items-center ${requisitos.simbolo ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
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
                Confirmar Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="Repite tu password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                !email ||
                !password ||
                !confirmPassword ||
                !es_password_valido ||
                password !== confirmPassword
              }
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Registrando..." : "Registrarse e Iniciar Sesión"}
            </button>
          </form>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Iniciar Sesión
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
