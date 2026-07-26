# Guía Rápida de Integración - Address Book en Transfer

## 1️⃣ Opción Simple: Agregar Botón a Componente Existente

Si tienes un formulario de transferencia existente, agrega esto:

```tsx
"use client";

import { useState } from "react";
import { AddressBookModal } from "@/components/transfer/address-book-modal";
import { SavedAddress } from "@/lib/address-book-api";
import { Button } from "@/components/ui/button";

export function MyTransferForm() {
  const [to_address, set_to_address] = useState("");
  const [is_modal_open, set_is_modal_open] = useState(false);
  const wallet_address = "..."; // De tu auth context

  const handle_address_selected = (address: SavedAddress) => {
    set_to_address(address.recipient_address);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          value={to_address}
          onChange={(e) => set_to_address(e.target.value)}
          placeholder="Dirección de destinatario"
          className="flex-1 px-3 py-2 border rounded"
        />
        <Button onClick={() => set_is_modal_open(true)} variant="outline">
          📖 Libreta
        </Button>
      </div>

      <AddressBookModal
        wallet_address={wallet_address}
        is_open={is_modal_open}
        on_close={() => set_is_modal_open(false)}
        on_select={handle_address_selected}
      />
    </div>
  );
}
```

---

## 2️⃣ Opción Completa: Componente Integrado

Para mejor separación, crea un componente wrapper:

```tsx
"use client";

import { TransferWithAddressBook } from "@/components/transfer/transfer-with-address-book";
import { SavedAddress } from "@/lib/address-book-api";

export function MyTransferForm() {
  const [to_address, set_to_address] = useState("");
  const wallet_address = "...";

  const handle_select = (address: SavedAddress) => {
    set_to_address(address.recipient_address);
    // Aquí puedes hacer otras cosas como actualizar otros campos
    console.log("Dirección seleccionada:", address);
  };

  return (
    <TransferWithAddressBook
      wallet_address={wallet_address}
      to_address={to_address}
      on_select_address={handle_select}
    />
  );
}
```

---

## 3️⃣ Integración en `transfer-enhanced-view.tsx`

Si estás usando `TransferView`, la integración es así:

```tsx
import { AddressBookModal } from "@/components/transfer/address-book-modal";
import { SavedAddress } from "@/lib/address-book-api";

export default function TransferView() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<TransferFormData>({
    fromHolder: "",
    toAddress: "",
    amount: "",
  });
  const [is_address_book_open, set_is_address_book_open] = useState(false);

  // ... existing code ...

  const handle_address_selected = (address: SavedAddress) => {
    setFormData((prev) => ({
      ...prev,
      toAddress: address.recipient_address,
    }));
    set_is_address_book_open(false);
  };

  return (
    <div className="space-y-6">
      {/* ... existing form fields ... */}

      {/* Dirección de destino con botón de libreta */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">
            Dirección de Destino
          </label>
          <input
            type="text"
            value={formData.toAddress}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                toAddress: e.target.value,
              }))
            }
            placeholder="Ingresa dirección o selecciona de libreta"
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <Button
          onClick={() => set_is_address_book_open(true)}
          variant="outline"
          className="gap-2"
        >
          <BookOpen className="h-4 w-4" />
          Libreta
        </Button>
      </div>

      {/* Modal de libreta */}
      <AddressBookModal
        wallet_address={user?.walletAddress}
        is_open={is_address_book_open}
        on_close={() => set_is_address_book_open(false)}
        on_select={handle_address_selected}
      />

      {/* ... rest of form ... */}
    </div>
  );
}
```

---

## 4️⃣ Imports Necesarios

Copia estos imports a tu componente:

```tsx
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressBookModal } from "@/components/transfer/address-book-modal";
import { SavedAddress } from "@/lib/address-book-api";
```

---

## 5️⃣ Validación Sola (Sin Modal)

Si quieres validar direcciones pero no usar el modal:

```tsx
import { AddAddressForm } from "@/components/transfer/add-address-form";

// En tu componente:
const handle_add_saved = async (data: {
  recipient_address: string;
  label: string;
  description?: string;
  is_favorite?: boolean;
}) => {
  console.log("Nueva dirección guardada:", data);
  // Llamar a tu API
};

return <AddAddressForm on_submit={handle_add_saved} is_loading={false} />;
```

---

## 6️⃣ Hook Personalizado

O usa el hook directamente para máx flexibilidad:

```tsx
import { use_address_book } from "@/hooks/use-address-book";

export function MyAddressBookUI() {
  const { addresses, is_loading, add_address, delete_address, update_address } =
    use_address_book({
      wallet_address: "tu-wallet",
      auto_load: true,
    });

  return (
    <div>
      {is_loading ? (
        <p>Cargando...</p>
      ) : (
        <ul>
          {addresses.map((addr) => (
            <li key={addr.id}>
              <strong>{addr.label}</strong>
              <p>{addr.recipient_address}</p>
              <button onClick={() => delete_address(addr.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 🎨 Personalización de Estilos

Los componentes usan Shadcn/ui, personaliza los estilos:

```tsx
// En AddressBookModal, modifica className:
<Dialog open={is_open} onOpenChange={on_close}>
  <DialogContent className="max-w-md bg-white dark:bg-slate-950">
    {/* ... */}
  </DialogContent>
</Dialog>
```

---

## 🧪 Testing de Integración

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MyTransferForm } from "./my-transfer-form";

describe("Transfer with Address Book", () => {
  it("should open address book modal", async () => {
    render(<MyTransferForm />);

    const button = screen.getByText("Libreta");
    fireEvent.click(button);

    expect(screen.getByText("Libreta de Direcciones")).toBeInTheDocument();
  });
});
```

---

## 🚀 Deploy Checklist

- [ ] Frontend compila: `npm run build` ✅
- [ ] Backend compila: `npm run build` ✅
- [ ] Variables de ambiente configuradas
- [ ] Base de datos migrada: `npx prisma migrate deploy`
- [ ] Tests pasan: `npm test`
- [ ] Docker actualizado si es necesario
- [ ] Endpoints testeados manualmente

---

## 📞 Troubleshooting

### Error: "Cannot find module @/lib/address-book-api"

→ Verifica que el archivo existe en `apps/web/lib/address-book-api.ts`

### Error: "Tipos no coinciden"

→ Asegúrate de importar `SavedAddress` de `@/lib/address-book-api`

### Modal no se abre

→ Verifica que `is_open` está en true y `onOpenChange` funciona

### Direcciones no cargan

→ Revisa la consola, verifica que el backend esté corriendo en puerto 3001

---

**¿Preguntas?** Revisa [FRONTEND_ADDRESS_BOOK_IMPLEMENTATION.md](../FRONTEND_ADDRESS_BOOK_IMPLEMENTATION.md) para detalles completos.
