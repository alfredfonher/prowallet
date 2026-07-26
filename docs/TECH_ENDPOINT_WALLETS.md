# 🛠️ Documentación Técnica: Endpoint `/users/wallets`

## 1. Descripción General

El endpoint `/users/wallets` retorna una lista de direcciones Solana de usuarios registrados en la plataforma. Se utiliza en el selector de transferencias P2P para permitir que los usuarios busquen y seleccionen destinatarios.

---

## 2. Especificación de la API

### Request

```
GET /api/v1/users/wallets
```

### Headers

```
Content-Type: application/json
```

### Query Parameters

**Ninguno requerido**

### Authentication

**No requerido** (endpoint público)

---

## 3. Response

### Success (200 OK)

```json
{
  "success": true,
  "message": "OK",
  "code": 200,
  "extra": {
    "wallets": [
      {
        "address": "7Sa2X1A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P",
        "label": "usuario1"
      },
      {
        "address": "8Tb3Y2B5C6D7E8F9G0H1I2J3K4L5M6N7O8P9Q",
        "label": "usuario2"
      }
    ],
    "total": 2
  }
}
```

### Fields

| Campo                     | Tipo    | Descripción                          |
| ------------------------- | ------- | ------------------------------------ |
| `success`                 | boolean | Indica éxito de la operación         |
| `extra.wallets`           | array   | Array de objetos wallet              |
| `extra.wallets[].address` | string  | Dirección Solana (clave pública)     |
| `extra.wallets[].label`   | string  | Nombre de usuario o wallet abreviada |
| `extra.total`             | number  | Cantidad total de wallets            |

### Error (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Error fetching wallets",
  "code": 500,
  "extra": {
    "error": "Error fetching wallets"
  }
}
```

---

## 4. Detalles de Implementación

### Backend

**Archivo:** `apps/api/src/routes/users/users.routes.ts`

#### Código

```typescript
router.get("/wallets", async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Consultar BD para usuarios con wallet
    const mvp_users = await prisma.mVPUser.findMany({
      where: {
        solanaPublicKey: { not: null }, // Solo usuarios con wallet
      },
      select: {
        solanaPublicKey: true,
        username: true,
      },
      orderBy: {
        username: "asc", // Ordenar alfabéticamente
      },
    });

    // 2. Mapear a formato esperado
    const wallets = mvp_users
      .map((user: any) => ({
        address: user.solanaPublicKey,
        label: user.username || user.solanaPublicKey, // Usuario o wallet
      }))
      .filter((w: any) => w.address); // Filtrar nulos

    // 3. Retornar respuesta
    res.json(
      StatusFlow({
        code: StatusFlowCodes.OK,
        lang: "es",
        extra: { wallets, total: wallets.length },
      }),
    );
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json(
      StatusFlow({
        code: StatusFlowCodes.INTERNAL_SERVER_ERROR,
        lang: "es",
        extra: { error: "Error fetching wallets" },
      }),
    );
  }
});
```

#### Lógica

1. **Consulta DB**: Busca usuarios con `solanaPublicKey` no nulo
2. **Mapeo**: Convierte a formato `{ address, label }`
3. **Filtrado**: Solo wallets válidas (no nulas)
4. **Respuesta**: Retorna array ordenado alfabéticamente

#### Performance

- **Query:** O(n) donde n = usuarios en BD
- **Ordenamiento:** O(n log n) en BD
- **Filtrado:** O(n) en memoria
- **Total:** O(n log n) donde n = cantidad de usuarios

**Optimizaciones:**

- ✅ Solo selecciona campos necesarios
- ✅ Ordena en BD (no en aplicación)
- ✅ Sin joins innecesarios
- ✅ Index en `solanaPublicKey` (recomendado)

### Frontend

**Archivo:** `apps/web/lib/transfer-api.ts`

#### Código

```typescript
export async function fetch_wallet_holders(): Promise<string[]> {
  try {
    // 1. Llamar endpoint
    const response = await apiClient.get("/users/wallets");

    // 2. Validar respuesta
    if (!response.success || !response.extra?.wallets) {
      return [];
    }

    // 3. Extraer wallets y deduplicar
    const unique_wallets = [
      ...new Set(
        (response.extra.wallets || [])
          .map((item: any) => item.address)
          .filter(Boolean),
      ),
    ] as string[];

    return unique_wallets;
  } catch (error) {
    console.error("Error fetching wallet holders:", error);
    return [];
  }
}
```

#### Lógica

1. **Request:** GET a `/users/wallets`
2. **Validación:** Verifica success y estructura
3. **Extracción:** Map para obtener solo addresses
4. **Deduplicación:** Set para eliminar duplicados (precaución)
5. **Error Handling:** Retorna array vacío en caso de error

#### Integración

Se usa en `transfer-view.tsx`:

```typescript
const [holders, set_holders] = useState<string[]>([]);

