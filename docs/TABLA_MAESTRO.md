# 📊 TABLA MAESTRO - Todas las Funciones Heredadas

**Para imprimir y llevar contigo como referencia**

---

## TABLA 1: FUNCIONES LEGACY (15 TOTALES)

| #   | Función                      | Legacy L# | Actual Status | Issue                | Ticket | Prioridad |
| --- | ---------------------------- | --------- | ------------- | -------------------- | ------ | --------- |
| 1   | `getCurrentPrice()`          | 50-107    | ✅ OK         | Ninguno              | -      | -         |
| 2   | `getPaymentMethods()`        | 118-170   | ✅ OK         | Verificar            | -      | 🟡        |
| 3   | `createAlternativePayment()` | 173-235   | ❓ Verificar  | Puede faltar         | -      | 🟡        |
| 4   | `initiatePurchase()`         | 236-374   | ✅ OK         | Metadata?            | -      | 🟡        |
| 5   | **`confirmPurchase()`**      | 375-527   | ❌ ROTO       | No registra mint_sig | #2     | 🔴        |
| 6   | **`settlePurchase()`**       | 528-611   | ❌ FALTA      | No existe endpoint   | #4     | 🔴        |
| 7   | `autoSettlePurchase()`       | 612-700   | ✅ OK         | Ninguno              | -      | -         |
| 8   | `checkPaymentStatus()`       | 701-815   | ✅ OK         | Verificar            | -      | 🟡        |
| 9   | `getMarketStats()`           | 816-1015  | ✅ OK         | Ninguno              | -      | -         |
| 10  | **`getPurchaseHistory()`**   | 1016-1088 | ❌ ROTO       | Amounts NULL         | #3     | 🔴        |
| 11  | **`updateTokenBalance()`**   | 1177-1241 | ❌ ROTO       | No retorna sig       | #1     | 🔴        |
| 12  | `getCurrentSupply()`         | 1089-1168 | ✅ OK         | Ninguno              | -      | -         |
| 13  | `verifySignature()`          | 1169-1176 | ✅ OK         | Ninguno              | -      | -         |
| 14  | `isFirstPurchase()`          | 1242-1252 | ❓ Verificar  | Desconocido          | -      | 🟡        |
| 15  | `calculatePrice()`           | (Helper)  | ✅ OK         | Ninguno              | -      | -         |

---

## TABLA 2: VALIDADORES LEGACY (Zod schemas)

| Validador                       | Ubicación               | Status | Uso               |
| ------------------------------- | ----------------------- | ------ | ----------------- |
| `getCurrentPrice_validators`    | purchase.routes.ts:L60  | ✅     | Validar amount    |
| `getPaymentMethods_validators`  | purchase.routes.ts:L180 | ✅     | (ninguna)         |
| `initiatePurchase_validators`   | purchase.routes.ts:L220 | ✅     | Validar entrada   |
| `confirmPurchase_validators`    | purchase.routes.ts:L310 | ✅     | Validar signature |
| `settlePurchase_validators`     | purchase.routes.ts:L400 | ✅     | (si existe)       |
| `getPurchaseHistory_validators` | purchase.routes.ts:L380 | ✅     | Validar query     |

---

## TABLA 3: TICKETS DE RESOLUCIÓN (10 TOTALES)

| Ticket | Nombre                             | Prioridad | Deps  | Tiempo | Status |
| ------ | ---------------------------------- | --------- | ----- | ------ | ------ |
| #1     | updateTokenBalance() retorna firma | 🔴        | -     | 1h     | ⏳     |
| #2     | confirmPurchase() registra firma   | 🔴        | #1    | 1h     | ⏳     |
| #3     | getPurchaseHistory() amounts OK    | 🔴        | #1,#2 | 1h     | ⏳     |
| #4     | Crear endpoint settlePurchase()    | 🟠        | #1    | 1.5h   | ⏳     |
| #5     | Verificación on-chain de mint      | 🟠        | #1    | 2h     | ⏳     |
| #6     | Metadata sincronizada completa     | 🟠        | #2    | 1h     | ⏳     |
| #7     | Broadcasts completos               | 🟠        | #2    | 1.5h   | ⏳     |
| #8     | Refactorizar modularidad           | 🟡        | TODOS | 3h     | ⏳     |
| #9     | Reemplazar console.log()           | 🟡        | TODOS | 1h     | ⏳     |
| #10    | Tests E2E                          | 🟡        | TODOS | 2h     | ⏳     |

---

## TABLA 4: ENDPOINTS (API ROUTES)

