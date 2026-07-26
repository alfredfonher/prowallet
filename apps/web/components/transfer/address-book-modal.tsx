"use client";

import { useState } from "react";
import { BookOpen, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SavedAddress } from "@/lib/address-book-api";
import { use_address_book } from "@/hooks/use-address-book";
import { AddressBookList } from "@/components/transfer/address-book-list";
import { AddAddressForm } from "@/components/transfer/add-address-form";

interface AddressBookModalProps {
  wallet_address: string;
  is_open: boolean;
  on_close: () => void;
  on_select?: (address: SavedAddress) => void;
}

export function AddressBookModal({
  wallet_address,
  is_open,
  on_close,
  on_select,
}: AddressBookModalProps) {
  const [is_deleting, set_is_deleting] = useState(false);
  const {
    addresses,
    is_loading,
    is_error,
    error_message,
    add_address,
    update_address,
    delete_address,
    load_addresses,
    clear_error,
  } = use_address_book({
    wallet_address,
    auto_load: is_open,
  });

  const handle_add_address = async (data: {
    recipient_address: string;
    label: string;
    description?: string;
    is_favorite?: boolean;
  }) => {
    const result = await add_address(
      data.recipient_address,
      data.label,
      data.description,
      data.is_favorite,
    );

    if (result.success) {
      clear_error();
    }
  };

  const handle_delete = async (address_id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta dirección?")) {
      return;
    }

    set_is_deleting(true);
    await delete_address(address_id);
    set_is_deleting(false);
  };

  const handle_toggle_favorite = async (
    address_id: string,
    is_favorite: boolean,
  ) => {
    await update_address(address_id, { is_favorite });
  };

  const handle_select = (address: SavedAddress) => {
    on_select?.(address);
    on_close();
  };

  return (
    <Dialog open={is_open} onOpenChange={on_close}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Libreta de Direcciones
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={on_close}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {is_error && (
          <Alert variant="destructive">
            <AlertDescription className="flex justify-between items-center">
              <span>{error_message}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clear_error}
                className="h-6 px-2"
              >
                Cerrar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="addresses" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="addresses">
              Mis Direcciones ({addresses.length})
            </TabsTrigger>
            <TabsTrigger value="add">Agregar Nueva</TabsTrigger>
          </TabsList>

          <TabsContent value="addresses" className="space-y-4">
            <AddressBookList
              addresses={addresses}
              is_loading={is_loading}
              on_select={handle_select}
              on_delete={handle_delete}
              on_toggle_favorite={handle_toggle_favorite}
              is_deleting={is_deleting}
            />
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <AddAddressForm
              on_submit={handle_add_address}
              is_loading={is_loading}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