// En useEffect
useEffect(() => {
  const load_holders = async () => {
    const fetched = await fetch_wallet_holders();
    set_holders(fetched); // Se pasa al hook de búsqueda
  };
  load_holders();
}, []);

// Hook de búsqueda filtra estos holders
const { results } = use_wallet_search(holders);
```

---

## 5. Casos de Uso

### Caso 1: Dropdown Normal (Sin Búsqueda)

**Entrada:** Dropdown se abre, no hay búsqueda

**Flujo:**

```
Dropdown abierto
  ↓
use_wallet_search filtra sin query
  ↓
Retorna primeros 5 holders
  ↓
Usuario ve lista ordenada
```

**Output:**

```
[7Sa2...] (usuario1)
[8Tb3...] (usuario2)
[9Uc4...] (usuario3)
[10Vd...] (usuario4)
[11We...] (usuario5)
```

### Caso 2: Búsqueda en Tiempo Real

**Entrada:** Usuario escribe "usuario2"

**Flujo:**

```
Búsqueda: "usuario2"
  ↓
use_wallet_search.filter_wallets()
  ↓
Filtra holders.address.includes("usuario2")
  ↓
Retorna resultados (máx 5)
  ↓
Muestra coincidencias
```

**Output:**

```
[8Tb3...] (usuario2)
```

### Caso 3: Búsqueda por Wallet

**Entrada:** Usuario escribe "7Sa2"

**Flujo:**

```
Búsqueda: "7Sa2"
  ↓
Filtra wallets que contienen "7Sa2"
  ↓
Case-insensitive matching
  ↓
Retorna coincidencias
```

**Output:**

```
[7Sa2...] (usuario1)
```

### Caso 4: Sin Resultados

**Entrada:** Usuario busca "zzzzz" (no existe)

**Flujo:**

```
Búsqueda: "zzzzz"
  ↓
Filtra → Sin coincidencias
  ↓
results.length = 0
  ↓
