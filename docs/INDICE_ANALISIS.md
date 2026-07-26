# 📑 ÍNDICE - ANÁLISIS DE MIGRACIÓN PROWALLET

**Creado:** 15 de Diciembre de 2025  
**Estado:** 🔴 PROBLEMA EN PRODUCCIÓN - Historial de transacciones incorrecto  
**Responsable:** Código de herencia en .legacy/api/src/controllers/purchase/

---

## 📚 DOCUMENTOS CREADOS

### 1. [MIGRACION_ANALYSIS.md](MIGRACION_ANALYSIS.md) - ANÁLISIS EJECUTIVO

**Contenido:**

- 📊 Comparativa de 15 funciones heredadas
- 🎯 Estado de cada una (✅ / ❌ / 🟡)
- 🔴 4 divergencias críticas identificadas
- 📋 Tabla de funciones con prioridades

**Lectura:** 5 minutos  
**Usar si:** Necesitas entender qué está roto

---

### 2. [TICKETS_RESOLUCION.md](TICKETS_RESOLUCION.md) - PLAN DE EJECUCIÓN ⭐

**Contenido:**

- 🎫 10 tickets detallados (criticidad + dependencias)
- 🔴 Ticket #1-3: Críticos (día 1-2)
- 🟠 Ticket #4-7: Altos (día 2-4)
- 🟡 Ticket #8-10: Medios (día 4-5)
- 📅 Roadmap de 5 días
- ✅ Checklists por ticket

**Lectura:** 20 minutos  
**Usar si:** Vas a implementar los fixes

---

### 3. [COMPARATIVA_LEGACY_VS_ACTUAL.md](COMPARATIVA_LEGACY_VS_ACTUAL.md) - ANÁLISIS DETALLADO

**Contenido:**

- 🔍 Cada función línea por línea
- ✅ Código que sí funciona (legacy)
- ❌ Código que está roto (actual)
- 🟡 Código que necesita verificación
- 📊 Matriz de divergencias
- 🎯 Conclusiones por criticidad

**Lectura:** 30 minutos  
**Usar si:** Necesitas entender la razón de cada bug

---

### 4. [PLAN_ACCION_COMPRAS.md](PLAN_ACCION_COMPRAS.md) - IMPLEMENTACIÓN ⭐⭐

**Contenido:**

- 🚀 Roadmap ejecutivo de 5 días
- 📝 Código antes/después para cada fix
- ✅ Checklists de validación
- 🔍 Verificación por ambiente (local/prod)
- 🛠️ Herramientas y recursos
- 📞 Contacto y soporte

**Lectura:** 25 minutos  
**Usar si:** Tienes que implementar y deployar

---

### 5. [REFERENCIA_LEGACY_FUNCIONES.md](REFERENCIA_LEGACY_FUNCIONES.md) - MANUAL DE REFERENCIA

**Contenido:**

- 📋 Las 14 funciones y su comportamiento esperado
- 📊 Entrada/salida de cada una
- 🔗 Dependencias entre funciones
- 🔧 Utilities y helpers
- 📞 Validadores (Zod schemas)

**Lectura:** 15 minutos (como referencia)  
**Usar si:** Necesitas ver qué hace cada función

---

## 🎯 EMPEZAR POR AQUÍ

### Si tienes 5 minutos:

Leer [MIGRACION_ANALYSIS.md](MIGRACION_ANALYSIS.md) - Resumen del problema

### Si tienes 30 minutos:

Leer [PLAN_ACCION_COMPRAS.md](PLAN_ACCION_COMPRAS.md) - Plan ejecutivo

### Si tienes 1 hora:

Leer en este orden:

