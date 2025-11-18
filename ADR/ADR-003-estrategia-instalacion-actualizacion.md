# ADR-003: Estrategia de Instalación y Actualización

**Estado**: Aceptado
**Fecha**: 2025-11-18
**Decisores**: José (usuario) + Claude Code (análisis técnico)
**Depende de**: ADR-001 (Elección de GNOME Shell Extension)

---

## Contexto

**REQ-NF-002 (Instalable y Revertible)** requiere que la solución sea:
- Fácil de instalar sin permisos de root
- Actualizable desde el repositorio
- Completamente des instalable sin dejar rastros
- No modificar archivos del sistema fuera del directorio de usuario

**Restricciones del entorno**:
- Usuario sin sudo (instalación en home directory)
- Ubuntu 24 Desktop con GNOME Shell 46+
- Extensión GNOME Shell como tecnología base (ADR-001)

**Preguntas a resolver**:
1. ¿Dónde se instala la extensión?
2. ¿Cómo se actualiza sin romper configuración existente?
3. ¿Cómo se desinstala completamente?
4. ¿Qué pasa con configuraciones de usuario (gsettings)?
5. ¿Cómo se reinicia GNOME Shell después de instalar/actualizar?

---

## Decisión

**Estrategia de instalación en tres niveles:**

### Nivel 1: Repositorio de Desarrollo (`~/multitarea-soberana`)

**Propósito**: Código fuente, documentación, tests
**Ubicación**: `~/multitarea-soberana/`
**Control de versiones**: Git

**Estructura**:
```
~/multitarea-soberana/
├── core/                  # JavaScript puro (lógica de reglas)
├── extension/             # GJS (integración GNOME)
├── tests/                 # Tests automatizados
├── scripts/               # Scripts de instalación/actualización
│   ├── install.sh
│   ├── update.sh
│   ├── uninstall.sh
│   └── dev-logs.sh
├── docs/                  # Documentación técnica
├── ADR/                   # Decision records
└── README.md              # Guía de usuario
```

---

### Nivel 2: Extensión Instalada (`~/.local/share/gnome-shell/extensions/`)

**Propósito**: Extensión activa que GNOME Shell carga
**Ubicación**: `~/.local/share/gnome-shell/extensions/multitarea-soberana@local/`

**Contenido (copiado desde `~/multitarea-soberana/extension/`)**:
```
~/.local/share/gnome-shell/extensions/multitarea-soberana@local/
├── extension.js           # Punto de entrada
├── metadata.json          # Metadata de extensión
├── prefs.js               # Preferencias (opcional)
└── core/                  # Core de reglas (copiado desde ~/multitarea-soberana/core/)
    └── rules.js
```

**Permisos**: Solo usuario (chmod 755)

**GNOME Shell behavior**: Lee automáticamente este directorio al login o al ejecutar `gnome-extensions enable`.

---

### Nivel 3: Configuración de Usuario (gsettings)

**Propósito**: Configuración de dash-to-dock (si se modifica)
**Ubicación**: `~/.config/dconf/user` (manejado por gsettings)

**Cambios aplicados (opcional)**:
```bash
# Backup de configuración original
gsettings get org.gnome.shell.extensions.dash-to-dock isolate-workspaces > ~/.config/multitarea-soberana/backup-settings.txt
gsettings get org.gnome.shell.extensions.dash-to-dock click-action >> ~/.config/multitarea-soberana/backup-settings.txt

# Aplicar nuevos settings
gsettings set org.gnome.shell.extensions.dash-to-dock isolate-workspaces true
gsettings set org.gnome.shell.extensions.dash-to-dock click-action 'focus-or-previews'
```

**Nota**: Si la extensión usa monkey-patching, NO se modifican gsettings (decisión en implementación).

---

## Flujos de Operación

### 1. Instalación Inicial

**Script**: `scripts/install.sh`

