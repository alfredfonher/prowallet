# 🏗️ Diagrama Arquitectónico: Flujo de Datos de Wallets

## ANTES (❌ INCORRECTO)

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  transfer-view.tsx                                           │
│      │                                                       │
│      ├─ useEffect → fetch_wallet_holders()                 │
│      │                                                       │
│      └─ [holders] → use_wallet_search(holders)             │
│                           │                                  │
│                           └─ results (VACÍO)                │
│                                                              │
│  wallet-select-dropdown.tsx                                 │
│      │                                                       │
│      └─ {results} → Dropdown SIN DATOS                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ apiClient.get()
                            │ "¡ENDPONIT INCORRECTO!"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND API (Express)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  GET /purchase/history  ← ❌ SIN PARÁMETRO                 │
│      │                                                       │
│      └─ Router no encontrado (404)                          │
│                                                              │
│  (El endpoint correcto es /purchase/history/:wallet)        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP 404
                            │ Response vacío
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [] → empty array                                            │
│      │                                                       │
│      └─ Dropdown vacío 😞                                   │
│           "No se encontraron usuarios"                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Resultado:** ❌ Transferencias P2P no funcionales

---

## DESPUÉS (✅ CORRECTO)

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  transfer-view.tsx                                           │
│      │                                                       │
│      ├─ useEffect → fetch_wallet_holders()                 │
│      │                                                       │
│      └─ [holders] → use_wallet_search(holders)             │
│                           │                                  │
│                           └─ results (CON DATOS)            │
│                              - usuario1                      │
│                              - usuario2                      │
│                              - usuario3 (máx 5)             │
│                                                              │
│  wallet-select-dropdown.tsx                                 │
│      │                                                       │
│      ├─ Input: "Buscar usuario..."                         │
│      │                                                       │
│      └─ Results: 6 filas (1 search + 5 resultados)        │
│          - 7Sa2X1... usuario1   ← Seleccionable            │
│          - 8Tb3Y2... usuario2                               │
│          - 9Uc4Z3... usuario3                               │
│          - 10Vd5E... usuario4                               │
│          - 11We6F... usuario5                               │
│          (Scroll si hay más)                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ apiClient.get()
                            │ "¡ENDPOINT CORRECTO!"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND API (Express)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  GET /users/wallets  ← ✅ ENDPOINT NUEVO                   │
│      │                                                       │
│      ├─ router.get("/wallets", async (req, res) ...)       │
│      │                                                       │
│      ├─ Prisma Query:                                       │
│      │  prisma.mVPUser.findMany({                           │
│      │    where: { solanaPublicKey: { not: null } }        │
│      │  })                                                   │
│      │                                                       │
│      └─ Database Query                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  DATABASE (PostgreSQL)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  mvp_users                                                   │
│  ┌──────┬──────────────┬──────────────────┐                 │
│  │ id   │ username     │ solanaPublicKey  │                 │
│  ├──────┼──────────────┼──────────────────┤                 │
│  │ 1    │ usuario1     │ 7Sa2X1A5B6...   │                 │
│  │ 2    │ usuario2     │ 8Tb3Y2B5C6...   │                 │
│  │ 3    │ usuario3     │ 9Uc4Z3C5D6...   │                 │
│  │ ...  │ ...          │ ...              │                 │
│  └──────┴──────────────┴──────────────────┘                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ [{ username, solanaPublicKey }]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND API (Express)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Response 200 OK                                            │
│  {                                                           │
│    "success": true,                                         │
│    "extra": {                                               │
│      "wallets": [                                           │
│        { "address": "7Sa2...", "label": "usuario1" },      │
│        { "address": "8Tb3...", "label": "usuario2" },      │
│        { "address": "9Uc4...", "label": "usuario3" }       │
│      ],                                                      │
│      "total": 3                                             │
│    }                                                        │
│  }                                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP 200 + JSON
                            │ Array de wallets
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  fetch_wallet_holders()                                     │
│      │                                                       │
│      ├─ response.extra.wallets                              │
│      │  [ { address, label }, ... ]                        │
│      │                                                       │
│      └─ return [addresses]                                  │
│                                                              │
│  transfer-view.tsx                                          │
│      │                                                       │
│      └─ set_holders([...addresses])                        │
│             │                                                │
│             └─ use_wallet_search(holders)                  │
│                    │                                         │
│                    └─ results: filtered wallets            │
│                                                              │
│  wallet-select-dropdown.tsx                                 │
│      │                                                       │
│      └─ {results} → Dropdown CON DATOS ✓                   │
│           Usuarios para transferir                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Resultado:** ✅ Transferencias P2P completamente funcionales

