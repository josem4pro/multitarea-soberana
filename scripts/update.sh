#!/bin/bash
set -e

echo "=== Actualización de Multitarea Soberana ==="
echo ""

# 1. Verificar que extensión esté instalada
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/multitarea-soberana@local"
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "ERROR: Extensión no instalada. Ejecuta install.sh primero."
    exit 1
fi

# 2. Deshabilitar extensión (para evitar conflictos durante copia)
echo "[1/5] Deshabilitando extensión temporalmente..."
gnome-extensions disable multitarea-soberana@local 2>/dev/null || true

# 3. Backup de configuración existente (si existe)
echo "[2/5] Creando backup de configuración..."
if [ -d "$HOME/.config/multitarea-soberana" ]; then
    BACKUP_DIR="$HOME/.config/multitarea-soberana/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$HOME/.config/multitarea-soberana/"* "$BACKUP_DIR/" 2>/dev/null || true
    echo "  Backup creado en: $BACKUP_DIR"
fi

# 4. Actualizar archivos
echo "[3/5] Actualizando archivos de extensión..."
cp -r extension/* "$EXTENSION_DIR/"
echo "[4/5] Actualizando módulo core..."
cp -r core "$EXTENSION_DIR/"

# 5. Rehabilitar extensión
echo "[5/5] Habilitando extensión..."
gnome-extensions enable multitarea-soberana@local

echo ""
echo "✅ Actualización completada."
echo ""
echo "IMPORTANTE: Reinicia GNOME Shell para aplicar cambios:"
echo "  - Wayland: Cierra sesión y vuelve a iniciar"
echo "  - X11: Alt+F2 → r → Enter"