**Pasos**:
```bash
#!/bin/bash
set -e  # Exit on error

# 1. Verificar requisitos
echo "[1/6] Verificando requisitos..."
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

# 2. Crear directorio de extensión
echo "[2/6] Creando directorio de extensión..."
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/multitarea-soberana@local"
mkdir -p "$EXTENSION_DIR"

# 3. Copiar archivos de extensión
echo "[3/6] Copiando archivos de extensión..."
cp -r extension/* "$EXTENSION_DIR/"

# 4. Copiar módulo core
echo "[4/6] Copiando módulo core de reglas..."
cp -r core "$EXTENSION_DIR/"

# 5. Crear directorio de configuración
echo "[5/6] Creando directorio de configuración..."
mkdir -p "$HOME/.config/multitarea-soberana"

# 6. Habilitar extensión
echo "[6/6] Habilitando extensión..."
gnome-extensions enable multitarea-soberana@local

echo "✅ Instalación completada."
echo ""
echo "IMPORTANTE: Debes reiniciar GNOME Shell para que la extensión se active:"
echo "  - En Wayland: Cierra sesión y vuelve a iniciar (Alt+F2 no funciona)"
echo "  - En X11: Presiona Alt+F2, escribe 'r' y Enter"
echo ""
echo "Después de reiniciar, verifica el estado con:"
echo "  gnome-extensions list --enabled | grep multitarea-soberana"
```

**Requisitos**:
- ✅ Sin sudo
- ✅ Solo modifica `~/.local/share/gnome-shell/extensions/` y `~/.config/`
- ✅ Validación de requisitos antes de instalar
- ✅ Mensajes claros sobre próximos pasos

---

### 2. Actualización

**Script**: `scripts/update.sh`

**Pasos**:
```bash
#!/bin/bash
set -e

echo "[1/5] Actualizando multitarea-soberana..."

# 1. Verificar que extensión esté instalada
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/multitarea-soberana@local"
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "ERROR: Extensión no instalada. Ejecuta install.sh primero."
    exit 1
fi

# 2. Deshabilitar extensión (para evitar conflictos durante copia)
echo "[2/5] Deshabilitando extensión temporalmente..."
gnome-extensions disable multitarea-soberana@local || true

# 3. Backup de configuración existente (si existe)
echo "[3/5] Creando backup de configuración..."
if [ -d "$HOME/.config/multitarea-soberana" ]; then
    BACKUP_DIR="$HOME/.config/multitarea-soberana/backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$HOME/.config/multitarea-soberana/"* "$BACKUP_DIR/" 2>/dev/null || true
    echo "  Backup creado en: $BACKUP_DIR"
fi

# 4. Actualizar archivos
echo "[4/5] Actualizando archivos de extensión..."
cp -r extension/* "$EXTENSION_DIR/"
cp -r core "$EXTENSION_DIR/"

# 5. Rehabilitar extensión
echo "[5/5] Habilitando extensión..."
gnome-extensions enable multitarea-soberana@local

echo "✅ Actualización completada."
echo ""
echo "IMPORTANTE: Reinicia GNOME Shell para aplicar cambios:"
echo "  - Wayland: Cierra sesión y vuelve a iniciar"
echo "  - X11: Alt+F2 → r → Enter"
```

**Características**:
- ✅ Backup automático de configuración
- ✅ Deshabilita antes de actualizar (evita crashes)
- ✅ Preserva datos de usuario

---

### 3. Desinstalación Completa

**Script**: `scripts/uninstall.sh`

**Pasos**:
```bash
#!/bin/bash
set -e

echo "[1/4] Desinstalando multitarea-soberana..."

# 1. Deshabilitar extensión
echo "[2/4] Deshabilitando extensión..."
gnome-extensions disable multitarea-soberana@local || true

# 2. Eliminar directorio de extensión
echo "[3/4] Eliminando archivos de extensión..."
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/multitarea-soberana@local"
if [ -d "$EXTENSION_DIR" ]; then
    rm -rf "$EXTENSION_DIR"
    echo "  Extensión eliminada de: $EXTENSION_DIR"
else
    echo "  Extensión no encontrada (ya desinstalada)"
fi

# 3. Opcional: Restaurar configuración de dash-to-dock (si se modificó)
echo "[4/4] ¿Deseas restaurar configuración original de dash-to-dock? (y/N): "
read -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    BACKUP_FILE="$HOME/.config/multitarea-soberana/backup-settings.txt"
    if [ -f "$BACKUP_FILE" ]; then
        # Parsear y restaurar settings
        while IFS= read -r line; do
            gsettings reset org.gnome.shell.extensions.dash-to-dock isolate-workspaces
            gsettings reset org.gnome.shell.extensions.dash-to-dock click-action
        done < "$BACKUP_FILE"
        echo "  Configuración restaurada"
    else
        echo "  No se encontró backup de configuración"
    fi
fi

echo "✅ Desinstalación completada."
echo ""
echo "Puedes eliminar manualmente el directorio de desarrollo:"
echo "  rm -rf ~/multitarea-soberana"
echo ""
echo "Y el directorio de configuración:"
echo "  rm -rf ~/.config/multitarea-soberana"
```

