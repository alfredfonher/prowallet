/**
 * Debug Panel Component
 *
 * Mostrar estado de conexión API y diagnóstico en tiempo real
 */

"use client";

import { useEffect, useState } from "react";
// api-diagnostics removed for devnet MVP — debug panel disabled
type DiagnosticsResult = Record<string, unknown>;
const apiDiagnostics = async (): Promise<DiagnosticsResult> => ({ status: "disabled" });
import { AlertCircle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export function DebugPanel() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Toggle con tecla especial (Shift + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "D") {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const result = await apiDiagnostics.runDiagnostics();
      setDiagnostics(result);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="text-xs bg-blue-600 px-2 py-1 rounded">DEBUG</span>
          API Diagnostics
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white text-lg"
        >
          ✕
        </button>
      </div>

      {/* Control buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} />
          {loading ? "Ejecutando..." : "Ejecutar"}
        </button>
      </div>

      {/* Results */}
      {diagnostics ? (
        <div className="space-y-3 text-xs">
          {/* API Status */}
          <div className="flex items-start gap-2">
            {diagnostics.apiReachable ? (
              <CheckCircle2
                size={14}
                className="text-green-500 flex-shrink-0 mt-0.5"
              />
            ) : (
              <XCircle
                size={14}
                className="text-red-500 flex-shrink-0 mt-0.5"
              />
            )}
            <div className="flex-1">
              <p className="text-gray-300">
                <span className="font-semibold">API Status:</span>{" "}
                {diagnostics.apiReachable
                  ? "✅ Alcanzable"
                  : "❌ No alcanzable"}
              </p>
              <p className="text-gray-500 break-all">{diagnostics.apiUrl}</p>
            </div>
          </div>

          {/* Network */}
          <div className="flex items-start gap-2">
            <CheckCircle2
              size={14}
              className={`flex-shrink-0 mt-0.5 ${
                diagnostics.network === "devnet"
                  ? "text-green-500"
                  : "text-yellow-500"
              }`}
            />
            <div className="flex-1">
              <p className="text-gray-300">
                <span className="font-semibold">Red:</span>{" "}
                {diagnostics.network}
              </p>
            </div>
          </div>

          {/* Endpoints */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="font-semibold text-gray-300 mb-2">
              Endpoints:{" "}
              {diagnostics.endpoints.filter((e) => e.reachable).length}/
              {diagnostics.endpoints.length}
            </p>
            {diagnostics.endpoints.map((ep) => (
              <div key={ep.name} className="flex items-start gap-2 mb-1">
                {ep.reachable ? (
                  <CheckCircle2
                    size={12}
                    className="text-green-500 flex-shrink-0 mt-0.5"
                  />
                ) : (
                  <XCircle
                    size={12}
                    className="text-red-500 flex-shrink-0 mt-0.5"
                  />
                )}
                <div className="flex-1">
                  <p className="text-gray-400">
                    {ep.name}
                    {ep.error && (
                      <span className="text-red-400 ml-1">({ep.error})</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Errors */}
          {diagnostics.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={14}
                  className="text-yellow-500 flex-shrink-0 mt-0.5"
                />
                <div className="flex-1">
                  <p className="font-semibold text-yellow-400 mb-1">
                    Advertencias:
                  </p>
                  {diagnostics.errors.map((err, i) => (
                    <p key={i} className="text-gray-400 text-xs mb-1">
                      • {err}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Hint */}
          <p className="text-gray-500 text-xs mt-2">
            Presiona Shift+D para cerrar
          </p>
        </div>
      ) : (
        <p className="text-gray-400 text-xs">
          Presiona "Ejecutar" para hacer diagnóstico...
        </p>
      )}
    </div>
  );
}
