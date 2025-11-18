#!/bin/bash

echo "=== Logs de Multitarea Soberana ==="
echo "Presiona Ctrl+C para salir"
echo ""

journalctl -f -o cat /usr/bin/gnome-shell | grep -i --line-buffered "multitarea-soberana"