**Características**:
- ✅ Deshabilitación segura
- ✅ Eliminación completa de archivos de extensión
- ✅ Opción de restaurar configuración original
- ✅ Guía para eliminar directorios opcionales

---

## Alternativas Consideradas

### Alternativa 1: Instalación via `make install`

**Descripción**: Usar Makefile con target `make install`.

**Ventajas**:
- ✅ Estándar en proyectos Linux
- ✅ Familiar para desarrolladores

**Desventajas**:
- ❌ Requiere `make` instalado (no siempre disponible en Ubuntu Desktop)
- ❌ Menos claro para usuarios no técnicos
- ❌ Makefiles complejos para operaciones simples de copia

**Conclusión**: ❌ **Rechazada** - Scripts Bash más simples y universales.

---

### Alternativa 2: Empaquetado como .deb

**Descripción**: Crear paquete Debian instalable con `apt install`.

**Ventajas**:
- ✅ Instalación estándar de Ubuntu
- ✅ Gestión de dependencias automática
- ✅ Desinstalación con `apt remove`

**Desventajas**:
- ❌ **Requiere firma de paquete** (proceso complejo)
- ❌ **Requiere PPA** (Personal Package Archive) para distribución
- ❌ **No se puede instalar sin sudo** (viola requisito)
- ❌ Overhead de mantenimiento (versioning, changelog, control files)

**Conclusión**: ❌ **Rechazada** - Complejidad desproporcionada para extensión de usuario.

---

### Alternativa 3: Publicar en extensions.gnome.org

**Descripción**: Subir extensión al sitio oficial de extensiones GNOME.

**Ventajas**:
- ✅ Instalación con un clic desde GNOME Extensions app
- ✅ Actualizaciones automáticas
- ✅ Visible para comunidad GNOME

**Desventajas**:
- ⚠️ **Proceso de revisión manual** (puede tomar semanas)
- ⚠️ **Requisitos de código estrictos** (no permite monkey-patching agresivo)
- ⚠️ **UUID debe ser único** (requiere dominio o usar @local)
- ⚠️ No permite configuración avanzada (gsettings debe tener schema XML)

**Conclusión**: ⚠️ **FUTURO (v2.0)** - Válido después de v1.0 estable y probado.

---

### Alternativa 4: Symlink en lugar de copia

**Descripción**: Crear symlink desde `~/.local/share/gnome-shell/extensions/` hacia `~/multitarea-soberana/extension/`.

**Ventajas**:
- ✅ Cambios en `~/multitarea-soberana/` se reflejan inmediatamente
- ✅ No necesita `update.sh` (solo reload de GNOME Shell)

**Desventajas**:
- ❌ **GNOME Shell a veces no sigue symlinks** (comportamiento inconsistente)
- ❌ Si se borra `~/multitarea-soberana/` → extensión rota
- ❌ Dificulta debugging (logs apuntan a symlink, no a fuente)

**Conclusión**: ❌ **Rechazada** - Copia es más confiable.

---

## Justificación de la Decisión

### ¿Por qué scripts Bash simples?

#### 1. Sin dependencias externas

**Requerido solo**:
- Bash (incluido en Ubuntu por defecto)
- `gnome-extensions` (incluido en gnome-shell-extensions)
- `cp`, `mkdir`, `rm` (coreutils estándar)

