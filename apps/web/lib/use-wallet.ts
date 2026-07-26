import { useState, useEffect } from "react";
import { authService } from "./auth-service";

/**
 * Hook para obtener la dirección de la wallet de forma reactiva
 * Se actualiza cuando la wallet se conecta/desconecta
 */
export function useWallet() {
  const [walletAddress, setWalletAddress] = useState<string>(() => {
    // Inicializar con la wallet guardada
    if (typeof window !== "undefined") {
      return authService.getWalletAddress() || "";
    }
    return "";
  });

  useEffect(() => {
    // Obtener la wallet al montar el componente
    const stored = authService.getWalletAddress();
    setWalletAddress(stored || "");

    // Crear un intervalo para chequear cambios en localStorage
    // (no hay un evento confiable para cambios en el mismo tab)
    const interval = setInterval(() => {
      const current = authService.getWalletAddress();
      setWalletAddress(current || "");
    }, 300); // Chequear cada 300ms para detectar logout más rápido

    // Escuchar cambios desde otros tabs/ventanas
    const handleStorageChange = (e: StorageEvent) => {
      // ✅ Limpiar si walletAddress se pone null o si auth_user se borra (logout)
      if (
        e.key === "walletAddress" ||
        (e.key === "auth_user" && e.newValue === null)
      ) {
        setWalletAddress(e.newValue || "");
        // Forzar re-lectura desde storage
        setTimeout(() => {
          const refreshed = authService.getWalletAddress();
          setWalletAddress(refreshed || "");
        }, 100);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return walletAddress;
}
