#!/bin/bash
set -e  # Exit on error

echo "=== Instalación de Multitarea Soberana ==="
echo ""

# 1. Verificar requisitos
echo "[1/7] Verificando requisitos..."
if ! command -v gnome-shell &> /dev/null; then
    echo "ERROR: GNOME Shell no encontrado. Este proyecto requiere GNOME Shell 46+."
    exit 1
fi

GNOME_VERSION=$(gnome-shell --version | grep -oP '\d+' | head -1)
if [ "$GNOME_VERSION" -lt 46 ]; then
    echo "ADVERTENCIA: GNOME Shell $GNOME_VERSION detectado. Se recomienda GNOME 46+."
    read -p "¿Continuar de todos modos? (y/N): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# 2. Verificar extensiones conflictivas
echo "[2/7] Verificando extensiones conflictivas..."
CONFLICTING_EXTS="auto-move-windows@gnome-shell-extensions.gcampax.github.com"
for ext in $CONFLICTING_EXTS; do
    if gnome-extensions list --enabled 2>/dev/null | grep -q "$ext"; then
        echo "ADVERTENCIA: Extensión conflictiva detectada: $ext"
        echo "Se recomienda deshabilitarla: gnome-extensions disable $ext"
    fi
done

# 3. Crear directorio de extensión
echo "[3/7] Creando directorio de extensión..."
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/multitarea-soberana@local"
mkdir -p "$EXTENSION_DIR"

# 4. Copiar archivos de extensión
echo "[4/7] Copiando archivos de extensión..."
cp -r extension/* "$EXTENSION_DIR/"

# 5. Copiar módulo core
echo "[5/7] Copiando módulo core de reglas..."
cp -r core "$EXTENSION_DIR/"

# 6. Crear directorio de configuración
echo "[6/7] Creando directorio de configuración..."
mkdir -p "$HOME/.config/multitarea-soberana"

# 7. Habilitar extensión
echo "[7/7] Habilitando extensión..."
gnome-extensions enable multitarea-soberana@local

echo ""
echo "✅ Instalación completada."
echo ""
echo "⚠️  IMPORTANTE: Guarda todo tu trabajo antes de reiniciar GNOME Shell"
read -p "¿Has guardado todo tu trabajo? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "IMPORTANTE: Debes reiniciar GNOME Shell para que la extensión se active:"
    echo "  - En Wayland: Cierra sesión y vuelve a iniciar (Alt+F2 no funciona)"
    echo "  - En X11: Presiona Alt+F2, escribe 'r' y Enter"
    echo ""
    echo "Después de reiniciar, verifica el estado con:"
    echo "  gnome-extensions list --enabled | grep multitarea-soberana"
    echo ""
    echo "Para ver logs en tiempo real:"
    echo "  ./scripts/dev-logs.sh"
else
    echo "Guarda tu trabajo y luego reinicia GNOME Shell manualmente."
fi
