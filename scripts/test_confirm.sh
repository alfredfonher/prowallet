#!/bin/bash

# Test endpoint
BASE_URL="http://localhost:3001/api/v1"
TX_ID="8eb6dd78-7393-42f5-b834-af6a122f02fe"

echo "Testing POST $BASE_URL/purchase/confirm/$TX_ID"
echo ""

curl -X POST \
  "$BASE_URL/purchase/confirm/$TX_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "3e2Ef2w1fdve7CVLtcEMDhGSMPhnBuFJqaHzRrBYnm3CR7ZszVcXUCY6XgWSjfgpVo3cR5RCT396WSLnhAsQazgR",
    "blockSlot": 0
  }' \
  -v

echo ""
echo ""
