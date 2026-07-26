# 📚 Colección de Endpoints REST - ProWallet API

Bienvenido a la colección completa de archivos `.rest` para probar todos los endpoints de la API ProWallet.

## 🚀 Cómo Usar

### Requisitos

1. **Visual Studio Code** con extensión **REST Client**
   - Instalar: `ms-vscode.vscode-rest-client`
   - O ir a Extensions → Buscar "REST Client" → Instalar

2. **API corriendo localmente**
   ```bash
   cd /home/aprog93/Escritorio/prowallet/apps/api
   pnpm run dev
   ```

### Proceso

1. **Abre cualquier archivo `.rest`** en VS Code
2. **Edita las variables** en la sección `@variable = valor` según necesites
3. **Haz clic en "Send Request"** que aparece encima de cada request
4. **Ver respuesta** en el panel de la derecha

## 📁 Archivos Disponibles

### 00 - Variables Globales

**`00-VARIABLES.rest`**

- Configuración central de variables
- URLs, wallets, montos, etc.
- ⭐ **Edita esto primero**

### 01 - Obtener Precio del Token

**`01-GET-price.rest`**

- `GET /api/v1/purchase/price`
- Calcula precio actual del token
- Soporta múltiples cantidades

**Ejemplos:**

```
- Precio para 1 token
- Precio para 100 tokens (default)
- Precio para 1000 tokens
```

### 02 - Iniciar Compra

**`02-POST-initiate.rest`**

- `POST /api/v1/purchase/initiate`
- Inicia transacción de compra
- Múltiples métodos de pago

**Métodos soportados:**

```
- SOL (Solana nativo)
- USDC (Token estable)
- Stripe (Tarjeta de crédito)
- Coingate (Crypto alternativo)
```

### 03 - Confirmar Compra

**`03-POST-confirm.rest`**

- `POST /api/v1/purchase/confirm/:transactionId`
- Confirma transacción con firma
- Completa el flujo de compra

**Parámetros:**

```
- signature: Firma de blockchain
- paymentId: ID de pago (opcional)
```

### 04 - Historial de Compras

**`04-GET-history.rest`**

- `GET /api/v1/purchase/history/:walletAddress`
- Lista todas las compras de una wallet
- Soporta paginación y filtros

**Filtros disponibles:**

```
- status: pending, completed, failed
- paymentMethod: SOL, USDC, stripe, etc.
- sort: date_asc, date_desc, amount_asc, amount_desc
- startDate/endDate: Rango de fechas
```

### 05 - Estadísticas de Mercado

**`05-GET-market-stats.rest`**

- `GET /api/v1/purchase/market-stats`
- Datos actuales del mercado
- Precio, cap, volumen, etc.

**Datos incluidos:**

```
- current_price: Precio actual
- market_cap: Capitalización de mercado
- total_volume: Volumen 24h
- high_24h / low_24h: Rango de precios
- price_change_percentage_24h: % cambio
```

### 06 - Métodos de Pago

**`06-GET-payment-methods.rest`**

- `GET /api/v1/purchase/payment-methods`
- Todos los métodos disponibles
- Incluye límites, fees, configuración

**Incluye:**

```
- Métodos Fiat (tarjeta, transferencia)
- Criptomonedas (SOL, USDC)
- Proveedores alternativos (Coingate, NOWPayments)
- Transferencias nativas
```

### 07 - Estado de Transacción

**`07-GET-status.rest`**

- `GET /api/v1/purchase/status/:transactionId`
- Estado actual de una compra
- Monitoreo en tiempo real

**Estados posibles:**

```
- pending: Esperando firma
- processing: Procesando en blockchain
- completed: Completada
- failed: Falló
- expired: Expiró
```

### 08 - Top 10 Criptomonedas

**`08-GET-top-10.rest`**

- `GET /api/v1/purchase/top-10`
- Top 10 por capitalización de mercado
- Datos desde CoinGecko

**Información:**

```
- Bitcoin, Ethereum, Solana, etc.
- Precios, market cap, volumen
- Cambios 24h y 7 días
```

### 09 - Historial de Precios

**`09-GET-price-history.rest`**

- `GET /api/v1/purchase/price-history/:timeframe`
- Datos históricos para gráficos
- Múltiples timeframes

**Timeframes:**

```
- 1h: Últimas 24 horas (por hora)
- 1d: Últimos 7 días (por día)
- 7d: Últimos 30 días (por día)
- 30d: Últimos 90 días (por día)
- 1y: Último año (por semana)
```

## 🔧 Configuración Inicial

### Paso 1: Editar Variables Globales

Abre `00-VARIABLES.rest` y personaliza:

```rest
@baseUrl = https://servicioshilda.orioncaribe.com/api/v1        # URL base
@walletAddress = TU_WALLET_ADDRESS             # Tu wallet Solana
@tokenAmount = 100                              # Cantidad de tokens
@paymentMethod = SOL                            # Método de pago
```

### Paso 2: Seleccionar Request

Cada archivo tiene múltiples requests. Haz clic en **"Send Request"** encima del request que quieras probar.

### Paso 3: Ver Respuesta

La respuesta aparecerá en el panel derecho con:

- Status code (200, 400, 429, etc.)
- Headers de respuesta
- Body (JSON formateado)
- Tiempo de respuesta

## 📝 Estructura de un Request

```rest
### Descripción del request
### Ruta del endpoint
### Documentación

@variable = valor

###
# Descripción del request específico
METHOD {{baseUrl}}/ruta
Header: valor
Content-Type: application/json

{
  "body": "json"
}

###
# RESPUESTA ESPERADA (200 OK):
# {...}

###
# ERRORES POSIBLES:
# 400: Descripción
# 429: Rate limit
```

