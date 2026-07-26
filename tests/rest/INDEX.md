# ProWallet API - REST Tests - Quick Index

Índice rápido de todos los endpoints y archivos disponibles.

## 📑 Índice Rápido por Archivo

### Configuración

| Archivo                | Contenido                        | Tamaño |
| ---------------------- | -------------------------------- | ------ |
| `00-variables.rest`    | Variables globales, tokens, URLs | 3.3 KB |
| `setup-rest-client.sh` | Script de instalación automática | 6.2 KB |

### Endpoints por Módulo

#### 🏥 Health (Archivo: 01-health.rest)

```
GET /health                    - Health check básico
GET /health/db                 - Verificar PostgreSQL
GET /health/redis              - Verificar Redis
GET /health/solana             - Verificar Solana RPC
GET /health/full               - Check completo
```

#### 🔑 Auth (Archivo: 02-auth.rest)

```
POST   /auth/register          - Registrar usuario
POST   /auth/login             - Login con credenciales
POST   /auth/login-wallet      - Login con firma Solana
GET    /auth/challenge/:pk     - Obtener challenge
GET    /auth/me                - Datos del usuario
POST   /auth/logout            - Cerrar sesión
POST   /auth/refresh           - Renovar token
POST   /auth/verify            - Verificar token
```

#### 💰 Purchase (Archivo: 03-purchase.rest)

```
GET    /purchase/price                 - Precio actual del token
POST   /purchase/initiate              - Iniciar compra
POST   /purchase/confirm/:transactionId - Confirmar compra
GET    /purchase/status/:transactionId  - Estado de compra
GET    /purchase/history/:wallet       - Histórico de compras
GET    /purchase/payment-methods       - Métodos disponibles
GET    /purchase/market-stats          - Estadísticas del mercado
```

#### 💱 Exchange (Archivo: 04-exchange.rest)

```
GET    /exchange/solPriceCached        - Precio SOL en caché
GET    /exchange/token-info            - Información del token
GET    /exchange/liquidity             - Datos de liquidez
POST   /exchange/swap                  - Intercambiar tokens
POST   /exchange/withdraw              - Solicitar retiro
GET    /exchange/withdraw/status/:id   - Estado de retiro
GET    /exchange/rates                 - Tasas de cambio
GET    /exchange/volume                - Volumen de trading
GET    /exchange/config                - Configuración
```

#### 📦 Transfer (Archivo: 06-transfer.rest)

```
POST   /transfer/initiate              - Iniciar transferencia
POST   /transfer/confirm/:transactionId - Confirmar transferencia
GET    /transfer/status/:transactionId  - Estado de transferencia
GET    /transfer/history/:wallet       - Histórico de transferencias
```

#### 🪙 ProWallet (Archivo: 05-prowallet.rest)

```
GET    /prowallet/contract-info        - Información del contrato
GET    /prowallet/whitelist            - Lista de whitelist
GET    /prowallet/whitelist/:wallet    - Verificar whitelist
GET    /prowallet/stats                - Estadísticas globales
GET    /prowallet/holders              - Lista de tenedores
GET    /prowallet/holder/:wallet       - Info de tenedor
GET    /prowallet/transfers            - Transferencias recientes
GET    /prowallet/transfers/:wallet    - Transferencias de wallet
```

#### 🔔 Notifications (Archivo: 07-notifications.rest)

```
GET    /notifications                  - Obtener notificaciones
GET    /notifications/unread           - Contar no leídas
POST   /notifications/:id/read         - Marcar como leída
POST   /notifications/read-all         - Marcar todas leídas
DELETE /notifications/:id              - Eliminar notificación
DELETE /notifications                  - Eliminar todas
POST   /notifications/subscribe        - Cambiar suscripción
GET    /notifications/preferences      - Preferencias
```

#### 🔗 Solana RPC Proxy (Archivo: 08-solana-proxy.rest)

```
POST   /solana/rpc                     - Proxy a Solana RPC
   - getBalance
   - getSlot
   - getTokenAccountBalance
   - getTransaction
   - getSignatureStatuses
   - getAccountInfo
   - getTokenAccountsByOwner
   - getMinimumBalanceForRentExemption
```

#### 🔐 Admin (Archivo: 10-admin.rest)