| Método | Ruta                        | Legacy | Actual | Status   |
| ------ | --------------------------- | ------ | ------ | -------- |
| GET    | `/purchase/price`           | ✅     | ✅     | ✅ OK    |
| GET    | `/purchase/payment-methods` | ✅     | ✅     | ✅ OK    |
| POST   | `/purchase/initiate`        | ✅     | ✅     | ✅ OK    |
| POST   | `/purchase/confirm/:id`     | ✅     | ✅     | ❌ ROTO  |
| POST   | `/purchase/settle/:id`      | ✅     | ❌     | ❌ FALTA |
| POST   | `/purchase/auto-settle`     | ✅     | ✅     | ✅ OK    |
| GET    | `/purchase/status/:id`      | ✅     | ✅     | ✅ OK    |
| GET    | `/purchase/history`         | ✅     | ✅     | ❌ ROTO  |
| GET    | `/purchase/market-stats`    | ✅     | ✅     | ✅ OK    |
| GET    | `/purchase/top-10`          | ✅     | ✅     | ✅ OK    |

---

## TABLA 5: RESPONSABILIDADES POR FUNCIÓN

| Función            | Entrada        | Proceso          | Salida                  | DB              |
| ------------------ | -------------- | ---------------- | ----------------------- | --------------- |
| getCurrentPrice    | tokenAmount    | Bonding curve    | { price, cost, impact } | Lectura         |
| initiatePurchase   | wallet, amount | Crear TX         | { txBase64, txId }      | Escritura       |
| confirmPurchase    | signature      | Verificar + Mint | { mintSig, status }     | ✅ Debe guardar |
| settlePurchase     | txId           | Reintento Mint   | { mintSig }             | ✅ Debe guardar |
| getPurchaseHistory | wallet, page   | Query DB         | [ transactions ]        | Lectura         |
| updateTokenBalance | wallet, amount | Ejecutar Mint    | ✅ mintSignature        | Lectura         |

---

## TABLA 6: DEPENDENCIAS Y FLUJO

```
initiatePurchase()
    ↓ (requiere)
    getCurrentPrice()
    getCurrentSupply()
    ↓
confirmPurchase()
    ├─ (requiere) updateTokenBalance()
    │             ├─ autoSettlePurchase()
    │             └─ verifySignature()
    │
    ├─ broadcast(purchase.confirmed)
    │
    └─ (guardará en DB)
        ↓
getPurchaseHistory()
    └─ (lee de DB)

settlePurchase()
    ├─ (requiere) updateTokenBalance()
    │
    └─ (guardará en DB)
        ↓
        getPurchaseHistory() (ve el retry)
```

---

## TABLA 7: CAMBIOS NECESARIOS RESUMIDOS

| Función              | Cambio                      | Línea Aprox | Impacto       |
| -------------------- | --------------------------- | ----------- | ------------- |
| updateTokenBalance() | Retornar mintSignature      | 1177        | ✅ Crítico    |
| confirmPurchase()    | Guardar mintSignature       | 375         | ✅ Crítico    |
| confirmPurchase()    | Usar pending_mint status    | 375         | ✅ Crítico    |
| getPurchaseHistory() | Nunca retornar NULL amounts | 1016        | ✅ Crítico    |
| settlePurchase()     | Crear endpoint nuevo        | -           | ✅ Nueva ruta |
| updateTokenBalance() | Verificar on-chain          | 1177        | 🟡 Mejora     |
| confirmPurchase()    | Guardar metadata            | 375         | 🟡 Mejora     |
| broadcast()          | Incluir mintSignature       | -           | 🟡 Mejora     |
| PurchaseController   | Dividir en módulos          | -           | 🟡 Técnico    |
| Todos                | Reemplazar console.log      | -           | 🟡 Técnico    |

---

## TABLA 8: TESTING

| Área               | Tests Actuales | Coverage | Gap               | Ticket |
| ------------------ | -------------- | -------- | ----------------- | ------ |
| initiatePurchase   | ✅             | ~70%     | Metadata          | -      |
| confirmPurchase    | ⚠️ Parcial     | ~40%     | Mint verification | #2     |
| getPurchaseHistory | ✅             | ~80%     | NULL handling     | #3     |
| updateTokenBalance | ❌ Ninguno     | 0%       | Todo              | #1     |
| settlePurchase     | ❌ No existe   | 0%       | Todo              | #4     |
| Global Purchase    | ⚠️ Parcial     | ~60%     | E2E               | #10    |

---

## TABLA 9: TIMELINE

```
DAY 1:
  ├─ TICKET #1 (1h)  → updateTokenBalance() retorna firma
  └─ TICKET #2 (1h)  → confirmPurchase() registra firma

DAY 2:
  ├─ TICKET #3 (1h)  → getPurchaseHistory() amounts
  ├─ TICKET #4 (1.5h) → Crear settlePurchase()
  └─ TICKET #5 (2h)  → Verificación on-chain

DAY 3:
  ├─ TICKET #6 (1h)  → Metadata completa
  └─ TICKET #7 (1.5h) → Broadcasts

DAY 4:
  ├─ TICKET #9 (1h)  → Reemplazar console.log()
  └─ Testing en staging

DAY 5:
  ├─ TICKET #8 (3h)  → Refactorización
  ├─ TICKET #10 (2h) → Tests E2E
  └─ Deploy producción

TOTAL: 16 horas
```