## 🔐 Seguridad

### Variables Sensibles

**⚠️ IMPORTANTE**: NO subas archivos `.rest` con datos sensibles a Git

Variables a proteger:

- Wallets privadas
- API keys
- Signatures reales
- Payment IDs

### Uso en Desarrollo

Para desarrollo local, está bien dejar valores de ejemplo:

```rest
@walletAddress = 11111111111111111111111111111111
@signature = 4UVJ9k7c9V8K2m5X9p2N3Q4R5S6T7U8V9W0X1Y2Z3...
```

## 🧪 Flujo Completo de Testing

### Prueba 1: Obtener Precio

```
1. Abre: 01-GET-price.rest
2. Haz clic en primer "Send Request"
3. Verifica respuesta con estructura esperada
```

### Prueba 2: Iniciar Compra

```
1. Abre: 02-POST-initiate.rest
2. Edita @walletAddress si es necesario
3. Haz clic en "Send Request"
4. Copia el transactionId de la respuesta
```

### Prueba 3: Confirmar Compra

```
1. Abre: 03-POST-confirm.rest
2. Reemplaza @transactionId con el del paso anterior
3. Edita @signature con firma real (o dummy para test)
4. Haz clic en "Send Request"
```

### Prueba 4: Ver Historial

```
1. Abre: 04-GET-history.rest
2. Edita @walletAddress con tu wallet
3. Haz clic en "Send Request"
4. Verifica compras anteriores
```

## 📊 Respuestas Estándar

### Éxito (200 OK)

```json
{
  "success": true,
  "code": 200,
  "message": "Operación exitosa",
  "data": {
    /* datos */
  }
}
```

### Error de Validación (400)

```json
{
  "success": false,
  "code": 400,
  "message": "Parámetros inválidos",
  "errors": [
    {
      "field": "walletAddress",
      "message": "Wallet inválida"
    }
  ]
}
```

### Rate Limited (429)

```json
{
  "success": false,
  "code": 429,
  "message": "Demasiadas peticiones",
  "retryAfter": 60
}
```

### Error Interno (500)

```json
{
  "success": false,
  "code": 500,
  "message": "Error interno del servidor",
  "requestId": "abc123xyz"
}
```

## 💡 Tips y Trucos

### Multi-Request en el Mismo Archivo

Puedes tener múltiples requests separados por `###`:

```rest
### Request 1
GET https://servicioshilda.orioncaribe.com/api/v1/purchase/price?amount=1

###
### Request 2 (diferente)
GET https://servicioshilda.orioncaribe.com/api/v1/purchase/price?amount=10

###
### Request 3 (POST)
POST https://servicioshilda.orioncaribe.com/api/v1/purchase/initiate
```

### Reutilizar Respuesta Anterior

En VS Code REST Client, puedes usar variables dinámicas:

```rest
###
@transactionId = 123e4567-e89b-12d3-a456-426614174000

###
POST https://servicioshilda.orioncaribe.com/api/v1/purchase/confirm/{{transactionId}}
```

### Environment Files

Para múltiples ambientes (dev, staging, prod):

Crea `.env.rest`:

```rest
@devUrl = https://servicioshilda.orioncaribe.com/api/v1
@stagingUrl = https://staging-api.prowallet.com/api/v1
@prodUrl = https://api.prowallet.com/api/v1
```

Luego usa: `@baseUrl = https://servicioshilda.orioncaribe.com/api/v1`

### Debugging

Si tienes problemas:

1. **Verifica que la API está corriendo**

   ```bash
   curl https://servicioshilda.orioncaribe.com/
   ```

2. **Revisa los logs**

   ```bash
   tail -f apps/api/logs/prowallet-api.log
   ```

3. **Prueba endpoint simple**
   ```rest
   GET https://servicioshilda.orioncaribe.com/
   ```

## 📚 Referencias

### REST Client Docs

- [MS REST Client Extension](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)

### ProWallet API Docs

- Swagger: `https://servicioshilda.orioncaribe.com/api/docs`
- Ver documento: `ANALISIS_COMPARATIVO_COMPRA_TOKENS.md`

### Ejemplos de Wallet Solana

- [Solana CLI](https://docs.solana.com/cli)
- Devnet faucet: `solana airdrop 2`

## ❓ Preguntas Frecuentes

**P: ¿Qué es `.rest`?**
A: Formato estándar para archivos REST Client. Similar a Postman pero basado en VS Code.

**P: ¿Puedo usar Postman?**
A: Sí, pero necesitas importar manualmente. Los archivos `.rest` son más fáciles para Git.

**P: ¿Cómo agrego nuevos endpoints?**
A: Copia estructura de uno existente y adapta la ruta, método y body.

**P: ¿Se ejecutan los scripts en orden?**
A: No automáticamente. Haz clic en cada "Send Request" individualmente.

**P: ¿Dónde veo el historial de requests?**
A: En el panel "Timeline" de REST Client (lado derecho).

## 🎯 Próximos Pasos

1. ✅ Abre VS Code
2. ✅ Instala REST Client extension
3. ✅ Abre `00-VARIABLES.rest` y personaliza
4. ✅ Comienza con `01-GET-price.rest`
5. ✅ Sigue el flujo de testing
6. ✅ Prueba todos los endpoints

---

**Versión:** 1.0  
**Última actualización:** 7 Diciembre 2025  
**Mantenedor:** ProWallet Team
