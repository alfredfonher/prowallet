"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SavedAddress } from "@/lib/address-book-api";
import { AddressBookModal } from "@/components/transfer/address-book-modal";

interface TransferWithAddressBookProps {
  wallet_address?: string;
  to_address: string;
  on_select_address: (address: SavedAddress) => void;
}

export function TransferWithAddressBook({
  wallet_address,
  to_address,
  on_select_address,
}: TransferWithAddressBookProps) {
  const [is_modal_open, set_is_modal_open] = useState(false);

  if (!wallet_address) {
    return null;
  }

  const handle_select_address = (address: SavedAddress) => {
    on_select_address(address);
    set_is_modal_open(false);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-sm text-muted-foreground font-mono truncate">
          {to_address || "Ninguna dirección seleccionada"}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => set_is_modal_open(true)}
          className="gap-2"
        >
          <BookOpen className="h-4 w-4" />
          Libreta
        </Button>
      </div>

      <AddressBookModal
        wallet_address={wallet_address}
        is_open={is_modal_open}
        on_close={() => set_is_modal_open(false)}
        on_select={handle_select_address}
      />
    </>
  );
}