---

## TABLA 10: VERIFICACIÓN POR AMBIENTE

### LOCAL (Desarrollo)

```
✅ HACER:
  [ ] pnpm test                    (todos los tests)
  [ ] pnpm test --coverage         (coverage >= 80%)
  [ ] pnpm dev                     (servidor local)
  [ ] curl POST /purchase/initiate (test manual)
  [ ] curl GET /purchase/history   (verificar amounts)

✅ VERIFICAR:
  [ ] tokenAmount !== null en histórico
  [ ] mintSignature está presente
  [ ] Logs muestran firma (no console.log)
  [ ] No hay errores TS
```

### STAGING (Pre-producción)

```
✅ HACER:
  [ ] Deploy a staging
  [ ] Smoke tests (básicos)
  [ ] Load test 100 compras
  [ ] Verificar DB tiene datos correctos
  [ ] Monitoreo 1 hora

✅ VERIFICAR:
  [ ] Mismo comportamiento que local
  [ ] No hay errores 5xx
  [ ] Performance acceptable
```

### PRODUCCIÓN (Live)

```
✅ HACER:
  [ ] Deploy rollout gradual (5% → 25% → 100%)
  [ ] Monitoreo 24/7 primeras 24h
  [ ] Alertas activas
  [ ] Log analysis
  [ ] Rollback plan listo

✅ VERIFICAR:
  [ ] Compras completándose OK
  [ ] Histórico con datos correctos
  [ ] No hay degradación de performance
  [ ] Usuarios no reportan issues
```

---

## TABLA 11: REFERENCIA RÁPIDA - QUÉ VA DÓNDE

| Concepto       | Ubicación Legacy                            | Ubicación Actual                            |
| -------------- | ------------------------------------------- | ------------------------------------------- |
| Purchase logic | controllers/purchase/Purchase​Controller.ts | controllers/purchase/Purchase​Controller.ts |
| Rutas          | routes/purchase/purchase.routes.ts          | routes/purchase/purchase.routes.ts          |
| Solana logic   | services/solana.service.ts                  | services/solana/ (modular)                  |
| Auto-settle    | services/solana/auto-settle.service.ts      | services/solana/auto-settle.service.ts      |
| DB Models      | models/token/transaction.model.ts           | prisma/schema.prisma                        |
| Validators     | controllers/purchase/validators             | controllers/purchase/purchase_validators.ts |
| Logger         | services/logging/logger.service.ts          | services/logging/logger.service.ts          |
| Notifications  | services/notifications/...                  | services/notifications/...                  |
| Payments       | services/payments/payment.service.ts        | services/payments/payment.service.ts        |

---

## 🔑 CLAVE MAESTRA

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  SÍ NECESITAS ENTENDER ESTO:                               │
│                                                             │
│  La función updateTokenBalance() DEBE retornar una firma    │
│  porque es la PRUEBA de que el mint se ejecutó             │
│                                                             │
│  Legacy:     return "5A9pXvZq..." (firma)      ✅         │
│  Actual:     return void/null                  ❌         │
│                                                             │
│  Sin firma:                                                 │
│    → No se sabe si el mint funcionó                        │
│    → No se puede registrar en BD                           │
│    → El histórico queda vacío                              │
│    → Usuario ve "tokenAmount: null"                        │
│    → No hay forma de retry                                 │
│                                                             │
│  Con firma (después del fix):                              │
│    → Se verifica que el mint funcionó       ✅             │
│    → Se registra en BD                       ✅             │
│    → El histórico está completo             ✅             │
│    → Usuario ve "tokenAmount: 1000"         ✅             │
│    → Hay forma de retry                     ✅             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📄 NOTAS FINALES

- **Todos los documentos están en la raíz (/)** del proyecto
- **Empieza por:** [INDICE_ANALISIS.md](INDICE_ANALISIS.md)
- **Para implementar:** [TICKETS_RESOLUCION.md](TICKETS_RESOLUCION.md)
- **Para referencia:** [REFERENCIA_LEGACY_FUNCIONES.md](REFERENCIA_LEGACY_FUNCIONES.md)
- **El plan ejecutivo está en:** [PLAN_ACCION_COMPRAS.md](PLAN_ACCION_COMPRAS.md)

---

**Versión:** 1.0  
**Generado:** 2025-12-15  
**Estado:** 🔴 CRÍTICO - En resolución  
**Documentación:** COMPLETA ✅
