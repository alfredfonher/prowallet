#!/bin/bash

# ============================================================================
# PROWALLET WALLET LOGIN - SCRIPT DE PRUEBA AUTOMÁTICA
# ============================================================================
# Este script prueba el flujo completo de autenticación con wallet Solana
# Uso: ./test-wallet-login.sh <WALLET_ADDRESS> <SIGNATURE>
# ============================================================================

set -e

API_URL="https://servicioshilda.orioncaribe.com/api/v1"
WALLET_ADDRESS="${1:-J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD}"
SIGNATURE="${2:-}"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         PROWALLET WALLET AUTHENTICATION TEST                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🔑 Wallet: $WALLET_ADDRESS"
echo "📡 API: $API_URL"
echo ""

# PASO 1: Solicitar Challenge
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 1: Solicitar Challenge del servidor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CHALLENGE_RESPONSE=$(curl -s -X POST "$API_URL/auth/request-challenge" \
  -H "Content-Type: application/json" \
  -d "{\"publicKey\":\"$WALLET_ADDRESS\"}")

echo "📨 Respuesta:"
echo "$CHALLENGE_RESPONSE" | jq . 2>/dev/null || echo "$CHALLENGE_RESPONSE"

MESSAGE=$(echo "$CHALLENGE_RESPONSE" | jq -r '.data.message // empty')
EXPIRES_AT=$(echo "$CHALLENGE_RESPONSE" | jq -r '.extra.expiresAt // .data.expiresAt // empty')

if [ -z "$MESSAGE" ]; then
  echo "❌ Error: No se pudo obtener el message del challenge"
  exit 1
fi

echo ""
echo "✅ Challenge obtenido exitosamente"
echo "📝 Message a firmar:"
echo "────────────────────────────────────────────────────────────────"
echo "$MESSAGE"
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "⏱️  Vencimiento: $EXPIRES_AT"
echo ""

# PASO 2: Verificar Signature
if [ -z "$SIGNATURE" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "PASO 2: Firmar el message con Phantom Wallet"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📌 INSTRUCCIONES:"
  echo "1. Abre Phantom Wallet en tu navegador"
  echo "2. Asegúrate de que tienes la wallet: $WALLET_ADDRESS conectada"
  echo "3. En la consola del navegador (F12 > Console), ejecuta:"
  echo ""
  echo "   const message = \`$MESSAGE\`;"
  echo "   const encodedMessage = new TextEncoder().encode(message);"
  echo "   const signedMessage = await window.solana.signMessage(encodedMessage);"
  echo "   const signature = signedMessage.signature.toString('base64');"
  echo "   console.log('Signature:', signature);"
  echo ""
  echo "4. Copia la signature y ejecuta:"
  echo "   ./test-wallet-login.sh \"$WALLET_ADDRESS\" \"PASTE_SIGNATURE_HERE\""
  echo ""
  exit 0
fi

# PASO 3: Enviar Firma
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 3: Enviar firma al backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login-wallet" \
  -H "Content-Type: application/json" \
  -d "{\"publicKey\":\"$WALLET_ADDRESS\",\"message\":\"$MESSAGE\",\"signature\":\"$SIGNATURE\"}")

echo "📨 Respuesta:"
echo "$LOGIN_RESPONSE" | jq . 2>/dev/null || echo "$LOGIN_RESPONSE"

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo ""
  echo "❌ Error: No se pudo obtener el accessToken"
  echo ""
  echo "Respuesta completa:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo ""
echo "✅ Login exitoso"
echo "🔐 Access Token:"
echo "────────────────────────────────────────────────────────────────"
echo "$ACCESS_TOKEN" | head -c 50
echo "..."
echo "────────────────────────────────────────────────────────────────"
echo ""

# PASO 4: Verificar Autenticación
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PASO 4: Verificar usuario autenticado"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ME_RESPONSE=$(curl -s -X GET "$API_URL/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "📨 Respuesta:"
echo "$ME_RESPONSE" | jq . 2>/dev/null || echo "$ME_RESPONSE"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ ✅ AUTENTICACIÓN COMPLETADA EXITOSAMENTE                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Variables disponibles para próximas requests:"
echo ""
echo "  Header: Authorization: Bearer $ACCESS_TOKEN"
echo ""
