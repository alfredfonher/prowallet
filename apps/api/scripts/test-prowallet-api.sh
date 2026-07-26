#!/bin/bash

# ProWallet API Test Script
# Tests the main endpoints after configuration changes

set -e

API_BASE="https://servicioshilda.orioncaribe.com/api/v1"
WALLET_TEST="EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH"  # Your test wallet (mint authority)

echo "🚀 Testing ProWallet API Configuration..."
echo "========================================="

# Test API root
echo ""
echo "📋 1. Testing API Root Endpoint"
curl -s "$API_BASE/../" | jq '.'

# Test health endpoints
echo ""
echo "❤️  2. Testing Health Endpoints"
echo "   - API Health:"
curl -s "$API_BASE/health" | jq '.'

echo ""
echo "   - Solana Connectivity:"
curl -s "$API_BASE/health/solana" | jq '.'

# Test ProWallet contract info
echo ""
echo "� 3. Testing ProWallet Contract Info"
curl -s "$API_BASE/prowallet/contract-info" | jq '.'

# Test whitelist functionality
echo ""
echo "📝 4. Testing Whitelist"
echo "   - Get whitelist:"
curl -s "$API_BASE/prowallet/whitelist" | jq '.'

echo ""
echo "   - Check wallet whitelist status:"
curl -s "$API_BASE/prowallet/whitelist/$WALLET_TEST" | jq '.'

# Test wallet balance
echo ""
echo "💰 5. Testing Wallet Balance"
curl -s "$API_BASE/prowallet/balance/$WALLET_TEST" | jq '.'

# Test address validation
echo ""
echo "✅ 6. Testing Address Validation"
curl -s "$API_BASE/prowallet/validate-address/$WALLET_TEST" | jq '.'

# Test token price with bonding curve
echo ""
echo "📊 7. Testing Token Price (Bonding Curve)"
curl -s "$API_BASE/purchase/price?amount=100" | jq '.'

# Test market stats
echo ""
echo "📈 8. Testing Market Statistics"
curl -s "$API_BASE/purchase/market-stats" | jq '.'

# Test contract state
echo ""
echo "🏛️  9. Testing Contract State"
curl -s "$API_BASE/prowallet/state" | jq '.'

# Test multisig info
echo ""
echo "🔒 10. Testing Multisig Configuration"
curl -s "$API_BASE/prowallet/multisig" | jq '.'

echo ""
echo "========================================="
echo "✨ ProWallet API Testing Complete!"
echo ""
echo "📍 Key Information:"
echo "   • Token: ProWallet (GAP)"
echo "   • Contract: $PROGRAM_ID"
echo "   • Network: Devnet"
echo "   • Decimals: 9"
echo "   • Max Supply: 1,000,000,000,000,000,000 tokens"
echo ""
echo "🔗 Available endpoints:"
echo "   • Health: $API_BASE/health"
echo "   • ProWallet: $API_BASE/prowallet/*"
echo "   • Purchase: $API_BASE/purchase/*"
echo "   • Docs: https://servicioshilda.orioncaribe.com/api/docs"
