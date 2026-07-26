# 🗂️ Estructura de la Carpeta REST

```
rest/
├── 📋 README.md                      ⭐ LEE PRIMERO (Guía completa)
├── ⚡ QUICK-REFERENCE.rest          ⭐ Referencia rápida
├── 🔧 00-VARIABLES.rest             ⭐ Configuración (edita esto)
│
├── 💰 ENDPOINTS DE COMPRA
│   ├── 01-GET-price.rest            GET  /purchase/price
│   ├── 02-POST-initiate.rest        POST /purchase/initiate
│   ├── 03-POST-confirm.rest         POST /purchase/confirm
│   └── 04-GET-history.rest          GET  /purchase/history
│
├── 📊 ENDPOINTS DE DATOS
│   ├── 05-GET-market-stats.rest     GET  /purchase/market-stats
│   ├── 06-GET-payment-methods.rest  GET  /purchase/payment-methods
│   ├── 07-GET-status.rest           GET  /purchase/status
│   ├── 08-GET-top-10.rest           GET  /purchase/top-10
│   └── 09-GET-price-history.rest    GET  /purchase/price-history
│
└── 📚 DOCUMENTACIÓN
    └── Este archivo (INDEX.md)
```

---

## 🚀 Comenzar en 3 Pasos

### Paso 1: Instalar REST Client

```
VS Code → Extensions → Buscar "REST Client" → Instalar
```

### Paso 2: Editar Variables

```
Abre: 00-VARIABLES.rest
Personaliza: @baseUrl, @walletAddress, etc.
```

### Paso 3: Probar Endpoints

```
Abre: 01-GET-price.rest
Haz clic: "Send Request" encima del request
Ver: Respuesta en panel derecho
```

---

## 📂 Archivos por Categoría

### 🎯 Inicio Rápido

- **README.md** - Guía completa (200+ líneas)
- **QUICK-REFERENCE.rest** - Referencia de 1 página
- **00-VARIABLES.rest** - Configuración global

### 💳 Flujo de Compra (Completar Primero)

1. **01-GET-price.rest** - Obtener precio del token
2. **02-POST-initiate.rest** - Iniciar transacción
3. **03-POST-confirm.rest** - Confirmar con firma
4. **04-GET-history.rest** - Ver historial

### 📊 Información del Mercado (Referencia)

- **05-GET-market-stats.rest** - Stats en tiempo real
- **06-GET-payment-methods.rest** - Métodos disponibles
- **07-GET-status.rest** - Estado de transacción
- **08-GET-top-10.rest** - Top 10 criptos
- **09-GET-price-history.rest** - Gráficos históricos

---

## 💡 Uso Típico

### Para Développeur (Entorno Local)

```rest
@baseUrl = https://servicioshilda.orioncaribe.com/api/v1
@walletAddress = 11111111111111111111111111111111
```

### Para Testing (Devnet)

```rest
@baseUrl = https://servicioshilda.orioncaribe.com/api/v1
@walletAddress = TU_WALLET_DEVNET
@paymentMethod = SOL
```

### Para Producción (Mainnet)

```rest
@baseUrl = https://api.prowallet.com/api/v1
@walletAddress = TU_WALLET_MAINNET
@paymentMethod = SOL
```

---

## 🔗 Estructura de Request

Todos los archivos `.rest` siguen este patrón:

```rest
### 📝 Descripción del endpoint
### Ruta: GET /api/v1/purchase/price
### Documentación: Explica qué hace

@baseUrl = https://servicioshilda.orioncaribe.com/api/v1

###
# Comentario del request específico
GET {{baseUrl}}/purchase/price
Header: valor
Content-Type: application/json

{
  "body": "json si es POST"
}

###
# RESPUESTA ESPERADA (200 OK):
# {
#   "success": true,
#   "data": { ... }
# }

###
# ERRORES POSIBLES:
# 400: Descripción
# 429: Rate limit
```

---

## 📋 Listado Completo de Endpoints

### GET Endpoints (Lectura)