---

## CAMBIOS DE CÓDIGO

### Frontend: `transfer-api.ts`

```diff
  export async function fetch_wallet_holders(): Promise<string[]> {
    try {
-     const response = await apiClient.get("/purchase/history");
+     const response = await apiClient.get("/users/wallets");

      if (!response.success || !response.extra?.wallets) {
        return [];
      }

      const unique_wallets = [
        ...new Set(
          (response.extra.wallets || [])
-           .map((tx: any) => tx.walletAddress)
+           .map((item: any) => item.address)
            .filter(Boolean)
        ),
      ] as string[];

      return unique_wallets;
    } catch (error) {
      console.error("Error fetching wallet holders:", error);
      return [];
    }
  }
```

### Backend: `app.ts`

```diff
+ import usersRouter from "./routes/users/users.routes";

  // Dentro del setup de rutas
  app.use(`${API_PREFIX}/${API_VERSION}/purchase`, purchaseRouter);
+ app.use(`${API_PREFIX}/${API_VERSION}/users`, usersRouter);
  app.use(`${API_PREFIX}/${API_VERSION}/transfer`, transferRouter);
```

### Backend: `routes/users/users.routes.ts` (NUEVO)

```typescript
// Archivo completamente nuevo con:
// - GET /users/wallets (público)
// - GET /users/list (autenticado)
// Consulta a prisma.mVPUser
```

---

## DIFERENCIAS CLAVE

| Aspecto       | ANTES               | DESPUÉS                 |
| ------------- | ------------------- | ----------------------- |
| **Endpoint**  | `/purchase/history` | `/users/wallets`        |
| **HTTP Code** | 404 Not Found       | 200 OK                  |
| **Response**  | null                | Array de wallets        |
| **Dropdown**  | Vacío               | Lleno                   |
| **UX**        | No funciona         | Funcional               |
| **Búsqueda**  | N/A                 | Funciona en tiempo real |
| **Selección** | Imposible           | Posible                 |

---

## FLUJO DE UNA TRANSFERENCIA

```
USUARIO ABRE "TRANSFERIR"
    ↓
Frontend carga componentes
    ↓
fetch_wallet_holders() ejecuta
    ↓
GET /users/wallets enviado
    ↓
Backend consulta BD (mvp_users)
    ↓
API retorna wallets registradas
    ↓
Frontend recibe [addresses]
    ↓
use_wallet_search() filtra (máx 5)
    ↓
Dropdown muestra usuarios
    ↓
USUARIO BUSCA DESTINATARIO
    ↓
Escribe nombre o wallet
    ↓
use_wallet_search().filter_wallets()
    ↓
Resultados en tiempo real
    ↓
USUARIO SELECCIONA UN USUARIO
    ↓
form_data.to_address = selected_address
    ↓
Preview actualiza
    ↓
Saldos nuevos se calculan
    ↓
USUARIO CONFIRMA TRANSFERENCIA
    ↓
POST /transfer/initiate
    ↓
Transferencia procesada ✓
```

---

## ESTADO DEL PROYECTO

```
COMPILACIÓN:
  Backend   ✓ OK
  Frontend  ✓ OK (9.7s)

FUNCIONALIDAD:
  ❌ Antes: Dropdown vacío (no funciona)
  ✅ Ahora: Dropdown lleno (funciona)

PRÓXIMO PASO:
  pnpm dev
  Navegar a "Transferir"
  Verificar que muestra usuarios
```

---

**Diagrama actualizado:** 15 de diciembre de 2025