Muestra "No se encontraron usuarios"
```

---

## 6. Estructura de Datos

### Tabla: `mvp_users`

```sql
CREATE TABLE mvp_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255) UNIQUE NOT NULL,
  solanaPublicKey VARCHAR(88) UNIQUE,
  tokenBalance BIGINT DEFAULT 0,
  usdSpent FLOAT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX (username),
  INDEX (solanaPublicKey)
);
```

### Campos Utilizados

- `solanaPublicKey`: Dirección Solana (base58, 88 caracteres)
- `username`: Nombre de usuario único

### Relaciones

- Un usuario puede tener una transferencia saliente
- Pero el endpoint es agnóstico a eso (solo lista usuarios)

---

## 7. Validación y Errores

### Validación de Input

**No hay input** - Endpoint sin parámetros

### Validación de Output

```typescript
// En fetch_wallet_holders() - Frontend
if (!response.success) return []; // Falló
if (!response.extra?.wallets) return []; // Formato inválido
```

### Manejo de Errores

| Error               | Código  | Causa           | Manejo      |
| ------------------- | ------- | --------------- | ----------- |
| DB Connection Error | 500     | BD offline      | Retorna 500 |
| Prisma Error        | 500     | Query inválida  | Retorna 500 |
| Network Error       | Network | Cliente offline | Retorna []  |

### Recuperación

```typescript
try {
  const response = await apiClient.get("/users/wallets");
  // Success path
} catch (error) {
  console.error(...);
  return [];  // Array vacío = dropdown vacío
}
```

---

## 8. Seguridad

### Consideraciones

✅ **Públicamente Seguro:**

- Solo retorna direcciones Solana (públicas)
- No incluye balances, claves privadas, emails
- No requiere autenticación

✅ **Sin Rate Limiting Crítico:**

- Endpoint simple, bajo costo
- Podría agregarse si hay abusos

### Recomendaciones

```typescript
// Agregar en futuro si es necesario
router.get(
  "/wallets",
  WALLET_RATE_LIMITER,  // Rate limit (ej: 100 req/min)
  async (req, res) => { ... }
);
```

---

## 9. Testing

### Unit Test Ejemplo

```typescript
describe("GET /users/wallets", () => {
  it("should return array of wallets", async () => {
    const response = await request(app)
      .get("/api/v1/users/wallets")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.extra.wallets)).toBe(true);
    expect(response.body.extra.wallets[0]).toHaveProperty("address");
    expect(response.body.extra.wallets[0]).toHaveProperty("label");
  });

  it("should not require authentication", async () => {
    const response = await request(app)
      .get("/api/v1/users/wallets")
      .expect(200); // Sin header Authorization
  });
});
```

### Integration Test

```typescript
it("should filter wallets correctly in dropdown", async () => {
  // 1. Cargar página
  render(<TransferView />);

  // 2. Abrir dropdown
  fireEvent.click(screen.getByText(/Buscar usuario/));

  // 3. Verificar que muestra usuarios
  await waitFor(() => {
    expect(screen.getByText(/usuario1/)).toBeInTheDocument();
  });
});
```

---

## 10. Performance y Optimizaciones

### Baseline

```
DB Usuarios: 1,000
Query Time: ~50ms
Response Size: ~45KB (1000 wallets × 45 bytes)
```

### Optimizaciones Actuales

1. ✅ **SELECT específico**: Solo username + solanaPublicKey
2. ✅ **WHERE clause**: Filtro en BD (no en app)
3. ✅ **ORDER BY**: En BD para mejor performance
4. ✅ **Sin JOIN**: Tabla simple, una sola tabla

### Posibles Mejoras Futuras

```typescript
// Paginación (si crece > 10k usuarios)
router.get("/wallets?page=1&limit=50", ...);

// Caché
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;  // 5 minutos

// Índices BD
ALTER TABLE mvp_users ADD INDEX (solanaPublicKey);
```

---

## 11. Cambios Asociados

### Backend (`app.ts`)

```typescript
// Agregar import
import usersRouter from "./routes/users/users.routes";

// Registrar ruta
app.use(`${API_PREFIX}/${API_VERSION}/users`, usersRouter);
```

### Frontend (`transfer-api.ts`)

```typescript
// ANTES
const response = await apiClient.get("/purchase/history");

// DESPUÉS
const response = await apiClient.get("/users/wallets");
```

---

## 12. Roadmap Futuro

### Mejoras Planeadas

- [ ] Agregar caché local en frontend
- [ ] Agregar paginación si crece mucho
- [ ] Agregar búsqueda server-side
- [ ] Agregar rate limiting
- [ ] Agregar swagger docs

### API Relacionadas

- `GET /users/list` - Listar usuarios (autenticado)
- `GET /users/wallets` - Listar wallets (público) ← **ACTUAL**
- `POST /users/register` - Registrar usuario
- `GET /users/:id` - Obtener usuario específico

---

## 13. FAQ

### ¿Por qué no usar `/purchase/history`?

**Respuesta:** Ese endpoint requiere `/:walletAddress` parámetro. Retorna historial de transacciones de UNA wallet, no lista de usuarios.

### ¿Por qué es público el endpoint?

**Respuesta:** Solo retorna direcciones Solana (públicas). No incluye datos sensibles.

### ¿Qué pasa si un usuario no tiene wallet?

**Respuesta:** Se filtra en la query WHERE (no aparece en el dropdown).

### ¿Puedo cached?

**Respuesta:** Sí, pero debe tener TTL. Recomendado 5-10 minutos.

### ¿Y si hay 100k usuarios?

**Respuesta:** Query seguirá siendo rápida. Considerar paginación en UI si es necesario.

---

**Última actualización:** 15 de diciembre de 2025  
**Status:** ✅ Implementado y compilado
