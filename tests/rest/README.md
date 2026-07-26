# ProWallet API - REST Tests

Colección completa de archivos REST para testear todos los endpoints de la API ProWallet.

## 📁 Estructura de Archivos

```
tests/rest/
├── 00-variables.rest           # Variables globales y configuración
├── 01-health.rest              # Health check endpoints
├── 02-auth.rest                # Autenticación y login
├── 03-purchase.rest            # Compra de tokens
├── 04-exchange.rest            # Intercambio y pricing
├── 05-prowallet.rest           # Información del contrato
├── 06-transfer.rest            # Transferencias entre wallets
├── 07-notifications.rest       # Notificaciones del usuario
├── 08-solana-proxy.rest        # Proxy directo a Solana RPC
├── 09-webhooks.rest            # Webhooks de pago
├── 10-admin.rest               # Endpoints administrativos
└── README.md                    # Este archivo
```

## 🚀 Instalación

### Requisitos

- **VS Code** (recomendado) con extensión **REST Client**
  - ID: `humao.rest-client`
  - Instalar: Ctrl+Shift+X → Buscar "REST Client" → Install

### Alternativas

- **Postman** - Importar colecciones manualmente
- **curl** - Copiar los comandos desde los archivos .rest
- **Insomnia** - Importar archivos .rest

## 📝 Uso Rápido

### En VS Code (REST Client)

1. Abre cualquier archivo `.rest`
2. Verás botones "Send Request" sobre cada endpoint
3. Haz clic para ejecutar
4. La respuesta aparecerá en un panel lateral

### Desde CLI (curl)

```bash
# Health check
curl https://servicioshilda.orioncaribe.com/api/v1/health

# Obtener precio del SOL
curl https://servicioshilda.orioncaribe.com/api/v1/exchange/solPriceCached

# Listar whitelist
curl https://servicioshilda.orioncaribe.com/api/v1/prowallet/whitelist
```

## 🔐 Autenticación

### Variables de Token

Edita `00-variables.rest` para agregar tus tokens:

```
@accessToken = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
@refreshToken = your_refresh_token_here
```

### Obtener Token

1. Ejecuta POST `/auth/login` con credenciales
2. Copia el `accessToken` de la respuesta
3. Pégalo en `00-variables.rest`

## 🧪 Casos de Uso Comunes

### 1. Verificar que la API está funcionando

```
Archivo: 01-health.rest
Endpoint: GET /health
Esperado: Status 200 OK
```

### 2. Login y obtener token

```
Archivo: 02-auth.rest
Pasos:
1. POST /auth/register (registrar nuevo usuario)
2. POST /auth/login (obtener token)
3. Copiar accessToken a 00-variables.rest
4. Usar token en endpoints protegidos
```

### 3. Comprar tokens GAPC

```
Archivo: 03-purchase.rest
Pasos:
1. GET /purchase/price (obtener precio actual)
2. POST /purchase/initiate (iniciar compra)
3. Firmar transacción con wallet
4. POST /purchase/confirm (confirmar compra)
5. GET /purchase/status (verificar estado)
```

### 4. Transferir tokens

```
Archivo: 06-transfer.rest
Pasos:
1. POST /transfer/initiate (iniciar transferencia)
2. Firmar transacción con wallet origen
3. POST /transfer/confirm (confirmar transferencia)
```

### 5. Obtener información del contrato

```
Archivo: 05-prowallet.rest
Endpoints:
- GET /prowallet/contract-info (información general)
- GET /prowallet/stats (estadísticas)
- GET /prowallet/holders (lista de tenedores)
- GET /prowallet/whitelist (wallets whitelisteadas)
```

## 📊 Configuración de Variables

Edita `00-variables.rest` para cambiar:

### Ambiente

```
@baseUrl = https://servicioshilda.orioncaribe.com/api/v1   # Producción
@localhost = http://localhost:3001/api/v1                  # API local directa
@docker = http://localhost:3005/api/v1                     # Docker Compose desde tu host
@api = https://servicioshilda.orioncaribe.com/api/v1       # Cambiar entre estos
```

### Wallets de Prueba

```
@testWallet = Tu_Wallet_Aqui
@companyWallet = EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH
@receiverWallet = Wallet_Destino
```

### Tokens

```
@tokenMint = D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3
@tokenSymbol = GAPC
@tokenName = ProWallet
```

## 🔍 Endpoints por Categoría

### 🏥 Health & System

- `GET /health` - Health check básico
- `GET /health/db` - Verificar BD
- `GET /health/redis` - Verificar Redis
- `GET /health/solana` - Verificar Solana

