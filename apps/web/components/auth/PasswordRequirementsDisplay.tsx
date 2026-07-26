/**
 * Widget que muestra los requisitos de contraseña validándolos en tiempo real
 */

import type React from "react";
import { validate_password_requirements } from "@/lib/auth";

/**
 * Props para PasswordRequirementsDisplay
 */
export interface PasswordRequirementsDisplayProps {
  password: string;
}

/**
 * Componente que muestra los requisitos de password con indicadores visuales
 *
 * Muestra en tiempo real:
 * - ✓ o ✗ para cada requisito
 * - Color verde si está cumplido, rojo si no
 * - Todos los requisitos: longitud, mayúscula, minúscula, número, símbolo
 *
 * @param props - Props con la contraseña a validar
 * @returns Componente React
 *
 * @example
 * <PasswordRequirementsDisplay password="MiPassword123!" />
 */
export const PasswordRequirementsDisplay: React.FC<
  PasswordRequirementsDisplayProps
> = ({ password }) => {
  const requisitos = validate_password_requirements(password);

  return (
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
          <span className="mr-2">{requisitos.longitud ? "✓" : "✗"}</span>
          Mínimo 8 caracteres
        </div>
        <div
          className={`text-xs flex items-center ${
            requisitos.mayuscula
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          <span className="mr-2">{requisitos.mayuscula ? "✓" : "✗"}</span>
          Una mayúscula (A-Z)
        </div>
        <div
          className={`text-xs flex items-center ${
            requisitos.minuscula
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          <span className="mr-2">{requisitos.minuscula ? "✓" : "✗"}</span>
          Una minúscula (a-z)
        </div>
        <div
          className={`text-xs flex items-center ${
            requisitos.numero
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          <span className="mr-2">{requisitos.numero ? "✓" : "✗"}</span>
          Un número (0-9)
        </div>
        <div
          className={`text-xs flex items-center ${
            requisitos.simbolo
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          <span className="mr-2">{requisitos.simbolo ? "✓" : "✗"}</span>
          Un símbolo (@$!%*?&)
        </div>
      </div>
    </div>
  );
};

PasswordRequirementsDisplay.displayName = "PasswordRequirementsDisplay";
