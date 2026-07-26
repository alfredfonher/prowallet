"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface AddAddressFormProps {
  on_submit: (data: {
    recipient_address: string;
    label: string;
    description?: string;
    is_favorite?: boolean;
  }) => Promise<void>;
  is_loading?: boolean;
}

export function AddAddressForm({
  on_submit,
  is_loading = false,
}: AddAddressFormProps) {
  const [recipient_address, set_recipient_address] = useState("");
  const [label, set_label] = useState("");
  const [description, set_description] = useState("");
  const [is_favorite, set_is_favorite] = useState(false);
  const [error, set_error] = useState("");
  const [is_submitting, set_is_submitting] = useState(false);

  const validate_form = (): boolean => {
    set_error("");

    if (!recipient_address.trim()) {
      set_error("La dirección de destinatario es requerida");
      return false;
    }

    if (!SOLANA_ADDRESS_REGEX.test(recipient_address)) {
      set_error("Dirección de Solana inválida");
      return false;
    }

    if (!label.trim()) {
      set_error("El nombre de la dirección es requerido");
      return false;
    }

    if (label.length > 100) {
      set_error("El nombre no debe exceder 100 caracteres");
      return false;
    }

    if (description.length > 500) {
      set_error("La descripción no debe exceder 500 caracteres");
      return false;
    }

    return true;
  };

  const handle_submit = async () => {
    if (!validate_form()) return;

    set_is_submitting(true);
    try {
      await on_submit({
        recipient_address: recipient_address.trim(),
        label: label.trim(),
        description: description.trim() || undefined,
        is_favorite,
      });

      set_recipient_address("");
      set_label("");
      set_description("");
      set_is_favorite(false);
    } catch (err: any) {
      set_error(err?.message || "Error al agregar dirección");
    } finally {
      set_is_submitting(false);
    }
  };

  const is_disabled = is_loading || is_submitting;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Agregar Nueva Dirección
      </h3>

      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="recipient_address">Dirección de Destinatario</Label>
          <Input
            id="recipient_address"
            placeholder="Ingresa dirección de Solana"
            value={recipient_address}
            onChange={(e) => set_recipient_address(e.target.value)}
            disabled={is_disabled}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Debe ser una dirección válida de Solana (base58)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="label">Nombre de la Dirección</Label>
          <Input
            id="label"
            placeholder="ej: Cuenta de Trading, Billetera de Amigo"
            value={label}
            onChange={(e) => set_label(e.target.value)}
            disabled={is_disabled}
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            {label.length}/100 caracteres
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción (Opcional)</Label>
          <Textarea
            id="description"
            placeholder="Nota o descripción adicional..."
            value={description}
            onChange={(e) => set_description(e.target.value)}
            disabled={is_disabled}
            maxLength={500}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {description.length}/500 caracteres
          </p>
        </div>

        <div className="flex items-center gap-3 bg-muted p-3 rounded-lg">
          <Switch
            id="is_favorite"
            checked={is_favorite}
            onCheckedChange={set_is_favorite}
            disabled={is_disabled}
          />
          <Label
            htmlFor="is_favorite"
            className="cursor-pointer flex-1 mb-0 font-medium"
          >
            Marcar como favorito
          </Label>
        </div>

        <Button
          onClick={handle_submit}
          disabled={is_disabled}
          className="w-full"
          size="lg"
        >
          {is_submitting ? (
            "Agregando..."
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Dirección
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
