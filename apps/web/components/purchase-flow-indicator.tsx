"use client";

import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";

interface PurchaseFlowIndicatorProps {
  step: "idle" | "initiate" | "sign" | "send" | "confirm" | "mint";
  status: "pending" | "success" | "error";
  errorMessage?: string;
}

const STEPS = [
  {
    id: "initiate",
    label: "Iniciar Compra",
    description: "Preparando transacción",
  },
  { id: "sign", label: "Firmar", description: "Firmando con wallet" },
  { id: "send", label: "Enviar", description: "Enviando a blockchain" },
  { id: "confirm", label: "Confirmar", description: "Confirmando en chain" },
  { id: "mint", label: "Acuñar Tokens", description: "Creando tus tokens" },
];

export function PurchaseFlowIndicator({
  step,
  status,
  errorMessage,
}: PurchaseFlowIndicatorProps) {
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  if (step === "idle") {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Steps Progress */}
      <div className="space-y-3">
        {STEPS.map((s, idx) => {
          const isActive = s.id === step;
          const isCompleted = idx < currentStepIndex;
          const isFailed = status === "error" && isActive;

          return (
            <div key={s.id} className="flex items-start gap-3">
              {/* Icon */}
              <div className="mt-1">
                {isCompleted && (
                  <CheckCircle2 className="h-5 w-5 text-success animate-in fade-in duration-300" />
                )}
                {isActive && status === "pending" && (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
                {isFailed && (
                  <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />
                )}
                {!isCompleted && !isActive && (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    isActive || isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </p>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {status === "error" && errorMessage && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      {/* Success Message */}
      {status === "success" && (
        <div className="rounded-lg border border-success/50 bg-success/10 p-3">
          <p className="text-sm text-success flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            ¡Compra completada exitosamente!
          </p>
        </div>
      )}
    </div>
  );
}
