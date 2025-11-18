#!/bin/bash
set -e

echo "=== Desinstalación de Multitarea Soberana ==="
echo ""

# 1. Deshabilitar extensión
echo "[1/3] Deshabilitando extensión..."
gnome-extensions disable multitarea-soberana@local 2>/dev/null || true

# 2. Eliminar directorio de extensión
echo "[2/3] Eliminando archivos de extensión..."
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/multitarea-soberana@local"
if [ -d "$EXTENSION_DIR" ]; then
    rm -rf "$EXTENSION_DIR"
    echo "  Extensión eliminada de: $EXTENSION_DIR"
else
    echo "  Extensión no encontrada (ya desinstalada)"
fi

# 3. Preguntar si eliminar configuración
echo "[3/3] ¿Deseas eliminar también la configuración guardada? (y/N): "
read -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "$HOME/.config/multitarea-soberana" ]; then
        rm -rf "$HOME/.config/multitarea-soberana"
        echo "  Configuración eliminada"
    fi
fi

echo ""
echo "✅ Desinstalación completada."
echo ""
echo "Puedes eliminar manualmente el directorio de desarrollo:"
echo "  rm -rf ~/multitarea-soberana"
echo ""
echo "IMPORTANTE: Reinicia GNOME Shell para completar la desinstalación:"
echo "  - Wayland: Cierra sesión y vuelve a iniciar"
echo "  - X11: Alt+F2 → r → Enter"
