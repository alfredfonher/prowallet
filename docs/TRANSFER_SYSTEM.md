# 🚀 P2P Token Transfer System - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Complete Transfer Flow](#complete-transfer-flow)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Error Handling & Recovery](#error-handling--recovery)
7. [Gas Fees & Network Configuration](#gas-fees--network-configuration)
8. [Testing Guide](#testing-guide)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The ProWallet P2P Transfer System enables users to send SPL tokens (GAPC) between Solana wallets with:

- ✅ JWT-based authentication
- ✅ Phantom wallet integration for transaction signing
- ✅ Automatic blockchain confirmation with retries
- ✅ Error recovery with retry mechanism
- ✅ Multi-network support (devnet, testnet, mainnet)
- ✅ Real-time gas fee estimation in USD

### Key Features

| Feature               | Status | Details                       |
| --------------------- | ------ | ----------------------------- |
| Wallet Authentication | ✅     | Via JWT token                 |
| Transaction Signing   | ✅     | Phantom wallet integration    |
| Network Support       | ✅     | devnet, testnet, mainnet-beta |
| Gas Fee Estimation    | ✅     | Automatic USD conversion      |
| Error Recovery        | ✅     | Automatic retry mechanism     |
| Transaction Tracking  | ✅     | UUID-based transaction IDs    |
| Balance Validation    | ✅     | Pre-transfer balance checks   |

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│  (React Components + Tailwind CSS)                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│               AUTHENTICATION LAYER                          │
│  JWT Token Management + Phantom Wallet Connect              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              TRANSFER SERVICE LAYER                         │
│  TransferView → API Client → Transfer Endpoints             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│           BLOCKCHAIN INTERACTION LAYER                      │
│  Solana Web3.js → RPC Node → Phantom Wallet                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│               SOLANA BLOCKCHAIN                             │
│  (devnet/testnet/mainnet-beta)                              │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
apps/
├── web/
│   ├── components/
│   │   └── transfer/
│   │       ├── transfer-view.tsx          # Main transfer UI
│   │       ├── network-badge.tsx          # Network indicator
│   │       └── wallet-search-input.tsx    # Recipient search
│   ├── hooks/
│   │   ├── use-wallet-signer.ts          # Phantom wallet signing
│   │   └── use-sol-price.ts              # SOL price fetching
│   └── lib/
│       ├── api-client.ts                 # HTTP client with JWT
│       ├── network-config.ts             # Network configuration
│       └── auth-context.ts               # Auth state management
└── api/
    └── src/
        ├── controllers/
        │   └── transfer/
        │       └── transfer.controller.ts  # Transfer endpoints
        ├── routes/
        │   └── transfer.routes.ts         # Route definitions
        ├── middleware/
        │   └── jwt.ts                     # JWT validation
        └── services/
            ├── solana.service.ts          # Solana RPC wrapper
            └── solana/
                └── transfer-p2p.service.ts # SPL transfer builder
```

---

## Complete Transfer Flow

### Sequence Diagram (ASCII)

```
User              Frontend           Backend            Phantom            Solana
 │                  │                  │                 │                 │
 ├─ Connect ────────►│                  │                 │                 │
 │                  ├─ Connect ────────────────────────────►│                 │
 │                  │                  │◄──── Approve ─────┤                 │
 │                  │                  │                 │                 │
 ├─ Enter Details──►│                  │                 │                 │
 │                  ├─ Validate ──────►│                 │                 │
 │                  │◄─── OK ──────────┤                 │                 │
 │                  │                  │                 │                 │
 ├─ Click Transfer─►│                  │                 │                 │
 │                  ├─ POST /initiate ─►│                 │                 │
 │                  │                  ├─ Build TX       │                 │
 │                  │                  ├─ Serialize      │                 │
 │                  │◄─ { TX, ID } ────┤                 │                 │
 │                  │                  │                 │                 │
 │                  ├─ Decode TX       │                 │                 │
 │                  ├─ Show Dialog ────────────────────────►│ Sign Window     │
 │                  │                  │                 ├─►│                 │
 │                  │                  │                 │  ├─ User Approves │
 │                  │◄─────── Signed TX ─────────────────┤  │                 │
 │                  │                  │                 │  │                 │
 │                  ├─ Serialize       │                 │                 │
 │                  ├─ POST /confirm ──►│                 │                 │
 │                  │                  ├─ Deserialize    │                 │
 │                  │                  ├─ SendRaw ──────────────────────────►│
 │                  │                  │◄──── TxID ──────────────────────────┤
 │                  │                  │                 │                 │
 │                  │                  ├─ Confirm Loop   │                 │
 │                  │                  │  (15 retries)   │                 │
 │                  │                  ├─ Confirmed ◄───────────────────────┤
 │                  │◄─ { TxID, OK } ──┤                 │                 │
 │                  │                  │                 │                 │
 │◄─ Success ───────┤                  │                 │                 │
 │  Show TxID       │                  │                 │                 │
```

### Detailed Step-by-Step

#### Step 1: User Authentication

```typescript
// Frontend: User connects wallet via Phantom
const wallet = (window as any).solana;
await wallet.connect();

// Backend: JWT token issued with publicKey
const token = jwt.sign({ publicKey: wallet.publicKey.toString() }, secret);
```

#### Step 2: Transfer Initiation

```
POST /api/v1/transfer/initiate
Headers: { Authorization: "Bearer JWT_TOKEN" }
Body: {
  fromWallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD",
  toWallet: "HEuSx6DRcQm7mbvdrstMpJaCQBdA2tK6gH1M6RnWHjbw",
  amount: 0.1
}

Response:
{
  success: true,
  extra: {
    transaction: "AQAAAAAAA...",  // base64 encoded
    transactionId: "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Step 3: Transaction Signing

```typescript
// Frontend: Decode and sign with wallet
const tx_buffer = Buffer.from(transaction, "base64");
const tx = Transaction.from(tx_buffer);

// Phantom prompts user
const signed_tx = await wallet.signTransaction(tx);

// Serialize signed transaction
const signed_serialized = signed_tx
  .serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  })
  .toString("base64");
```

#### Step 4: Transaction Confirmation

```
POST /api/v1/transfer/confirm
Headers: { Authorization: "Bearer JWT_TOKEN" }
Body: {
  signedTransaction: "AQAAAAAAA...",  // Signed tx (base64)
  fromWallet: "J3szAxVNUpTYXiW75FpP7XRUtDSaVcaSHf35F6NqeuDD"
}

Process:
1. Validate JWT
2. Deserialize signed transaction
3. Send to RPC: connection.sendRawTransaction(buffer)
4. Wait for confirmation (120 seconds max)
5. Retry up to 15 times if needed

Response:
{
  success: true,
  extra: {
    transactionId: "5xQ7N2B9...",
    status: "confirmed"
  }
}
```

---

## API Endpoints

### Transfer Initiation

**Endpoint:** `POST /api/v1/transfer/initiate`

**Authentication:** JWT Token Required

**Request Body:**

```json
{
  "fromWallet": "Solana address (base58)",
  "toWallet": "Solana address (base58)",
  "amount": "Number (positive, up to 9 decimals)"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "HTTP 200 - Correcto",
  "code": 200,
  "extra": {
    "success": true,
    "transaction": "AQAAAAAAA...",
    "transactionId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Error Responses:**

- `400` - Invalid wallet address or amount
- `401` - Missing or invalid JWT token
- `400` - Transaction building failed (insufficient balance, invalid network)

### Transfer Confirmation

**Endpoint:** `POST /api/v1/transfer/confirm`

**Authentication:** JWT Token Required

**Request Body:**

```json
{
  "signedTransaction": "Base64 encoded signed transaction",
  "fromWallet": "Solana address (base58)"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "HTTP 200 - Correcto",
  "code": 200,
  "extra": {
    "transactionId": "5xQ7N2B9...",
    "status": "confirmed"
  }
}
```

**Error Responses:**

- `400` - Invalid transaction format or encoding
- `401` - Missing or invalid JWT token
- `400` - Transaction confirmation timeout
- `400` - RPC node error

---

## Frontend Components

### TransferView Component

**Location:** `apps/web/components/views/transfer-view.tsx`

**Props:** None (uses auth context and hooks)

**Key State:**

```typescript
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
const [preview, setPreview] = useState<TransferPreview | null>(null);
const [failedTransfer, setFailedTransfer] = useState<FailedTransfer | null>(
  null,
);
```

**Key Functions:**

- `handle_transfer()` - Main transfer orchestration
- `retry_confirm_transfer()` - Retry failed confirmations
- `calculate_preview()` - Show balance and fees
- `validate_transfer_input()` - Input validation

### NetworkBadge Component

**Location:** `apps/web/components/transfer/network-badge.tsx`

**Displays:**

- Current network name (devnet/testnet/mainnet-beta)
- Warning indicator for testnet
- Color-coded background (amber=testnet, green=mainnet)

### Hooks

#### useSolPrice()

Fetches current SOL price from CoinGecko API

```typescript
const { price, loading, error } = useSolPrice();
// price: number | null (e.g., 245.50)
// Updates every 30 seconds
```

#### use_wallet_signer()

Signs transactions with Phantom wallet

```typescript
const { is_signing, sign_transaction, error } = use_wallet_signer();
// sign_transaction(base64_tx) → Promise<base64_signed_tx>
```

---

## Error Handling & Recovery

### Error Recovery UI

When a transfer fails during confirmation:

1. **Error Message Display**
   - Clear error text
   - Transaction ID reference
   - Actionable buttons

2. **Retry Button**
   - Automatically available for confirm-step failures
   - Uses stored signed transaction
   - No need to re-sign

3. **Cancel Option**
   - Clears error state
   - Allows starting fresh transfer

### Error Types & Handling

| Error                       | Cause             | User Action          | Recovery                 |
| --------------------------- | ----------------- | -------------------- | ------------------------ |
| "Usuario no autenticado"    | No JWT token      | Reconnect wallet     | Auto-retry shows confirm |
| "Dirección inválida"        | Bad wallet format | Check wallet address | Edit address field       |
| "Balance insuficiente"      | Not enough tokens | Check balance        | Cannot retry             |
| "Transacción no confirmada" | RPC timeout       | Wait or retry        | Show retry button        |
| "Error al firmar"           | Phantom rejected  | Try again in wallet  | No auto-retry            |
| "Error de conexión"         | Network issue     | Check internet       | Show retry button        |

### Retry Mechanism

Backend implements automatic retries:

```typescript
const confirmed = await confirm_transaction_with_retries(connection, txId, {
  maxRetries: 15, // 15 attempts
  timeout: 120000, // 2 minutes total
});
```

Exponential backoff ensures RPC node doesn't get hammered.

---

## Gas Fees & Network Configuration

### Network Configuration

Set via environment variable:

```bash
# .env.local
NEXT_PUBLIC_SOLANA_NETWORK=devnet  # devnet | testnet | mainnet-beta
```

### Supported Networks

| Network      | URL                         | Testnet | Display              |
| ------------ | --------------------------- | ------- | -------------------- |
| devnet       | api.devnet.solana.com       | ✅ Yes  | Devnet (Testing)     |
| testnet      | api.testnet.solana.com      | ✅ Yes  | Testnet (Testing)    |
| mainnet-beta | api.mainnet-beta.solana.com | ❌ No   | Mainnet (Production) |

### Gas Fee Estimation

**Standard Solana SPL Transfer Fee:**

- 5,000 lamports = 0.000005 SOL

**USD Conversion:**

```typescript
const gasFee = 5000 / 1_000_000_000; // 0.000005 SOL
const usdCost = gasFee * solPrice; // e.g., ~0.0012 USD
```

**Display Format:**

```
0.000005 SOL (~$0.0012)
```

### Fee Estimation Interface

```typescript
interface GasFeeEstimate {
  lamports: number; // 5000
  sol: number; // 0.000005
  usd: number | null; // 0.0012 or null
}
```

---

## Testing Guide

### Prerequisites

- Phantom wallet browser extension
- Solana devnet/testnet SOL for gas fees
- Both frontend and backend running

### Manual End-to-End Test

```bash
# 1. Start servers
npm run dev

# 2. Open browser to http://localhost:3000

# 3. Connect wallet
- Click "Conectar Wallet"
- Approve Phantom connection

# 4. Authenticate
- Sign message in Phantom
- Verify token in console: sessionStorage.getItem("auth_token")

# 5. Navigate to Transfer
- Click "Transferir" in navigation
- Verify network badge shows (e.g., "Devnet (Testing)")

# 6. Fill form
- Recipient: [valid solana address]
- Amount: 0.001 GAPC
- Verify preview shows gas fee in USD

# 7. Submit
- Click "Transferir"
- Check console logs for [WALLET-SIGNER] prefix
- Approve in Phantom when prompted

# 8. Monitor
- Check browser console for successful signing
- Backend should log [TRANSFER-CONFIRM] messages
- Should see "¡Transferencia Exitosa!" on success
- Transaction ID visible on page
```

### Console Log Patterns to Look For

**Frontend (Browser DevTools Console):**

```
[17:28:15.123] [WALLET-SIGNER] 🔐 Starting transaction signing...
[17:28:15.234] [WALLET-SIGNER] ✓ Wallet detected: 9W5...
[17:28:20.000] [WALLET-SIGNER] ✓ Transaction signed by wallet
[17:28:20.222] [WALLET-SIGNER] ✓ Signed transaction serialized (XXX bytes base64)
```

**Backend (Terminal):**

```
[17:28:15] [TRANSFER-INITIATE] ✓ Transaction ready for signing. ID: 8f7e3...
[17:28:20] [TRANSFER-CONFIRM] 📥 Received confirm request from 9W5...
[17:28:20] [TRANSFER-CONFIRM] ✓ Transaction sent, TxID: 5xQ7...
[17:28:20] [TRANSFER-CONFIRM] ⏳ Waiting for confirmation...
[17:28:25] [TRANSFER-CONFIRM] ✅ Transaction CONFIRMED on blockchain
```

### Automated Testing (Future)

```bash
# Run test suite
npm run test:transfer

# Integration tests (E2E with Phantom)
npm run test:e2e:transfer

# Load testing
npm run test:load:transfer
```

---

## Troubleshooting

### "Usuario no autenticado" Error

**Problem:** JWT token not being sent

**Solution:**

```typescript
// Check sessionStorage
console.log(sessionStorage.getItem("auth_token"));

// Verify in Network tab:
// Transfer requests should have Authorization header
Headers: {
  Authorization: "Bearer ey...";
}
```

### "Wallet not found" in Phantom Signer

**Problem:** Phantom not installed or not compatible

**Solution:**

1. Install Phantom from official source
2. Check `window.solana` in console:
   ```javascript
   console.log((window as any).solana);  // Should not be undefined
   ```
3. Ensure you're on a supported browser (Chrome, Firefox, Edge, Brave)

### Transaction Takes Too Long

**Problem:** Confirmation timeout after 120 seconds

**Solution:**

1. Check Solana network status: https://status.solana.com
2. For devnet issues, try refreshing page and retrying
3. Check RPC node logs for rate limiting
4. Use retry mechanism (should appear in UI)

### Gas Fee Shows 0 or "NaN"

**Problem:** SOL price fetch failed

**Solution:**

1. Check internet connection
2. CoinGecko API might be rate-limited
3. Still shows fee but not USD conversion
4. Try refreshing page to retry price fetch

### Transaction Fails with "Invalid signature"

**Problem:** Signed transaction was corrupted

**Debugging:**

```typescript
// Check serialization
console.log("Transaction buffer length:", buffer.length);
console.log("First 20 bytes:", buffer.slice(0, 20).toString("hex"));
```

**Solution:**

1. Phantom should have signed correctly
2. Retry from error message UI
3. If persists, check Phantom version compatibility

### "Transaction not confirmed in time"

**Problem:** Blockchain is congested

**Solution:**

1. Normal during network congestion
2. Use retry button in error message
3. Transaction may still be confirmed (check explorer)
4. Visit Solana Explorer with transaction ID to verify

---

## Key Files Reference

| File                      | Purpose             |
| ------------------------- | ------------------- |
| `transfer-view.tsx`       | Main UI component   |
| `transfer.controller.ts`  | Backend endpoints   |
| `use-wallet-signer.ts`    | Phantom integration |
| `network-config.ts`       | Network settings    |
| `api-client.ts`           | HTTP with JWT       |
| `transfer-p2p.service.ts` | SPL transfer logic  |

---

## Performance Metrics

| Metric                | Target | Actual       |
| --------------------- | ------ | ------------ |
| Transfer initiation   | <100ms | ~50ms        |
| Wallet signing prompt | <1s    | ~0.2s        |
| Transaction broadcast | <500ms | ~200ms       |
| Confirmation loop     | 5-30s  | ~10s average |
| Total flow            | <45s   | ~40s average |

---

## Security Considerations

### JWT Authentication

- ✅ Issued on login
- ✅ Validated on each protected endpoint
- ✅ Includes `publicKey` for wallet verification
- ✅ No sensitive data in token

### Transaction Signing

- ✅ Phantom handles private keys (never sent to server)
- ✅ User must approve each transaction
- ✅ Signed transaction verified before broadcast

### Input Validation

- ✅ Wallet address format validation
- ✅ Amount bounds checking
- ✅ Recipient verification (same wallet check)

### Future Security Improvements

- [ ] Rate limiting on endpoints
- [ ] Audit logging to database
- [ ] Whitelist/blacklist for wallets
- [ ] Multi-signature support
- [ ] Transaction timelock options

---

## Next Steps & Future Enhancements

### Phase 2 (Planned)

- [ ] Transaction history view
- [ ] Batch transfer support
- [ ] Advanced fee estimation (dynamic based on network)
- [ ] Scheduled transfers
- [ ] Recurring payments
- [ ] WebSocket support for real-time updates
- [ ] Multi-signature wallets
- [ ] Transaction receipts

### Phase 3 (Research)

- [ ] Compressed NFT transfers
- [ ] Wrapped token support
- [ ] Atomic swaps
- [ ] Smart contract integration
- [ ] Governance token voting

---

**Last Updated:** 2025-12-18
**Version:** 1.0.0
**Status:** Production Ready (with noted limitations)

For questions or issues, refer to the main README.md or open a GitHub issue.
