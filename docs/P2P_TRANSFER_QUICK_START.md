# P2P Transfer System - Quick Start Guide

## 🚀 TL;DR - Start Here

### What Is This?

A complete P2P token transfer system for Solana using the GAPC token. Users can send tokens between wallets with Phantom wallet integration.

### Quick Test (5 minutes)

```bash
# 1. Start servers
npm run dev

# 2. Open http://localhost:3000 in browser

# 3. Click "Conectar Wallet" → Approve Phantom

# 4. Go to "Transferir" section

# 5. Enter:
#    - Recipient wallet address
#    - Amount (e.g., 0.001 GAPC)

# 6. Click "Transferir" → Approve in Phantom

# 7. Wait ~30 seconds for blockchain confirmation

# 8. See "¡Transferencia Exitosa!" with transaction ID
```

### What Happens Behind The Scenes

```
You click "Transferir"
    ↓
Frontend calls POST /api/v1/transfer/initiate
    ↓
Backend builds Solana transaction & returns it base64-encoded
    ↓
Frontend shows Phantom prompt
    ↓
You approve in Phantom wallet
    ↓
Frontend sends signed transaction to POST /api/v1/transfer/confirm
    ↓
Backend broadcasts to Solana blockchain
    ↓
Backend waits for confirmation (up to 2 minutes with retries)
    ↓
Success! Transaction ID shown on screen
```

---

## 📚 Documentation

For **complete technical documentation**, see:

### **[→ TRANSFER_SYSTEM.md](./TRANSFER_SYSTEM.md)**

Includes:

- Architecture diagrams
- API endpoint specs
- Component documentation
- Error recovery details
- Testing guide
- Troubleshooting

---

## 🛠️ Key Features

| Feature                 | Details                                   |
| ----------------------- | ----------------------------------------- |
| **Auth**                | JWT + Phantom wallet                      |
| **Transaction Signing** | Phantom wallet handles all key management |
| **Networks**            | devnet, testnet, mainnet-beta             |
| **Gas Fees**            | Shows in SOL + USD (with live price)      |
| **Error Recovery**      | Auto-retry button for failed transfers    |
| **Confirmation**        | Auto-retry up to 15 times (2 min timeout) |

---

## ⚙️ Configuration

### Network Selection

Set `NEXT_PUBLIC_SOLANA_NETWORK` in `.env.local`:

```bash
# Development (default)
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# Testing
NEXT_PUBLIC_SOLANA_NETWORK=testnet

# Production
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

---

## 🔍 Console Logs to Expect

### Success Flow (Look for these patterns)

**Frontend (Browser Console):**

```
[17:28:15.123] [WALLET-SIGNER] 🔐 Starting transaction signing...
[17:28:15.234] [WALLET-SIGNER] ✓ Wallet detected: 9W5...
[17:28:20.000] [WALLET-SIGNER] ✓ Transaction signed by wallet
[17:28:20.222] [WALLET-SIGNER] ✓ Signed transaction serialized (XXX bytes base64)
[17:28:20.333] [API-CLIENT] ✓ Authorization header SET
```

**Backend (Terminal):**

```
[17:28:15] [TRANSFER-INITIATE] ✓ Transaction ready for signing. ID: 8f7e3...
[17:28:20] [TRANSFER-CONFIRM] 📥 Received confirm request from 9W5...
[17:28:20] [TRANSFER-CONFIRM] ✓ Signed transaction decoded (XXX bytes)
[17:28:20] [TRANSFER-CONFIRM] 📤 Sending raw transaction to Solana...
[17:28:20] [TRANSFER-CONFIRM] ✓ Transaction sent, TxID: 5xQ7...
[17:28:20] [TRANSFER-CONFIRM] ⏳ Waiting for confirmation...
[17:28:25] [TRANSFER-CONFIRM] ✅ Transaction CONFIRMED on blockchain
```

---

## ❌ Common Issues

| Issue                          | Fix                                              |
| ------------------------------ | ------------------------------------------------ |
| "Usuario no autenticado"       | Reconnect wallet (page refresh)                  |
| "Wallet not found"             | Install Phantom extension                        |
| "Balance insuficiente"         | You need GAPC tokens + SOL for gas               |
| "Transacción no confirmada"    | Click retry button (network congestion)          |
| Phantom doesn't prompt to sign | Try different browser (Chrome works best)        |
| Transaction takes forever      | Normal during network congestion (wait or retry) |

For more detailed troubleshooting, see [TRANSFER_SYSTEM.md#troubleshooting](./TRANSFER_SYSTEM.md#troubleshooting)

---

## 🧪 Testing Endpoints Manually

### Get JWT Token

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test@1234",
    "email": "test@example.com"
  }'
# Copy the token from response
```

### Initiate Transfer

```bash
curl -X POST http://localhost:3001/api/v1/transfer/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "fromWallet": "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
    "toWallet": "HEuSx6DRcQm7mbvdrstMpJaCQBdA2tK6gH1M6RnWHjbw",
    "amount": 0.001
  }'
# Get transaction and transactionId from response
```

### Confirm Transfer (after signing with Phantom)

```bash
curl -X POST http://localhost:3001/api/v1/transfer/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "signedTransaction": "AQAAAAAAA...",  # From Phantom
    "fromWallet": "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD"
  }'
# Should get back transactionId and "confirmed" status
```

---

## 📊 Architecture at a Glance

```
┌──────────────┐                    ┌──────────────┐
│ Phantom      │  ←→ JWT + Signed   │ Frontend     │
│ Wallet       │     Transactions   │ (React)      │
└──────────────┘                    └──────┬───────┘
                                           │
                                    HTTP Requests
                                           │
                                    ┌──────▼───────┐
                                    │ API Server   │
                                    │ (TypeScript) │
                                    └──────┬───────┘
                                           │
                                    Solana Web3.js
                                           │
                                    ┌──────▼───────────┐
                                    │ Solana RPC Node  │
                                    │ (devnet/testnet) │
                                    └──────────────────┘
```

---

## 🔑 Key Concepts

### JWT Token

- Issued when you connect wallet
- Sent with every transfer request in `Authorization` header
- Contains `publicKey` for verification

### Transaction Signing

- Phantom handles ALL private keys (never sent to server)
- User must approve in wallet UI
- Backend never touches private keys

### Gas Fees

- Standard: 5,000 lamports (0.000005 SOL)
- Converted to USD using live price data
- Deducted by Solana blockchain automatically

### Retry Mechanism

- Up to 15 automatic retries over 2 minutes
- Exponential backoff to avoid RPC spam
- User can also manually retry from UI

---

## 📝 Files to Know

| Component | File                     | Purpose             |
| --------- | ------------------------ | ------------------- |
| UI        | `transfer-view.tsx`      | Main transfer form  |
| Signing   | `use-wallet-signer.ts`   | Phantom integration |
| API       | `transfer.controller.ts` | Backend endpoints   |
| Config    | `network-config.ts`      | Network settings    |

---

## 🚀 Ready to Dive Deeper?

→ **[Full Technical Documentation](./TRANSFER_SYSTEM.md)**

Covers:

- Complete sequence diagrams
- API specifications
- Component deep-dives
- Error handling strategies
- Security considerations
- Performance metrics

---

## 💬 Questions?

1. Check [TRANSFER_SYSTEM.md](./TRANSFER_SYSTEM.md) for detailed answers
2. Look at console logs (browser DevTools & terminal)
3. Check git commit history for changes explanations

---

**Status:** ✅ Production Ready (with noted limitations)
**Last Updated:** 2025-12-18
**Version:** 1.0.0