**No requiere**:
- ❌ Python, Node.js, Ruby
- ❌ make, cmake
- ❌ Docker, Flatpak
- ❌ sudo (privilegios root)

---

#### 2. Transparencia total

**Usuario puede leer exactamente qué hace cada script**:
```bash
# Línea 23 de install.sh
cp -r extension/* "$EXTENSION_DIR/"
```

**Comparado con**:
- Makefile: Sintaxis críptica para no-desarrolladores
- .deb: Proceso opaco (pre/post install scripts ocultos)
- Python installer: Requiere entender Python

---

#### 3. Cumple REQ-NF-002

| Requisito | Implementación | ✅ |
|-----------|----------------|---|
| Instalable sin root | Scripts solo modifican `~/` | ✅ |
| Actualizable | `update.sh` con backup automático | ✅ |
| Desinstalable | `uninstall.sh` elimina todo | ✅ |
| No modifica sistema | Solo `~/.local` y `~/.config` | ✅ |

---

## Manejo de Reinicio de GNOME Shell

### Problema

GNOME Shell debe reiniciarse para cargar/recargar extensiones.

**En X11**:
```bash
# Funciona (reinicia GNOME Shell in-place)
killall -HUP gnome-shell
# o
Alt+F2 → r → Enter
```

**En Wayland**:
```bash
# NO FUNCIONA (Wayland no permite reini cio de compositor)
# Usuario DEBE cerrar sesión y volver a iniciar
```

### Decisión

**Scripts NO reinician automáticamente GNOME Shell.**

**Razón**:
- En Wayland, no es posible reinicio automático sin cerrar sesión
- Forzar logout automático es invasivo (usuario puede perder trabajo)

**En su lugar**:
- Scripts muestran mensaje claro indicando cómo reiniciar
- Usuario decide cuándo es conveniente reiniciar

**Mensaje de ejemplo**:
```
✅ Instalación completada.

IMPORTANTE: Debes reiniciar GNOME Shell para que la extensión se active:
  - En Wayland: Cierra sesión y vuelve a iniciar (Alt+F2 no funciona)
  - En X11: Presiona Alt+F2, escribe 'r' y Enter

Después de reiniciar, verifica el estado con:
  gnome-extensions list --enabled | grep multitarea-soberana
```

---

## Estructura de Directorios Final

```
~/ (home directory)
├── multitarea-soberana/               # Repo de desarrollo
│   ├── core/
│   │   └── rules.js
│   ├── extension/
│   │   ├── extension.js
│   │   ├── metadata.json
│   │   └── prefs.js
│   ├── tests/
│   ├── scripts/
│   │   ├── install.sh                 # ← Instalación inicial
│   │   ├── update.sh                  # ← Actualización
│   │   ├── uninstall.sh               # ← Desinstalación
│   │   ├── dev-logs.sh                # ← Ver logs en tiempo real
│   │   └── test.sh                    # ← Correr tests
│   ├── docs/
│   ├── ADR/
│   └── README.md
│
├── .local/share/gnome-shell/extensions/
│   └── multitarea-soberana@local/     # Extensión instalada (copia)
│       ├── extension.js
│       ├── metadata.json
│       ├── prefs.js
│       └── core/
│           └── rules.js
│
└── .config/
    └── multitarea-soberana/           # Configuración de usuario
        ├── backup-settings.txt        # Backup de gsettings original
        └── backup-YYYYMMDD-HHMMSS/    # Backups de actualizaciones
```

---

## Metadata de Extensión

**Archivo**: `extension/metadata.json`

```json
{
  "uuid": "multitarea-soberana@local",
  "name": "Multitarea Soberana",
  "description": "Control total de workspaces: forzar apps al workspace actual y evitar cambios automáticos de workspace.",
  "version": 1,
  "shell-version": [
    "46",
    "47"
  ],
  "url": "https://github.com/josem4pro/multitarea-soberana",
  "settings-schema": "org.gnome.shell.extensions.multitarea-soberana"
}
```

