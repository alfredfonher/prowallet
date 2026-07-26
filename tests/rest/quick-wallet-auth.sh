#!/bin/bash

# ============================================================================
# TEST WALLET LOGIN - OBTENER CHALLENGE Y DOCUMENTAR PASOS
# ============================================================================

API="https://servicioshilda.orioncaribe.com/api/v1"
WALLET="J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                  PROWALLET WALLET AUTH - QUICK START               ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📱 Wallet: $WALLET"
echo "📡 API: $API"
echo ""

# Paso 1: Obtener challenge
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[1/4] Solicitando challenge al servidor..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -X POST "$API/auth/request-challenge" \
  -H "Content-Type: application/json" \
  -d "{\"publicKey\":\"$WALLET\"}")

echo ""
echo "✅ Response completo:"
echo "$RESPONSE" | jq . 2>/dev/null

MESSAGE=$(echo "$RESPONSE" | jq -r '.data.message // empty')
NONCE=$(echo "$MESSAGE" | grep -oP 'nonce:\K[a-f0-9]+' || echo "")

if [ -z "$MESSAGE" ]; then
  echo "❌ ERROR: No se pudo obtener el message"
  exit 1
fi

echo ""
echo "📝 Message a firmar (COPIA ESTO):"
echo "───────────────────────────────────────────────────────────────────────"
echo "$MESSAGE"
echo "───────────────────────────────────────────────────────────────────────"
echo ""
echo "🔐 Nonce extraído: $NONCE"
echo ""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[2/4] FIRMA CON PHANTOM WALLET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 INSTRUCCIONES:"
echo ""
echo "1️⃣  Abre Phantom Wallet en tu navegador"
echo "2️⃣  Conecta tu wallet: $WALLET"
echo "3️⃣  Abre la consola: Presiona F12 → Console tab"
echo "4️⃣  Ejecuta este código (cópialo todo de una vez):"
echo ""
echo "───────────────────────────────────────────────────────────────────────"
cat << 'PHANTOM_CODE'
(async () => {
  const message = `Sign this message to authenticate with ProWallet:
nonce:8d2a443266edd0956b36827d903e436f`;
  
  const encodedMessage = new TextEncoder().encode(message);
  const signedMessage = await window.solana.signMessage(encodedMessage);
  const signature = Buffer.from(signedMessage.signature).toString('base64');
  
  console.log('✅ FIRMA COMPLETADA');
  console.log('Signature (cópiala):');
  console.log(signature);
  
  // Guarda en variable global para fácil acceso
  window.prowalletSignature = signature;
  window.prowalletMessage = message;
  window.prowalletWallet = "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD";
})();
PHANTOM_CODE
echo "───────────────────────────────────────────────────────────────────────"
echo ""
echo "5️⃣  En la consola aparecerá tu signature (base64)"
echo "6️⃣  Cópiala completamente"
echo "7️⃣  Reemplaza SIGNATURE_AQUI en el comando del paso 3"
echo ""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[3/4] ENVIAR FIRMA AL BACKEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Una vez tengas la signature, ejecuta:"
echo ""
echo "───────────────────────────────────────────────────────────────────────"
cat << 'CURL_CODE'
curl -X POST https://servicioshilda.orioncaribe.com/api/v1/auth/login-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
    "message": "Sign this message to authenticate with ProWallet:\nnonce:8d2a443266edd0956b36827d903e436f",
    "signature": "PEGA_TU_SIGNATURE_AQUI"
  }'
CURL_CODE
echo "───────────────────────────────────────────────────────────────────────"
echo ""
echo "La respuesta será:"
echo ""
echo "───────────────────────────────────────────────────────────────────────"
cat << 'RESPONSE_EXAMPLE'
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "username": "J3szAxVN",
    "publicKey": "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD"
  }
}
RESPONSE_EXAMPLE
echo "───────────────────────────────────────────────────────────────────────"
echo ""
echo "📌 GUARDA EL accessToken para el siguiente paso"
echo ""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[4/4] VERIFICAR AUTENTICACIÓN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Con el accessToken, verifica tu usuario:"
echo ""
echo "───────────────────────────────────────────────────────────────────────"
echo 'curl -X GET https://servicioshilda.orioncaribe.com/api/v1/auth/me \'
echo '  -H "Authorization: Bearer <ACCESS_TOKEN>"'
echo "───────────────────────────────────────────────────────────────────────"
echo ""
echo "Respuesta esperada:"
echo ""
echo "───────────────────────────────────────────────────────────────────────"
cat << 'ME_RESPONSE'
{
  "success": true,
  "user": {
    "id": "...",
    "username": "J3szAxVN",
    "publicKey": "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD"
  }
}
ME_RESPONSE
echo "───────────────────────────────────────────────────────────────────────"
echo ""
echo "✅ ¡AUTENTICACIÓN COMPLETADA!"
echo ""

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                  RESUMEN DEL PROCESO                               ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "┌─ INFORMACIÓN IMPORTANTE ────────────────────────────────────────────┐"
echo "│                                                                      │"
echo "│  📌 Wallet: J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD            │"
echo "│  🔐 Mensaje: Sign this message to authenticate with ProWallet...    │"
echo "│  📝 Nonce:   $NONCE                        │"
echo "│  ⏱️  Vencimiento: 5 minutos desde la solicitud                        │"
echo "│                                                                      │"
echo "│  🚀 Estado: LISTO PARA PHANTOM WALLET SIGNING                        │"
echo "│                                                                      │"
echo "└──────────────────────────────────────────────────────────────────────┘"
echo ""
