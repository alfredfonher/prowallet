/**
 * Componente para ver la configuración actual del entorno
 * Solo visible en modo desarrollo
 *
 * REFACTORIZADO: Ya no permite cambiar servidor en runtime
 * Para cambiar: edita NEXT_PUBLIC_ENVIRONMENT en .env.local
 */

"use client";

import { useEnvironment } from "@/hooks/useEnvironment";
import { useEffect, useState } from "react";

export function ServerSwitcher() {
  const { environment, apiUrl, isDevelopment } = useEnvironment();
  const [isOpen, setIsOpen] = useState(false);

  // Solo mostrar en desarrollo
  if (!isDevelopment) {
    return null;
  }

  if (!environment) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Botón toggleable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-900 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg"
        title="Ver configuración del entorno"
      >
        🔧
      </button>

      {/* Panel de información */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-72 max-h-96 overflow-y-auto">
          <h3 className="font-bold text-sm mb-3">
            🔧 Configuración del Entorno
          </h3>

          {/* Estado actual */}
          <div className="mb-3 p-2 bg-gray-100 rounded text-xs">
            <div className="font-semibold mb-1">Entorno actual:</div>
            <div className="text-gray-700">
              <span
                className={`inline-block px-2 py-1 rounded text-white ${
                  environment === "local" ? "bg-blue-500" : "bg-purple-500"
                }`}
              >
                {environment === "local" ? "🏠 LOCAL" : "☁️ PRODUCTION"}
              </span>
            </div>
          </div>

          {/* URL de API actual */}
          <div className="mb-3 p-2 bg-gray-50 rounded text-xs break-words">
            <div className="font-semibold mb-1">URL API:</div>
            <div className="text-gray-600 font-mono text-xs">{apiUrl}</div>
          </div>

          {/* Información sobre cómo cambiar */}
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
            <span className="font-semibold">ℹ️ Cómo cambiar:</span>
            <ol className="mt-1 space-y-1 ml-4 list-decimal">
              <li>
                Edita <code className="bg-white px-1 rounded">.env.local</code>
              </li>
              <li>
                Cambia{" "}
                <code className="bg-white px-1 rounded">
                  NEXT_PUBLIC_ENVIRONMENT
                </code>
              </li>
              <li>Recarga la página (F5)</li>
            </ol>
          </div>

          {/* Variable explícita */}
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-700">
            <span className="font-semibold">⚠️ Nota:</span> Usa variable
            explícita{" "}
            <code className="bg-white px-1 rounded">
              NEXT_PUBLIC_ENVIRONMENT
            </code>{" "}
            en lugar de auto-detección.
          </div>
        </div>
      )}
    </div>
  );
}
