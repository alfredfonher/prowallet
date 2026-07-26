# Transfer Duplicate Prevention - Testing Guide

## 🎯 Overview

This guide provides step-by-step instructions to manually test the **3-layer duplicate transfer prevention system** that was implemented to prevent users from accidentally losing SOL to duplicate transaction fees.

## ✅ Pre-Testing Checklist

- [ ] Application is running (`npm run dev`)
- [ ] Browser DevTools open (F12)
- [ ] Console tab visible in DevTools
- [ ] You have test wallet with sufficient GAPC and SOL
- [ ] You're connected to **mainnet-beta** (no "Devnet" badge should appear)

---

## 📋 Test Cases

### TEST 1: Basic Transfer Button Disable (Layer 1)

**Purpose:** Verify button disables immediately when transfer starts

#### Steps:

1. Open `/dashboard/transfer` page
2. Fill in valid transfer form:
   - To Address: `YOUR_TEST_WALLET_ADDRESS`
   - Amount: `0.001 GAPC`
3. **Open DevTools Console** (Tab: Console)
4. Type: `localStorage.getItem('transferInProgress')` → Should return `null`
5. Click **"Confirmar Transferencia"** button
6. **IMMEDIATELY** type in console: `localStorage.getItem('transferInProgress')` → Should return `"true"`

#### Expected Behavior:

- ✅ Button becomes **disabled** (grayed out, no cursor)
- ✅ Button text changes to **"Verificando transferencia..."** with spinner
- ✅ localStorage key appears **instantly** (not after confirmation)
- ✅ Button should be **impossible to click again**

#### Pass Criteria:

- Button is visibly disabled (opacity 0.5)
- localStorage shows `"true"` immediately
- Can click button multiple times without triggering multiple transfers

---

### TEST 2: localStorage Persistence (Layer 2a)

**Purpose:** Verify state persists if page is refreshed during transfer

#### Steps:

1. Start a transfer (same as Test 1)
2. Ensure button is disabled and localStorage shows `"true"`
3. **Immediately refresh the page** (Ctrl+R or Cmd+R)
4. Wait for page to reload
5. **Open DevTools Console**
6. Type: `localStorage.getItem('transferInProgress')`

#### Expected Behavior:

- ✅ Button should **still be disabled** after reload
- ✅ localStorage should **still show `"true"`**
- ✅ Button should remain disabled for **5 minutes** (safety timeout)
- ✅ Cannot submit another transfer until state clears

#### Pass Criteria:

- Button disabled immediately after page reload
- localStorage persists across page refresh
- No duplicate transfer submitted despite refresh

---

### TEST 3: localStorage Auto-Clear (Layer 2b)

**Purpose:** Verify safety timeout clears state after 5 minutes

#### Steps:

1. Trigger a transfer and disable button
2. Note the current time
3. Check localStorage: `localStorage.getItem('transferInProgress')` → `"true"`
4. **Wait 5+ minutes**
5. Check localStorage again

#### Expected Behavior:

- ✅ After 5 minutes, localStorage clears **automatically**
- ✅ Button becomes **enabled** again
- ✅ No user action required

#### Pass Criteria:

- localStorage becomes `null` after 5 minutes
- Button re-enables without user interaction
- If transfer truly failed, user can retry after timeout

---

### TEST 4: Retry Cooldown (Layer 3 - Backend)

**Purpose:** Verify 60-second cooldown between retries

#### Steps:

