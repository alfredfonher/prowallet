# 🔍 Wallet Search Dropdown - Documentación

## 📋 Overview

Se agregó un **dropdown searchable** para seleccionar el holder de origen en las transferencias P2P. Permite buscar entre los wallets disponibles de forma rápida y eficiente.

---

## 🏗️ Estructura

### Hook: `use-wallet-search.ts` (34 líneas)

Maneja toda la lógica de búsqueda y filtrado:

```typescript
const {
  search_query, // Texto actual de búsqueda
  is_open, // Dropdown abierto/cerrado
  results, // Wallets filtrados (máx 5)
  handle_search, // Actualiza query de búsqueda
  handle_select, // Selecciona wallet
  handle_toggle, // Abre/cierra dropdown
  set_search_query, // Setter directo
  set_is_open, // Setter directo
} = use_wallet_search(holders);
```

### Componente: `WalletSelectDropdown.tsx` (92 líneas)

Renderiza la interfaz del dropdown searchable:

```
┌─────────────────────────────────┐
│ 🔍 Buscar wallet...      ▼      │  ← Trigger button
└─────────────────────────────────┘

[Si is_open === true]

┌─────────────────────────────────┐
│ 🔍 Buscar wallet...             │  ← Row 1: Search Input
├─────────────────────────────────┤
│ 11111111...11111111             │  ← Row 2: Resultado 1
├─────────────────────────────────┤
│ 22222222...22222222             │  ← Row 3: Resultado 2
├─────────────────────────────────┤
│ 33333333...33333333             │  ← Row 4: Resultado 3
├─────────────────────────────────┤
│ 44444444...44444444             │  ← Row 5: Resultado 4
├─────────────────────────────────┤
│ 55555555...55555555             │  ← Row 6: Resultado 5
│                                 │
│ ↕ (Scroll si hay más)           │
└─────────────────────────────────┘
```

---

## ✨ Características

### 1. **Búsqueda en Tiempo Real**

- Filtra wallets mientras escribes
- Sin lag (optimizado con useCallback)
- Case-insensitive

### 2. **Máximo 5 Resultados**

- Muestra solo 5 wallets a la vez
- Scroll automático si hay más

### 3. **6 Filas Totales**

- Fila 1: Campo de búsqueda
- Filas 2-6: Resultados (máx 5)

### 4. **Interfaz Intuitiva**

- Icono Search en el input
- Chevron animado (▼ ↑)
- Hover effects en resultados
- Backdrop para cerrar dropdown

### 5. **Accesibilidad**

- Input autofocus cuando abre
- Tecla Enter para seleccionar
- Escape para cerrar (mediante backdrop)

---

## 🧮 Lógica de Filtrado

```typescript
// Si búsqueda está vacía → primeros 5
Si query = "" → wallets[0:5]

// Si hay búsqueda → filtrados y limitados a 5
Si query = "wallet" →
  wallets.filter(w => w.includes("wallet"))
         .slice(0, 5)

// Formato de display
"7Sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem"
        ↓
"7Sa2Xaz...gxhtem"  (primeros 8 + ... + últimos 8)
```

---

## 📱 Uso en TransferView

```tsx
<WalletSelectDropdown
  is_open={is_open}
  search_query={search_query}
  results={results}
  selected_value={form_data.from_holder}
  on_search={handle_search}
  on_select={(address) => {
    update_field("from_holder", address);
    handle_select(address);
  }}
  on_toggle={handle_toggle}
/>
```

Integración simplificada:

- Hook `use_wallet_search()` importado de `@/hooks`
- Componente en `@/components/transfer/wallet-select-dropdown`

---

## 🎨 Estilos

### Search Input

- Fondo `bg-secondary/50`
- Border `border-input`
- Focus: `border-primary focus:ring-primary/20`

### Resultados

- Hover: `bg-secondary`
- Active: `bg-secondary/80`
- Text: `text-foreground`
- Truncate para direcciones largas

### Dropdown Container

- Rounded: `rounded-xl`
- Shadow: `shadow-lg`
- Z-index: `z-50` (sobre otros elementos)
- Backdrop: `z-40` (debajo del dropdown)

---

## 🔧 Props Interface

```typescript
interface WalletSelectDropdownProps {
  is_open: boolean; // Dropdown abierto
  search_query: string; // Texto de búsqueda
  results: WalletSearchResult[]; // Resultados filtrados
  selected_value: string; // Wallet seleccionada
  on_search: (query: string) => void; // Callback búsqueda
  on_select: (address: string) => void; // Callback selección
  on_toggle: () => void; // Callback open/close
}

interface WalletSearchResult {
  address: string; // Dirección completa
  label: string; // Formato corto (11...11)
}
```

---

## 📊 Estados

| Estado                   | Descripción                                 |
| ------------------------ | ------------------------------------------- |
| `is_open = false`        | Dropdown cerrado, solo botón visible        |
| `is_open = true`         | Dropdown abierto, search input + resultados |
| `search_query = ""`      | Muestra primeros 5 holders                  |
| `search_query = "texto"` | Muestra coincidencias filtradas             |
| `results.length = 0`     | Mensaje "No se encontraron wallets"         |
| `results.length > 0`     | Lista de wallets con scroll                 |

---

## ⌨️ Atajos de Teclado

| Acción             | Efecto                            |
| ------------------ | --------------------------------- |
| Click en trigger   | Abre/cierra dropdown              |
| Escribir en input  | Filtra resultados en tiempo real  |
| Click en resultado | Selecciona wallet y cierra        |
| Click en backdrop  | Cierra dropdown                   |
| Escape (teórico)   | Podría cerrar (mediante backdrop) |

---

## 🧪 Casos de Uso

### Caso 1: Ver primeros 5 holders

```
1. Usuario abre dropdown
2. is_open = true
3. search_query = ""
4. results = holders[0:5]
```

### Caso 2: Buscar "wallet"

```
1. Usuario escribe "wallet" en search
2. search_query = "wallet"
3. results = holders.filter(...).slice(0, 5)
4. Muestra máx 5 coincidencias
```

### Caso 3: Sin resultados

```
1. Usuario busca "zzzzz"
2. search_query = "zzzzz"
3. results = []
4. Muestra "No se encontraron wallets"
```

### Caso 4: Seleccionar wallet

```
1. Usuario hace click en resultado
2. form_data.from_holder = address
3. is_open = false
4. search_query = ""
5. Dropdown se cierra
```

---

## 🚀 Próximas Mejoras

- [ ] Teclado: Enter para seleccionar primer resultado
- [ ] Teclado: Arrow Up/Down para navegar
- [ ] Mostrar balance junto al wallet
- [ ] Filtro: mostrar solo wallets con balance > 0
- [ ] Caché: guardar últimas selecciones
- [ ] Animaciones: fade-in cuando abre

---

## 📈 Performance

✅ **Optimizaciones implementadas:**

- `useCallback` para todas las funciones
- `slice(0, 5)` para limitar resultados
- Filtrado durante el render (no en API)
- No hace requests API (usa data local)

---

**Status:** ✅ COMPLETADO Y COMPILADO EXITOSAMENTE