```
GET    /admin/metadata/api             - Metadatos de API
GET    /admin/metadata/endpoints       - Lista de endpoints
GET    /admin/metadata/contract        - Metadatos del contrato
GET    /admin/stats                    - Estadísticas globales
GET    /admin/system-health            - Salud del sistema
POST   /admin/maintenance-mode         - Modo mantenimiento
GET    /admin/logs                     - Logs del sistema
POST   /admin/cache/clear              - Limpiar caché
```

#### 📨 Webhooks (Archivo: 09-webhooks.rest)

```
POST   /payments/webhook               - Webhook de pagos
   - payment.confirmed
   - payment.failed
   - payment.refunded
   - transaction.status
```

---

## 🎯 Casos de Uso por Archivo

### Archivo: 11-scenarios.rest (Flujos Complejos)

| Scenario | Descripción               | Pasos |
| -------- | ------------------------- | ----- |
| 1        | Registro y login completo | 3     |
| 2        | Login con firma Solana    | 2     |
| 3        | Flujo completo de compra  | 5     |
| 4        | Flujo de transferencia    | 2     |
| 5        | Flujo de retiro           | 3     |
| 6        | Consulta de precios       | 5     |
| 7        | Estadísticas del contrato | 6     |
| 8        | Gestión de notificaciones | 5     |
| 9        | Manejo de errores         | 5     |
| 10       | Tests de carga            | 3     |

---

## 🚀 Inicio Rápido por Caso de Uso

### "Quiero verificar que la API funciona"

```
→ Archivo: 01-health.rest
→ Requests: GET /health, /health/full
→ Tiempo: 30 segundos
```

### "Quiero obtener el precio de SOL"

```
→ Archivo: 04-exchange.rest
→ Request: GET /exchange/solPriceCached
→ Tiempo: 10 segundos
```

### "Quiero obtener información del token"

```
→ Archivo: 05-prowallet.rest
→ Requests: GET /prowallet/contract-info, /prowallet/stats
→ Tiempo: 1 minuto
```

### "Quiero comprar tokens"

```
→ Archivo: 03-purchase.rest (después 11-scenarios.rest)
→ Pasos: Obtener precio → Iniciar → Confirmar
→ Tiempo: 5 minutos
→ Requiere: Token JWT válido, Wallet real
```

### "Quiero transferir tokens"

```
→ Archivo: 06-transfer.rest (después 11-scenarios.rest)
→ Pasos: Iniciar → Confirmar
→ Tiempo: 3 minutos
→ Requiere: Token JWT válido, 2 Wallets
```

### "Quiero testear todo"

```
→ Archivo: 11-scenarios.rest
→ Pasos: Todos los escenarios
→ Tiempo: 30 minutos
→ Requiere: Configuración completa
```

---

## 📚 Documentación por Tema

### Instalación & Setup

- **Archivo**: README.md
- **Secciones**: Instalación, Requisitos, Setup inicial

### Configuración

- **Archivo**: CONFIGURATION.md
- **Secciones**: Ambientes, Variables, Multi-environment

### Problemas & Debugging

- **Archivo**: TROUBLESHOOTING.md
- **Secciones**: Errores, Soluciones, Debug mode

### Quick Reference

- **Archivo**: Este archivo (INDEX.md)
- **Secciones**: Índice, Endpoints, Casos de uso

---

## 🔍 Búsqueda Rápida

### Por HTTP Method

| Método | Cantidad | Ejemplos                                                  |
| ------ | -------- | --------------------------------------------------------- |
| GET    | 45+      | `/health`, `/purchase/price`, `/prowallet/stats`          |
| POST   | 25+      | `/auth/login`, `/purchase/initiate`, `/transfer/initiate` |
| PUT    | 5+       | Actualizaciones                                           |
| DELETE | 5+       | Eliminar notificaciones                                   |

### Por Autenticación

| Tipo                       | Ejemplos                                                        |
| -------------------------- | --------------------------------------------------------------- |
| Público (sin JWT)          | `/health`, `/exchange/solPriceCached`, `/prowallet/contract-info` |
| Protegido (requiere JWT)   | `/auth/me`, `/purchase/confirm`, `/notifications`               |
| Admin (requiere admin JWT) | `/admin/stats`, `/admin/logs`                                   |

### Por Categoría