1. Initiate a transfer with `0.001 GAPC`
2. Let it proceed (don't refresh)
3. Wait for transaction to complete or fail
4. If it fails, look for error message with **"Reintentar en Xs"** button
5. **Try to click retry button immediately**

#### Expected Behavior:

- ✅ Retry button should be **DISABLED** initially
- ✅ Shows countdown: **"Reintentar en 60s"**, **"Reintentar en 59s"**, etc.
- ✅ Countdown decrements every second
- ✅ After 60 seconds, button becomes **enabled** again
- ✅ User can now safely retry

#### Pass Criteria:

- Retry button disabled during cooldown
- Countdown timer displays correctly
- Button enables after 60 seconds
- Can click to retry only after countdown completes

---

### TEST 5: No Network Indicator (Bonus Check)

**Purpose:** Verify mainnet-only mode is active

#### Steps:

1. Open transfer page
2. Look at **top of page or header**
3. Search for any badge/label showing:
   - "Devnet"
   - "Testing"
   - "Network Indicator"
   - Any cluster information

#### Expected Behavior:

- ✅ **NO network badge visible** - system runs silently on mainnet
- ✅ Explorer links use **solscan.io** (no `?cluster=devnet` parameter)
- ✅ Looks like production UI, not testnet

#### Pass Criteria:

- No network indicators visible
- All Solana Explorer links point to mainnet URLs
- Looks professional/production-ready

---

### TEST 6: End-to-End: Multiple Click Prevention

**Purpose:** Verify user can't click button multiple times to trigger duplicates

#### Steps:

1. Fill transfer form with valid data
2. Click **"Confirmar Transferencia"** button **5 times rapidly**
3. Watch button behavior
4. Check browser network tab (DevTools → Network)
5. Count how many POST requests to `/api/v1/trpc/...` appear

#### Expected Behavior:

- ✅ Button becomes disabled **after first click**
- ✅ Clicks 2-5 have **no effect** (button doesn't respond)
- ✅ **Only 1 API request** is sent despite 5 clicks
- ✅ Transfer processes normally
- ✅ No duplicate charge to user's account

#### Pass Criteria:

- Button disabled after first click
- Multiple clicks don't trigger multiple requests
- Exactly 1 API call in network tab
- Transaction appears only once on blockchain

---

### TEST 7: Error Recovery (if transfer fails)

**Purpose:** Verify button re-enables after failed transfer

#### Steps:

1. Start a transfer
2. **Close Phantom popup** (don't sign) → Transfer should fail
3. Wait for error message to appear
4. Check localStorage: `localStorage.getItem('transferInProgress')`

#### Expected Behavior:

- ✅ Error message appears: **"Transacción rechazada por usuario"** or similar
- ✅ Button becomes **enabled** again
- ✅ localStorage clears automatically
- ✅ User can retry by clicking button again

#### Pass Criteria:

- Button re-enables on error
- localStorage clears on error
- User can immediately retry
- No stuck state

---

### TEST 8: Success State Reset (if transfer succeeds)

**Purpose:** Verify button re-enables after successful transfer

#### Steps:

1. Start a transfer with valid data
2. Approve in Phantom wallet
3. Wait for "Transferencia completada" message
4. Check localStorage: `localStorage.getItem('transferInProgress')`

#### Expected Behavior:

- ✅ Success message appears
- ✅ Button becomes **enabled** again
- ✅ localStorage is **cleared** (`null`)
- ✅ User can initiate another transfer
- ✅ No network request for **identical transaction** within 60 seconds (Layer 3 backend check)

#### Pass Criteria:

- Button re-enables on success
- localStorage clears on success
- User can do another transfer immediately
- Backend rejects duplicate within 60 seconds

---

## 🔍 DevTools Console Debugging

### Useful Console Commands

```javascript
// Check if transfer is in progress
localStorage.getItem("transferInProgress");
// Expected: null or "true"

// Manually clear stuck state (emergency only)
localStorage.removeItem("transferInProgress");

// Check all localStorage keys
Object.keys(localStorage).forEach((key) =>
  console.log(`${key}: ${localStorage.getItem(key)}`),
);

// Monitor localStorage changes
window.addEventListener("storage", (e) => {
  if (e.key === "transferInProgress") {
    console.log(`transferInProgress changed to: ${e.newValue}`);
  }
});
```

### Network Tab Debugging

1. Open DevTools → **Network** tab
2. Filter by **Fetch/XHR**
3. Perform a transfer
4. Look for POST requests to:
   - `/api/v1/trpc/...` (tRPC call)
   - `/api/v1/transactions/send` (submit signature)
   - `/api/v1/purchase/confirm/...` (confirm transfer)

**Expected:** Exactly **1 call to each endpoint** per transfer

---

## ❌ Common Issues & Troubleshooting

### Issue 1: Button Still Enabled After Click

**Symptom:** Clicked button but it's still clickable

**Possible Causes:**

- localStorage is disabled in browser
- JavaScript error preventing state update
- useState not updating properly

**Solution:**

1. Check browser privacy settings
2. Open Console tab → look for red errors
3. Refresh page and try again
4. Check if `setIsTransferInProgress(true)` is being called

---

### Issue 2: Button Stuck Disabled Forever

**Symptom:** Button won't enable even after transfer completes

**Possible Causes:**

- Browser crash during transfer
- Network disconnect
- 5-minute timeout not triggered

**Solutions:**

- **Quick Fix:** `localStorage.removeItem('transferInProgress')` in console, then refresh
- **Permanent Fix:** Browser will auto-clear after 5 minutes
- **Hard Reset:** Close all tabs and reopen application

---

### Issue 3: Retry Button Shows Wrong Countdown

**Symptom:** Cooldown shows "Reintentar en 0s" but button stays disabled

**Possible Causes:**

- Timer calculation issue
- Button state out of sync

**Solution:**

1. Wait 60 seconds (timer will catch up)
2. Or clear state: `localStorage.removeItem('transferInProgress')`
3. Or refresh page

---

### Issue 4: Network Badge Still Shows "Devnet"

**Symptom:** See "Devnet (Testing)" badge on page

**Possible Causes:**

- Code not deployed
- Caching issue

**Solution:**

1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear cache: DevTools → Network → Disable cache checkbox → reload
3. Check if `npm run build` was run and deployed

---

## 📊 Success Metrics

After all tests pass, verify:

| Metric                                  | Before Fix    | After Fix      | Status |
| --------------------------------------- | ------------- | -------------- | ------ |
| Duplicate transactions per user         | 5-10          | 1 (max)        | ✅     |
| SOL lost per user                       | 0.01-0.10 SOL | 0.000005 SOL   | ✅     |
| User can click button multiple times    | Yes ❌        | No ✅          |        |
| Button re-enables after failed transfer | Never 🔴      | Immediately ✅ |        |
| Page refresh loses state                | Yes ❌        | No ✅          |        |
| Retry cooldown enforced                 | No ❌         | Yes ✅         |        |
| Network indicator visible               | Yes ❌        | No ✅          |        |

---

## 🚀 When All Tests Pass

1. ✅ Tests 1-8 all pass
2. ✅ No errors in console
3. ✅ All DevTools checks successful
4. ✅ No network badge visible
5. ✅ Transfers process cleanly

**Then:** Push to production with confidence! 🎉

```bash
git push origin main
```

---

## 📝 Test Results Template

Copy this template and fill in as you test:

```
Date: 2025-12-19
Tester: [Your Name]
Environment: [Local Dev / Staging / Production]

TEST 1 (Button Disable): ✅ PASS / ❌ FAIL
  Notes: _______________________________

TEST 2 (localStorage Persistence): ✅ PASS / ❌ FAIL
  Notes: _______________________________

TEST 3 (Auto-Clear 5min): ✅ PASS / ❌ FAIL
  Notes: _______________________________

TEST 4 (Retry Cooldown): ✅ PASS / ❌ FAIL
  Notes: _______________________________

TEST 5 (No Network Badge): ✅ PASS / ❌ FAIL
  Notes: _______________________________

TEST 6 (Multiple Click Prevention): ✅ PASS / ❌ FAIL
  Notes: _______________________________

TEST 7 (Error Recovery): ✅ PASS / ❌ FAIL
  Notes: _______________________________

TEST 8 (Success State Reset): ✅ PASS / ❌ FAIL
  Notes: _______________________________

Overall: ✅ ALL PASS / ⚠️ NEEDS FIXES

Issues Found: [List any issues]

Recommendations: [Any improvements]
```

---

## 🔗 Related Documentation

- [DUPLICATE_TRANSFER_FIX.md](./DUPLICATE_TRANSFER_FIX.md) - Technical implementation details
- [TRANSFER_SYSTEM.md](./TRANSFER_SYSTEM.md) - High-level transfer flow architecture
- [CODE LOCATIONS](../README.md) - Where to find the code

---

## ❓ Questions?

Check these files:

1. Frontend implementation: `apps/web/components/views/transfer-view.tsx`
2. Error display with cooldown: `apps/web/components/transfer/transfer-error-display.tsx`
3. Backend duplicate detection: `apps/api/src/controllers/transfer/transfer.controller.ts`

All changes are documented with `// CRITICAL:` or `// Layer X:` comments for easy navigation.
