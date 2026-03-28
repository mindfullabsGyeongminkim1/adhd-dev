#!/bin/bash
SOCK="$HOME/.adhd-dev/adhd-dev.sock"
if [ -S "$SOCK" ]; then
  echo '{"jsonrpc":"2.0","id":0,"method":"hook.event","params":{"event":"notification","ts":'$(date +%s)'}}' | nc -U -w1 "$SOCK" 2>/dev/null
fi