| Categoría                | Endpoints | Archivo        |
| ------------------------ | --------- | -------------- |
| Lectura (Safe)           | 45+       | Todos          |
| Escritura (Cuidado)      | 20+       | 02, 03, 04, 06 |
| Blockchain (Muy cuidado) | 10+       | 03, 04, 06     |

---

## 🎮 Atajos de Teclado (REST Client en VS Code)

| Acción                       | Atajo                                |
| ---------------------------- | ------------------------------------ |
| Ejecutar request             | `Ctrl+Alt+R` o click "Send Request"  |
| Ver request body             | `Ctrl+Shift+P` → "Show Request Body" |
| Plegar todas las secciones   | `Ctrl+K Ctrl+0`                      |
| Expandir todas las secciones | `Ctrl+K Ctrl+J`                      |

---

## 📊 Estadísticas de Cobertura

### Cobertura por Módulo

```
✅ Health:        4/4 endpoints (100%)
✅ Auth:          8/8 endpoints (100%)
✅ Purchase:      7/7 endpoints (100%)
✅ Exchange:      9/9 endpoints (100%)
✅ Transfer:      4/4 endpoints (100%)
✅ ProWallet:     8/8 endpoints (100%)
✅ Notifications: 8/8 endpoints (100%)
✅ Solana RPC:    8/8 endpoints (100%)
✅ Webhooks:      4/4 endpoints (100%)
✅ Admin:         8/8 endpoints (100%)

Total:            78/78 endpoints (100%)
```

---

## 🔗 Referencias Cruzadas

### Si necesitas autenticar:

→ Ver `02-auth.rest`

### Si necesitas obtener precio:

→ Ver `04-exchange.rest` (GET /exchange/solPriceCached)

### Si necesitas información del contrato:

→ Ver `05-prowallet.rest` (GET /prowallet/contract-info)

### Si necesitas hacer transacciones:

→ Ver `11-scenarios.rest` (flujos completos)

### Si tienes error:

→ Ver `TROUBLESHOOTING.md`

### Si necesitas cambiar ambiente:

→ Ver `CONFIGURATION.md`

---

## 💾 Estructura de Archivos

```
tests/rest/
├── 00-variables.rest           ← EDITAR AQUÍ (variables)
├── 01-health.rest              ← EMPEZAR AQUÍ (health checks)
├── 02-auth.rest                ← Para autenticarse
├── 03-purchase.rest            ← Comprar tokens
├── 04-exchange.rest            ← Intercambio
├── 05-prowallet.rest           ← Info del contrato
├── 06-transfer.rest            ← Transferencias
├── 07-notifications.rest       ← Notificaciones
├── 08-solana-proxy.rest        ← RPC directo
├── 09-webhooks.rest            ← Webhooks
├── 10-admin.rest               ← Admin
├── 11-scenarios.rest           ← Flujos completos
├── 12-quick-start.rest         ← 12 requests básicos
├── README.md                   ← Lectura obligatoria
├── CONFIGURATION.md            ← Setup por ambiente
├── TROUBLESHOOTING.md          ← Si hay errores
├── INDEX.md                    ← Este archivo
└── setup-rest-client.sh        ← Script de setup
```

---

## ✅ Checklist de Verificación

- [ ] VS Code instalado
- [ ] REST Client extension instalada
- [ ] Carpeta `tests/rest/` abierta en VS Code
- [ ] `00-variables.rest` editado con URL correcta
- [ ] `01-health.rest` devuelve 200 OK
- [ ] Token JWT obtenido (si necesario)
- [ ] `00-variables.rest` actualizado con token
- [ ] `12-quick-start.rest` completado exitosamente

---

## 🆘 Ayuda Rápida

**La API no responde**
→ Ver `TROUBLESHOOTING.md` - "Connection Refused"

**Error 401 Unauthorized**
→ Ver `TROUBLESHOOTING.md` - "401 Unauthorized"

**No encuentro un endpoint**
→ Ejecutar `GET /admin/metadata/endpoints`

**Necesito otra variable**
→ Editar `00-variables.rest` y agregar la variable

**Necesito un nuevo caso de uso**
→ Agregar a `11-scenarios.rest`

---

**Última actualización**: Diciembre 2024
**Versión**: 1.0.0
**Total de endpoints**: 78+
**Estado**: Production Ready