### 🔑 Autenticación

- `POST /auth/register` - Registrar usuario
- `POST /auth/login` - Login con credenciales
- `POST /auth/login-wallet` - Login con wallet Solana
- `GET /auth/me` - Datos del usuario actual
- `POST /auth/logout` - Cerrar sesión

### 💰 Compras

- `GET /purchase/price` - Precio actual
- `POST /purchase/initiate` - Iniciar compra
- `POST /purchase/confirm/:id` - Confirmar compra
- `GET /purchase/status/:id` - Estado de compra
- `GET /purchase/history/:wallet` - Histórico

### 💱 Exchange

- `GET /exchange/solPriceCached` - Precio SOL
- `GET /exchange/token-info` - Info del token
- `POST /exchange/withdraw` - Solicitar retiro
- `GET /exchange/rates` - Tasas de cambio

### 📦 Transferencias

- `POST /transfer/initiate` - Iniciar transferencia
- `POST /transfer/confirm/:id` - Confirmar transferencia
- `GET /transfer/history/:wallet` - Histórico

### 🪙 Contrato PROWALLET

- `GET /prowallet/contract-info` - Info del contrato
- `GET /prowallet/stats` - Estadísticas
- `GET /prowallet/holders` - Tenedores
- `GET /prowallet/whitelist` - Wallets whitelisteadas

### 🔔 Notificaciones

- `GET /notifications` - Obtener notificaciones
- `POST /notifications/:id/read` - Marcar como leído
- `DELETE /notifications/:id` - Eliminar notificación

### 🔗 Solana RPC Proxy

- `POST /solana/rpc` - Proxy a métodos RPC de Solana

## ⚠️ Errores Comunes

### 401 Unauthorized

**Problema**: Token no válido o expirado
**Solución**:

- Ejecuta POST `/auth/login` nuevamente
- Actualiza `@accessToken` en `00-variables.rest`

### 404 Not Found

**Problema**: Endpoint no existe o dirección incorrecta
**Solución**:

- Verifica que `@api` tiene la URL correcta
- Revisa la ruta en el archivo .rest

### 500 Internal Server Error

**Problema**: Error en la API
**Solución**:

- Verifica que la API está corriendo (GET `/health`)
- Revisa los logs de la API: `docker compose logs api`
- Asegúrate de enviar datos válidos

### 429 Too Many Requests

**Problema**: Límite de rate limiting alcanzado
**Solución**:

- Espera 15 minutos (ventana de rate limiting)
- Revisa `RATE_LIMIT_MAX_REQUESTS` en Dockerfile

## 🛠️ Debugging

### Ver todas las variables

En REST Client, presiona Ctrl+Shift+P:

- Busca "REST Client: Show Request Body"
- Muestra el request final con variables expandidas

### Ver response headers

Expande la sección "Response Headers" en la pestaña de respuesta

### Ver tiempos de respuesta

Los tiempos aparecen en la pestaña de respuesta:

```
Response time: 234ms
```

## 📚 Recursos Adicionales

### Documentación de la API

- [Swagger/OpenAPI](https://servicioshilda.orioncaribe.com/api-docs)
- [Postman Collection](./postman-collection.json) (si disponible)

### Solana

- [Solana Docs](https://docs.solana.com)
- [Web3.js Reference](https://github.com/solana-labs/solana-web3.js)
- [RPC Methods](https://docs.solana.com/api/http)

### Herramientas

- [REST Client para VS Code](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
- [Postman](https://www.postman.com)
- [Insomnia](https://insomnia.rest)

## 💡 Tips

### 1. Usar variables en path

```rest
GET {{@api}}/purchase/status/{{@transactionId}}
```

### 2. Usar variables en body

```json
{
  "walletAddress": "{{@testWallet}}",
  "amount": "{{@purchaseAmount}}"
}
```

### 3. Guardar respuesta en variable

Agrega esta línea después de un request exitoso:

```rest
@accessToken = <response: body $.accessToken>
```

### 4. Múltiples requests encadenados

Los archivos pueden contener múltiples requests. Cada uno se ejecuta independientemente.

## 🤝 Contribuir

Para agregar nuevos tests:

1. Crea un archivo: `NN-modulo.rest` (NN = número secuencial)
2. Sigue el formato de los archivos existentes
3. Documenta cada endpoint con comentarios
4. Incluye ejemplos de request/response
5. Actualiza este README

## 📄 Licencia

Parte del proyecto ProWallet

---

**Última actualización**: Diciembre 2024
**Versión**: 1.0.0
**Estado**: Production Ready
