/**
 * Hook para acceder a la configuración del entorno
 *
 * REFACTORIZADO: Ahora usa variable explícita NEXT_PUBLIC_ENVIRONMENT
 * en lugar de auto-detección, por lo que el cambio de servidor en runtime
 * requiere recargar la página (cambiar .env.local)
 */

"use client";

import { useEffect, useState } from "react";
import {
  getEnvironmentConfig,
  logEnvironmentConfig,
  type EnvironmentType,
} from "@/lib/config/environment";

interface UseEnvironmentReturn {
  environment: EnvironmentType | null;
  apiUrl: string | null;
  isDevelopment: boolean;
  isProduction: boolean;
}

export function useEnvironment(): UseEnvironmentReturn {
  const [config, setConfig] = useState<UseEnvironmentReturn>({
    environment: null,
    apiUrl: null,
    isDevelopment: false,
    isProduction: false,
  });

  // Inicializar configuración en el cliente
  useEffect(() => {
    const envConfig = getEnvironmentConfig();
    setConfig({
      environment: envConfig.environment,
      apiUrl: envConfig.apiUrl,
      isDevelopment: envConfig.isDevelopment,
      isProduction: envConfig.isProduction,
    });

    // Log en desarrollo
    if (envConfig.isDevelopment) {
      logEnvironmentConfig();
    }
  }, []);

  return config;
}
