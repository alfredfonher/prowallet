"use client";

import { Star, Trash2 } from "lucide-react";
import { SavedAddress } from "@/lib/address-book-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

interface AddressBookListProps {
  addresses: SavedAddress[];
  is_loading: boolean;
  on_select?: (address: SavedAddress) => void;
  on_delete?: (address_id: string) => void;
  on_toggle_favorite?: (address_id: string, is_favorite: boolean) => void;
  is_deleting?: boolean;
}

export function AddressBookList({
  addresses,
  is_loading,
  on_select,
  on_delete,
  on_toggle_favorite,
  is_deleting = false,
}: AddressBookListProps) {
  if (is_loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner />
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <Empty>
        <h3 className="text-lg font-medium">Sin direcciones guardadas</h3>
        <p className="text-sm text-muted-foreground">
          Agrega tu primera dirección para facilitar futuras transferencias
        </p>
      </Empty>
    );
  }

  const favorites = addresses.filter((addr) => addr.is_favorite);
  const non_favorites = addresses.filter((addr) => !addr.is_favorite);

  const sorted_addresses = [...favorites, ...non_favorites];

  return (
    <div className="space-y-3">
      {sorted_addresses.map((address) => (
        <Card
          key={address.id}
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div
              className="flex-1 min-w-0"
              onClick={() => on_select?.(address)}
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-foreground truncate">
                  {address.label}
                </h3>
                {address.is_favorite && (
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono truncate">
                {address.recipient_address}
              </p>
              {address.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {address.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  on_toggle_favorite?.(address.id, !address.is_favorite);
                }}
                disabled={is_deleting}
              >
                <Star
                  className={`h-4 w-4 ${
                    address.is_favorite
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  on_delete?.(address.id);
                }}
                disabled={is_deleting}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
