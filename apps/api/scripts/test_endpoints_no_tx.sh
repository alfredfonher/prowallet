#!/usr/bin/env bash
# Script: test_endpoints_no_tx.sh
# Propósito: Probar endpoints del API que NO realizan transacciones en cadena
# Uso: Inicia la API localmente y ejecuta este script. Ej: `pnpm dev` en otra terminal, luego:
#   bash apps/api/scripts/test_endpoints_no_tx.sh

set -euo pipefail
BASE_URL=${BASE_URL:-https://servicioshilda.orioncaribe.com/api/v1}
CURL_OPTS=(-sS -w "\nHTTP_STATUS:%{http_code}\n" -H "Content-Type: application/json")

echo "Testing ProWallet API endpoints (no on-chain txs) against: $BASE_URL"

echo "\n1) Health - /health"
curl "${CURL_OPTS[@]}" "$BASE_URL/health" || echo "Failed"

echo "\n2) Health - /health/solana"
curl "${CURL_OPTS[@]}" "$BASE_URL/health/solana" || echo "Failed"

echo "\n3) Health - /health/deep"
curl "${CURL_OPTS[@]}" "$BASE_URL/health/deep" || echo "Failed"

echo "\n4) Solana RPC proxy health - /solana/rpc/health"
curl "${CURL_OPTS[@]}" "$BASE_URL/solana/rpc/health" || echo "Failed"

echo "\n5) ProWallet contract info - /prowallet/contract-info"
curl "${CURL_OPTS[@]}" "$BASE_URL/prowallet/contract-info" || echo "Failed"

echo "\n6) ProWallet whitelist (list) - /prowallet/whitelist"
curl "${CURL_OPTS[@]}" "$BASE_URL/prowallet/whitelist" || echo "Failed"

# Replace example wallet addresses below if you want a particular wallet
EXAMPLE_WALLET=${EXAMPLE_WALLET:-EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH}

echo "\n7) ProWallet balance (example) - /prowallet/balance/:wallet"
curl "${CURL_OPTS[@]}" "$BASE_URL/prowallet/balance/$EXAMPLE_WALLET" || echo "Failed"

echo "\n8) ProWallet transaction (example) - /prowallet/transaction/:signature (uses placeholder)"
# Use a placeholder signature that will probably 404 but endpoint is safe to call
PLACEHOLDER_SIG=${PLACEHOLDER_SIG:-1111111111111111111111111111111111111111111111111111111111111111}
curl "${CURL_OPTS[@]}" "$BASE_URL/prowallet/transaction/$PLACEHOLDER_SIG" || echo "Failed"

echo "\n9) Purchase price - /purchase/price?amount=100"
curl "${CURL_OPTS[@]}" "$BASE_URL/purchase/price?amount=100" || echo "Failed"

echo "\n10) Purchase top-10 - /purchase/top-10"
curl "${CURL_OPTS[@]}" "$BASE_URL/purchase/top-10" || echo "Failed"

echo "\n11) Purchase market-stats - /purchase/market-stats"
curl "${CURL_OPTS[@]}" "$BASE_URL/purchase/market-stats" || echo "Failed"

echo "\n12) Purchase payment-methods - /purchase/payment-methods"
curl "${CURL_OPTS[@]}" "$BASE_URL/purchase/payment-methods" || echo "Failed"

echo "\n13) Purchase price-history (coingecko) - /purchase/price-history/bitcoin"
curl "${CURL_OPTS[@]}" "$BASE_URL/purchase/price-history/bitcoin" || echo "Failed"

echo "\n14) Admin metadata list - /admin/metadata"
curl "${CURL_OPTS[@]}" "$BASE_URL/admin/metadata" || echo "Failed"

echo "\n15) Admin metadata get (example key) - /admin/metadata/example"
curl "${CURL_OPTS[@]}" "$BASE_URL/admin/metadata/example" || echo "Failed"

echo "\n>> FIN: Endpoints tested. Review responses above. <<"

# Nota: Este script evita llamadas que ejecuten transacciones on-chain (transfer/confirm/initialize/emergency-stop/revenue/deposit/etc.).
# Para endpoints que devuelven transactions serializadas (e.g. /transfer/initiate, /purchase/initiate), puedes llamarlos para recibir la transacción serializada
# sin firmarla ni enviarla; eso igualmente no realiza un tx en la red hasta que llames al endpoint confirm que envíe la signature.
