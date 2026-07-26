"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletConnectModal({
  open,
  onOpenChange,
}: WalletConnectModalProps) {
  const { loginWithWallet, isLoading, error: contextError } = useAuth();
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setError("");
    try {
      console.log("🔐 Conectando wallet...");
      await loginWithWallet();
      console.log("✓ Wallet conectada exitosamente");
      onOpenChange(false);
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Wallet connection failed";
      console.error("✗ Error al conectar wallet:", errMsg);
      setError(errMsg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar Wallet</DialogTitle>
          <DialogDescription>
            Conecta tu wallet de Solana para acceder a todas las funcionalidades
            de trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(error || contextError) && (
            <Alert variant="destructive">
              <AlertDescription>{error || contextError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se abrirá tu wallet para confirmar la conexión. Tendrás que firmar
              un mensaje para verificar tu propiedad de la wallet.
            </p>

            <Button
              onClick={handleConnect}
              disabled={isLoading}
              size="lg"
              className="w-full"
            >
              {isLoading ? "Conectando..." : "Conectar con Phantom"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>✓ Sin contraseña requerida</p>
            <p>✓ Seguro con firma criptográfica</p>
            <p>✓ Control total de tu wallet</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