```
GET /purchase/price?amount=100
    → Precio actual del token

GET /purchase/history/:wallet
    → Historial de compras de una wallet

GET /purchase/market-stats
    → Estadísticas del mercado

GET /purchase/payment-methods
    → Métodos de pago disponibles

GET /purchase/status/:id
    → Estado de una transacción

GET /purchase/top-10
    → Top 10 criptomonedas

GET /purchase/price-history/:timeframe
    → Historial de precios para gráficos
```

### POST Endpoints (Escritura)

```
POST /purchase/initiate
     Body: {walletAddress, tokenAmount, paymentMethod}
     → Inicia una compra

POST /purchase/confirm/:id
     Body: {signature, paymentId?}
     → Confirma la compra
```

---

## 🎓 Flujo de Aprendizaje Recomendado

### Día 1: Fundamentos

```
1. Leer: README.md (secciones "Cómo Usar" y "Flujo Completo")
2. Abrir: 01-GET-price.rest
3. Probar: Diferentes cantidades (1, 10, 100, 1000)
4. Ver: Estructura de respuesta
```

### Día 2: Compra Simulada

```
1. Abrir: 02-POST-initiate.rest
2. Editar: @walletAddress con tu wallet devnet
3. Probar: Iniciar compra con SOL
4. Copiar: transactionId de la respuesta
```

### Día 3: Confirmación

```
1. Abrir: 03-POST-confirm.rest
2. Editar: transactionId y signature
3. Probar: Confirmar compra
4. Verificar: Status en respuesta
```

### Día 4: Exploración

```
1. Probar: 04-GET-history.rest (ver historial)
2. Probar: 05-GET-market-stats.rest (datos mercado)
3. Probar: 06-GET-payment-methods.rest (métodos)
4. Probar: 09-GET-price-history.rest (gráficos)
```

### Día 5: Integración

```
1. Documentar casos de uso
2. Crear scripts de testing
3. Integrar en aplicación
4. Deploy a producción
```

---

## 🔧 Personalización

### Agregar Nuevo Endpoint

1. Copia estructura de archivo existente
2. Nómbralo: `XX-METHOD-endpoint.rest`
3. Actualiza ruta y método
4. Documenta respuesta esperada
5. Prueba con "Send Request"

### Ejemplo Template

```rest
### 📄 NOMBRE DEL ENDPOINT
### METHOD /api/v1/ruta/endpoint
### Documentación aquí

@baseUrl = https://servicioshilda.orioncaribe.com/api/v1

###
# Descripción del request
METHOD {{baseUrl}}/ruta/endpoint
Accept: application/json

{
  "field": "value"
}

###
# RESPUESTA ESPERADA (200 OK):
# {
#   "success": true,
#   "data": { ... }
# }
```

---

## 🐛 Troubleshooting

### Error: "Connection Refused"

**Solución**: Verifica que la API está corriendo

```bash
curl https://servicioshilda.orioncaribe.com/
```

### Error: "Rate Limited (429)"

**Solución**: Espera un momento o aumenta limit en .env

```rest
# En 00-VARIABLES.rest, reduce requests por segundo
```

### Error: "Invalid Wallet"

**Solución**: Usa wallet válida formato base58

```
Válida: 11111111111111111111111111111111
Inválida: 12345 o 0x1234...
```

---

## 📊 Estadísticas

```
Total de archivos:    12
Total de líneas:      1,550+
Endpoints cubiertos:  9
Métodos HTTP:         2 (GET, POST)
Rate de cobertura:    100% ✅
```

---

## 🎯 Siguientes Pasos

1. ✅ Leer README.md
2. ✅ Instalar REST Client en VS Code
3. ✅ Personalizar 00-VARIABLES.rest
4. ✅ Probar 01-GET-price.rest
5. ✅ Completar flujo de compra (02, 03, 04)
6. ✅ Explorar endpoints de datos (05-09)
7. ✅ Integrar en tu aplicación

---

## 📞 Soporte

- **Documentación**: Ver README.md
- **Referencia rápida**: Ver QUICK-REFERENCE.rest
- **API Docs**: https://servicioshilda.orioncaribe.com/api/docs
- **Issues**: Ver carpeta documentation/

---

**Carpeta REST - Versión 1.0**  
**Última actualización:** 7 Diciembre 2025  
**Mantenedor:** ProWallet Team