**Campos críticos**:
- `uuid`: Debe terminar en `@local` (indica extensión local, no de extensions.gnome.org)
- `shell-version`: Array de versiones de GNOME Shell soportadas
- `settings-schema`: Schema de gsettings (si se usa configuración)

---

## Consecuencias

### Consecuencias Positivas

1. ✅ **Instalación simple**: 3 comandos (`git clone`, `cd`, `./scripts/install.sh`)

2. ✅ **Actualización segura**: Backup automático preserva configuración

3. ✅ **Desinstalación completa**: Sin rastros en el sistema

4. ✅ **Sin dependencias externas**: Solo Bash + gnome-extensions

5. ✅ **Transparente**: Usuario puede ver exactamente qué hace cada script

6. ✅ **Versionable**: Scripts en Git permiten rollback si falla actualización

7. ✅ **Cumple todos los requisitos no funcionales** de instalación/revertibilidad

---

### Consecuencias Negativas (y Mitigaciones)

1. ⚠️ **Reinicio manual requerido**:
   - **Problema**: Usuario debe cerrar sesión en Wayland
   - **Mitigación**: Mensaje claro en output de scripts

2. ⚠️ **Sin actualizaciones automáticas**:
   - **Problema**: Usuario debe ejecutar `git pull && ./scripts/update.sh` manualmente
   - **Mitigación**: Documentar en README, considerar notificaciones en v2.0

3. ⚠️ **No detecta conflictos de extensiones**:
   - **Problema**: Otras extensiones pueden interferir
   - **Mitigación**: Documentar extensiones incompatibles conocidas en README

---

## Plan de Testing de Scripts

### Tests Automatizados (Bash)

**Archivo**: `tests/scripts.test.sh`

```bash
#!/bin/bash

# Test 1: install.sh crea directorio correcto
test_install_creates_directory() {
    ./scripts/install.sh
    [ -d "$HOME/.local/share/gnome-shell/extensions/multitarea-soberana@local" ]
    assertEquals "Directory created" 0 $?
}

# Test 2: uninstall.sh elimina directorio
test_uninstall_removes_directory() {
    ./scripts/install.sh
    ./scripts/uninstall.sh
    [ ! -d "$HOME/.local/share/gnome-shell/extensions/multitarea-soberana@local" ]
    assertEquals "Directory removed" 0 $?
}

# Test 3: update.sh crea backup
test_update_creates_backup() {
    ./scripts/install.sh
    ./scripts/update.sh
    BACKUP_EXISTS=$(ls -d ~/.config/multitarea-soberana/backup-* 2>/dev/null | wc -l)
    assertTrue "Backup created" "[ $BACKUP_EXISTS -gt 0 ]"
}
```

**Ejecutar**: `bash tests/scripts.test.sh`

---

### Tests Manuales (Checklist)

- [ ] Instalar en sistema limpio → extensión aparece en `gnome-extensions list`
- [ ] Actualizar con configuración existente → backup creado
- [ ] Desinstalar → directorio eliminado, extensión no aparece en lista
- [ ] Instalar sin GNOME Shell → error claro mostrado
- [ ] Instalar con GNOME < 46 → advertencia mostrada

---

## Referencias

### Documentación Oficial GNOME
- Extension structure: https://gjs.guide/extensions/overview/anatomy.html
- gnome-extensions CLI: https://man.archlinux.org/man/gnome-extensions.1.en
- Extension metadata: https://gjs.guide/extensions/topics/metadata.html

### Requisitos
- `docs/requisitos/requisitos-detallados.md` - REQ-NF-002 (Instalable y Revertible)

### Ejemplos de Extensiones
- Auto Move Windows install: https://github.com/GNOME/gnome-shell-extensions/tree/main/extensions/auto-move-windows (usa structure similar)
- Dash to Dock: https://github.com/micheleg/dash-to-dock (tiene Makefile pero también funciona con copia manual)

---

## Revisiones

| Fecha | Versión | Cambio | Autor |
|-------|---------|--------|-------|
| 2025-11-18 | 1.0 | Decisión inicial | Claude Code + José |

---

**Estado final**: ✅ **ACEPTADO**

**Confianza**: ALTA (90%)

**Implementación**: Scripts serán creados en FASE 5.
