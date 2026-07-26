# Quick Start - Address Book Frontend

## 🚀 Inicio Rápido en 5 Minutos

### Opción 1: Uso Completo del Modal (Recomendado)

```tsx
"use client";

import { useState } from "react";
import { AddressBookModal } from "@/components/transfer/address-book-modal";
import { SavedAddress } from "@/lib/address-book-api";

export default function TransferPage() {
  const [selected_address, set_selected_address] =
    useState<SavedAddress | null>(null);
  const wallet_address = "11111111111111111111111111111112";

  return (
    <div className="space-y-4">
      <h1>Transferir Tokens</h1>

      {selected_address && (
        <div className="bg-blue-50 p-4 rounded">
          <p>
            Dirección seleccionada: <strong>{selected_address.label}</strong>
          </p>
          <p className="text-sm text-gray-600 font-mono">
            {selected_address.recipient_address}
          </p>
        </div>
      )}

      <button
        onClick={() => document.getElementById("address-book-modal")?.click?.()}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        📖 Abrir Libreta de Direcciones
      </button>

      <AddressBookModal
        wallet_address={wallet_address}
        is_open={false}
        on_close={() => {}}
        on_select={(address) => set_selected_address(address)}
      />
    </div>
  );
}
```

### Opción 2: Usar el Hook Directamente

```tsx
import { use_address_book } from "@/hooks/use-address-book";

function MyComponent() {
  const { addresses, is_loading, add_address, delete_address, update_address } =
    use_address_book({
      wallet_address: "tu-wallet-aqui",
      auto_load: true, // Cargar automáticamente
    });

  return (
    <div>
      {is_loading ? (
        <p>Cargando...</p>
      ) : (
        <ul>
          {addresses.map((addr) => (
            <li key={addr.id} className="border p-2 mb-2 rounded">
              <strong>{addr.label}</strong>
              <p className="text-sm text-gray-500">{addr.recipient_address}</p>
              {addr.is_favorite && <span className="text-yellow-500">⭐</span>}
              <button
                onClick={() => delete_address(addr.id)}
                className="text-red-600 text-sm"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Opción 3: Solo Formulario de Agregar

```tsx
import { AddAddressForm } from "@/components/transfer/add-address-form";

export function AddAddressPage() {
  const handle_add = async (data: {
    recipient_address: string;
    label: string;
    description?: string;
    is_favorite?: boolean;
  }) => {
    console.log("Agregar dirección:", data);
    // Llamar a tu API o hook
  };

  return <AddAddressForm on_submit={handle_add} />;
}
```

---

## 📋 Ejemplos de Datos

### SavedAddress Completo

```typescript
{
  id: "clg1x2y3z4a5b6c7d8e9f0g1h",
  wallet_address: "11111111111111111111111111111112",
  recipient_address: "5HeGQfEAJgGXZUymFzSgKPnvKJsAWC1ZZ17KqX3FYQWH",
  label: "Mi Cuenta Principal",
  description: "Cartera para trading diario",
  is_favorite: true,
  created_at: "2024-12-16T09:00:00Z",
  updated_at: "2024-12-16T09:30:00Z"
}
```

---

## 🎨 Estilos Personalizados

### Cambiar color del modal

```tsx
<AddressBookModal
  wallet_address={wallet}
  is_open={is_open}
  on_close={close_handler}
  on_select={select_handler}
/>

// Agregar CSS personalizado
<style>{`
  [role="dialog"] {
    --primary: #3b82f6; /* Tu color primario */
  }
`}</style>
```

### Personalizar componentes

```tsx
// En AddressBookList
addresses.map((addr) => (
  <div key={addr.id} className="bg-gradient-to-r from-purple-50 to-blue-50 p-4">
    {/* Contenido personalizado */}
  </div>
));
```

---

## 🧪 Testing Rápido

```bash
# Ejecutar tests de validación
node apps/web/__tests__/simple-address-book-test.js

# Debería mostrar: ✓ Pruebas pasadas: 22
```

---

## 🐛 Troubleshooting Común

### P: El modal no se abre

**R:** Asegúrate de que `is_open={true}` y `on_close` está definido

### P: Las direcciones no cargan

**R:** Verifica que:

1. Backend está corriendo en puerto 3001
2. `wallet_address` es válida
3. Hay conexión a Internet

### P: Error "Invalid Solana Address"

**R:** La dirección debe cumplir con:

- 32-44 caracteres
- Solo caracteres base58: 1-9, A-Z (excepto O,I), a-z (excepto l)

### P: No veo mis cambios en la lista

**R:** El hook actualiza automáticamente, pero puedes forzar:

```tsx
const { load_addresses } = use_address_book(...);
await load_addresses(); // Recargar
```

---

## 📊 Performance Tips

1. **Paginación:** No cargar todas las direcciones

```tsx
const { addresses } = use_address_book({
  limit: 25, // No 50
  offset: 0,
});
```

2. **Memoización en componentes grandes:**

```tsx
const address_item = React.memo(({ address }) => (
  // Render
));
```

3. **Lazy load del modal:**

```tsx
const AddressBookModal = lazy(
  () => import("@/components/transfer/address-book-modal"),
);
```

---

## 🔐 Seguridad

✅ Validaciones en cliente (XSS)
✅ Validaciones en servidor (CSRF)
✅ Direcciones verificadas
✅ Sin almacenamiento de claves privadas
✅ HTTPS requerido en producción

---

## 📞 Soporte

- Documentación completa: [FRONTEND_ADDRESS_BOOK_IMPLEMENTATION.md](./FRONTEND_ADDRESS_BOOK_IMPLEMENTATION.md)
- Guía de integración: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- Ver código fuente en `apps/web/components/transfer/`

---

**Última actualización:** 16 de Diciembre, 2024
**Versión:** 1.0.0
**Estado:** ✅ Producción
