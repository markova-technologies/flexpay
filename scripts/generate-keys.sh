#!/bin/bash
# scripts/generate-keys.sh - FlexPay RS256 Keypair Generator
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -in private.pem -pubout -out public.pem
echo "JWT_PRIVATE_KEY=$(cat private.pem | tr '\n' '|' | sed 's/|/\\n/g')"
echo "JWT_PUBLIC_KEY=$(cat public.pem | tr '\n' '|' | sed 's/|/\\n/g')"