1. [MIGRACION_ANALYSIS.md](MIGRACION_ANALYSIS.md)
2. [PLAN_ACCION_COMPRAS.md](PLAN_ACCION_COMPRAS.md)
3. [TICKETS_RESOLUCION.md](TICKETS_RESOLUCION.md) - Tickets críticos (#1-3)

### Si vas a implementar:

1. [TICKETS_RESOLUCION.md](TICKETS_RESOLUCION.md) - Tickets en orden
2. [REFERENCIA_LEGACY_FUNCIONES.md](REFERENCIA_LEGACY_FUNCIONES.md) - Como referencia
3. [COMPARATIVA_LEGACY_VS_ACTUAL.md](COMPARATIVA_LEGACY_VS_ACTUAL.md) - Si hay dudas

---

## 🔴 RESUMEN CRÍTICO

### El Problema

```
Compras en producción no registran tokens correctamente.
El histórico muestra NULL amounts en lugar de cantidades reales.
```

### La Causa

```
La función updateTokenBalance() fue refactorizada mal y
no retorna la mintSignature, por lo que:

1. No se puede verificar si el mint fue exitoso
2. No se registra en DB
3. El histórico queda vacío
4. No hay forma de retry manual
```

### La Solución (10 Tickets)

```
🔴 CRÍTICOS (2-3h):
  #1 updateTokenBalance() retorna firma
  #2 confirmPurchase() registra firma
  #3 getPurchaseHistory() retorna amounts

🟠 ALTOS (2-3h):
  #4 Crear endpoint settlePurchase()
  #5 Verificación on-chain de mint
  #6 Sincronizar metadata

🟡 MEDIOS (4-5h):
  #7 Arreglar broadcasts
  #8 Refactorización por modularidad
  #9 Reemplazar console.log()
  #10 Tests E2E
```

**Tiempo Total:** 16 horas  
**Impacto:** CRÍTICO - Bloquea producción

---

## 📊 ESTADÍSTICAS

| Métrica                   | Valor                       |
| ------------------------- | --------------------------- |
| Funciones heredadas       | 15                          |
| Problemas encontrados     | 10 tickets                  |
| Críticos                  | 3                           |
| Altos                     | 4                           |
| Medios                    | 3                           |
| Líneas de código legacy   | 1,372                       |
| Líneas máx permitidas     | 200                         |
| Funciones por archivo     | 15 (máx 1 para controllers) |
| Líneas máx por función    | 40                          |
| Coverage mínimo requerido | 80%                         |
| Riesgo de regresión       | Bajo (con TDD)              |

---

## 🔗 ARCHIVOS CLAVE

### Legacy (Referencia)

```
.legacy/api/src/
├── controllers/purchase/
│   ├── PurchaseController.ts (1,372 líneas)
│   ├── ManualTransactionController.ts
│   └── PurchaseController.new.ts
└── routes/purchase/
    └── purchase.routes.ts (1,138 líneas)
```

### Actual (Roto)

```
apps/api/src/
├── controllers/purchase/
│   ├── PurchaseController.ts (mismo tamaño 🚨)
│   └── ManualTransactionController.ts
└── routes/purchase/
    └── purchase.routes.ts
```

### Documentación (Nueva)

```
.
├── MIGRACION_ANALYSIS.md
├── TICKETS_RESOLUCION.md
├── COMPARATIVA_LEGACY_VS_ACTUAL.md
├── PLAN_ACCION_COMPRAS.md
└── REFERENCIA_LEGACY_FUNCIONES.md ← Tú estás aquí
```

---

## ✅ CHECKLIST DE RESOLUCIÓN

### Fase 1: Críticos (DÍA 1-2)

- [ ] Ticket #1: updateTokenBalance() retorna firma
- [ ] Ticket #2: confirmPurchase() registra firma
- [ ] Ticket #3: getPurchaseHistory() amounts correctos

**Test:** Las compras muestran tokenAmount en histórico

### Fase 2: Altos (DÍA 3)

- [ ] Ticket #4: Endpoint settlePurchase() existe
- [ ] Ticket #5: Verificación on-chain funciona
- [ ] Ticket #6: Metadata sincronizada

**Test:** Retry manual funciona, metadata completa

### Fase 3: Medios (DÍA 4-5)

- [ ] Ticket #7: Broadcasts completos
- [ ] Ticket #8: Refactorización modular
- [ ] Ticket #9: Sin console.log()
- [ ] Ticket #10: Tests E2E

**Test:** Coverage >= 80%, todos los tests pasan

### Fase 4: Deploy (DÍA 5)

- [ ] Todos los tests pasan en local
- [ ] Tests E2E pasan
- [ ] Coverage >= 80%
- [ ] Nombres en snake_case
- [ ] Sin console.log()
- [ ] Deploy a staging
- [ ] Tests smoke en staging
- [ ] Deploy a producción
- [ ] Monitoreo post-deploy

---

## 🔍 QUICK REFERENCE

### Ubicaciones Críticas

**Problema raíz:**

```
apps/api/src/controllers/purchase/PurchaseController.ts
  - updateTokenBalance() (línea ???) ← No retorna firma
  - confirmPurchase() (línea ???) ← No registra firma
  - getPurchaseHistory() (línea ???) ← Retorna NULL amounts
```

**Referencia:**

```
.legacy/api/src/controllers/purchase/PurchaseController.ts
  - updateTokenBalance() (línea 1177-1241) ✅ REFERENCIA
  - confirmPurchase() (línea 375-527) ✅ REFERENCIA
  - getPurchaseHistory() (línea 1016-1088) ✅ REFERENCIA
```

### Comandos Útiles

```bash
# Ver líneas de código
wc -l apps/api/src/controllers/purchase/PurchaseController.ts

# Buscar función
grep -n "updateTokenBalance" apps/api/src/controllers/purchase/PurchaseController.ts

# Ver función específica
sed -n '1177,1241p' .legacy/api/src/controllers/purchase/PurchaseController.ts

# Comparar archivos
diff -u .legacy/api/src/controllers/purchase/PurchaseController.ts \
         apps/api/src/controllers/purchase/PurchaseController.ts

# Tests
pnpm test --coverage
pnpm test purchase.test.ts
```

---

## 📞 SOPORTE

### Preguntas Comunes

**P: ¿Por dónde empiezo?**  
R: Ticket #1 (updateTokenBalance). Es la raíz de todo.

**P: ¿Cuánto tiempo toma?**  
R: 16 horas si trabajas sin interrupciones. 2-3 días en jornadas normales.

**P: ¿Afecta otros endpoints?**  
R: No. Solo endpoints de purchase. Otros siguen funcionando.

**P: ¿Puedo hacer un hotfix rápido?**  
R: No recomendado. Mejor hacer los 10 tickets completos para evitar regressions.

**P: ¿Tengo que refactorizar todo (Ticket #8)?**  
R: Sí. El archivo violaría las reglas de modularidad. Hazlo en paralelo con otros.

---

## 🚀 PRÓXIMOS PASOS

1. **Ahora:** Lee [PLAN_ACCION_COMPRAS.md](PLAN_ACCION_COMPRAS.md)
2. **Hoy:** Comienza con Ticket #1 (updateTokenBalance)
3. **Mañana:** Tickets #2 y #3 (confirmPurchase + getPurchaseHistory)
4. **Pasado:** Tickets #4-7 (endpoints y verificaciones)
5. **Próxima semana:** Tickets #8-10 (refactorización y tests)

---

## 📋 COPILOT INSTRUCTIONS SEGUIDAS

✅ Usa TypeScript siempre  
✅ Código funcional y modular (no clases)  
✅ async/await (no callbacks)  
✅ No console.log en producción  
✅ snake_case para nombres  
✅ Máx 200 líneas por archivo  
✅ Máx 40 líneas por función  
✅ TDD (tests primero)  
✅ Manejo explícito de errores  
✅ Early returns para validaciones

---

**Versión:** 1.0  
**Última actualización:** 2025-12-15  
**Estado:** 🔴 Problema activo - En resolución
