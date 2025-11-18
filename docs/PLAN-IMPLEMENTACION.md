# Plan de Implementación Detallado - multitarea-soberana

**Versión**: 1.0 (Pre-revisión)
**Fecha**: 2025-11-18
**Método**: TDD + Enfoque modular
**Estado**: Borrador (pendiente revisión por plan-reviewer)

---

## Principios Rectores

1. **TDD BLOQUEANTE**: No escribir código de producción sin tests primero
2. **Anti-racionalización**: No asumir que algo funciona sin evidencia
3. **Defensive coding**: Validaciones y manejo de errores robusto
4. **Documentación honesta**: Limitaciones claramente expuestas

---

## FASE 3: TDD y Scaffolding del Proyecto

### Objetivo

Crear estructura del repositorio y primeros tests ANTES del código de producción.

---

### 3.1. Crear Estructura de Directorios

**Comandos**:
```bash
cd ~/multitarea-soberana

# Ya creado: docs/, ADR/, extension/, core/, tests/, scripts/
# Crear subdirectorios adicionales
mkdir -p tests/fixtures
mkdir -p tests/integration
mkdir -p extension/schemas
mkdir -p docs/testing
```

**Verificar**:
```bash
tree -L 2 ~/multitarea-soberana
```

**Resultado esperado**:
```
~/multitarea-soberana/
├── ADR/
│   ├── ADR-001-eleccion-gnome-shell-extension.md
│   ├── ADR-002-separacion-core-reglas-integracion-gnome.md
│   └── ADR-003-estrategia-instalacion-actualizacion.md
├── core/
├── docs/
│   ├── investigacion/
│   ├── requisitos/
│   └── testing/
├── extension/
│   └── schemas/
├── scripts/
└── tests/
    ├── fixtures/
    └── integration/
```

**Entregable**: ✅ Estructura de directorios completa

---

### 3.2. Inicializar package.json para Tests

**Comando**:
```bash
cd ~/multitarea-soberana
cat > package.json << 'EOF'
{
  "name": "multitarea-soberana",
  "version": "1.0.0",
  "description": "Control total de workspaces en GNOME Shell",
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "test:watch": "node --test --watch tests/*.test.js"
  },
  "keywords": ["gnome", "workspace", "extension"],
  "author": "José",
  "license": "MIT"
}
EOF
```

**Verificar**:
```bash
cat package.json
npm test  # Debe fallar (no hay tests todavía)
```

**Entregable**: ✅ `package.json` configurado

---

### 3.3. Crear Fixtures de Test (Datos de Ejemplo)

**Archivo**: `tests/fixtures/window-contexts.json`

```bash
cat > tests/fixtures/window-contexts.json << 'EOF'
{
  "noWindows": {
    "currentWorkspace": 8,
    "app": "chrome",
    "existingWindows": []
  },
  "windowsInOtherWorkspaces": {
    "currentWorkspace": 8,
    "app": "chrome",
    "existingWindows": [
      { "workspace": 1, "minimized": false },
      { "workspace": 3, "minimized": false }
    ]
  },
  "windowInCurrentWorkspace": {
    "currentWorkspace": 8,
    "app": "firefox",
    "existingWindows": [
      { "workspace": 8, "minimized": false }
    ]
  },
  "minimizedInCurrentWorkspace": {
    "currentWorkspace": 8,
    "app": "terminal",
    "existingWindows": [
      { "workspace": 8, "minimized": true }
    ]
  },
  "multipleWindows": {
    "currentWorkspace": 8,
    "app": "vscode",
    "existingWindows": [
      { "workspace": 1, "minimized": false },
      { "workspace": 8, "minimized": false },
      { "workspace": 8, "minimized": true },
      { "workspace": 3, "minimized": false }
    ]
  }
}
EOF
```

**Entregable**: ✅ Fixtures de datos de test

---

### 3.4. Escribir Tests para core/rules.js (TDD BLOQUEANTE)

**Archivo**: `tests/rules.test.js`

```bash
cat > tests/rules.test.js << 'EOF'
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decideAction } from '../core/rules.js';

// Cargar fixtures
const fixturesRaw = await readFile('tests/fixtures/window-contexts.json', 'utf-8');
const fixtures = JSON.parse(fixturesRaw);

describe('Core de Reglas - decideAction()', () => {
    describe('REQ-001: Crear nueva ventana en workspace actual', () => {
        it('debe crear nueva ventana si app no tiene ventanas existentes', () => {
            const decision = decideAction(fixtures.noWindows);

            assert.equal(decision.action, 'CREATE_NEW_WINDOW');
            assert.equal(decision.workspace, 8);
            assert.equal(decision.switchWorkspace, false);
        });

        it('debe crear nueva ventana si app solo tiene ventanas en otros workspaces', () => {
            const decision = decideAction(fixtures.windowsInOtherWorkspaces);

            assert.equal(decision.action, 'CREATE_NEW_WINDOW');
            assert.equal(decision.workspace, 8);
            assert.equal(decision.switchWorkspace, false);
        });
    });

    describe('REQ-002: Evitar cambio automático de workspace', () => {
        it('nunca debe retornar switchWorkspace: true', () => {
            const allFixtures = Object.values(fixtures);

            for (const context of allFixtures) {
                const decision = decideAction(context);
                assert.equal(decision.switchWorkspace, false,
                    `switchWorkspace debe ser false para ${context.app}`);
            }
        });
    });

    describe('REQ-003: Activar ventana existente en workspace actual', () => {
        it('debe activar ventana NO minimizada en workspace actual', () => {
            const decision = decideAction(fixtures.windowInCurrentWorkspace);

            assert.equal(decision.action, 'ACTIVATE_EXISTING');
            assert.equal(decision.targetWindow, 0);
            assert.equal(decision.workspace, 8);
        });

        it('debe restaurar ventana minimizada en workspace actual', () => {
            const decision = decideAction(fixtures.minimizedInCurrentWorkspace);

            assert.equal(decision.action, 'RESTORE_WINDOW');
            assert.equal(decision.targetWindow, 0);
            assert.equal(decision.workspace, 8);
        });

        it('debe preferir ventana NO minimizada sobre minimizada en mismo workspace', () => {
            const decision = decideAction(fixtures.multipleWindows);

            assert.equal(decision.action, 'ACTIVATE_EXISTING');
            assert.equal(decision.targetWindow, 1); // Índice de ventana en WS 8 no minimizada
            assert.equal(decision.workspace, 8);
        });
    });

    describe('Validaciones defensivas', () => {
        it('debe manejar context sin currentWorkspace (default a 0)', () => {
            const invalidContext = { app: 'test', existingWindows: [] };
            const decision = decideAction(invalidContext);

            assert.equal(decision.workspace, 0);
        });

        it('debe manejar context sin existingWindows (default a [])', () => {
            const invalidContext = { currentWorkspace: 5, app: 'test' };
            const decision = decideAction(invalidContext);

            assert.equal(decision.action, 'CREATE_NEW_WINDOW');
        });

        it('debe lanzar error si context es null', () => {
            assert.throws(() => decideAction(null), {
                name: 'TypeError',
                message: /context is required/
            });
        });
    });
});
EOF
```

**Ejecutar tests (DEBEN FALLAR - no existe core/rules.js todavía)**:
```bash
npm test
```

**Resultado esperado**:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '../core/rules.js'
```

**Entregable**: ✅ Tests escritos y fallando (Red phase de TDD)

---

### 3.5. Implementar core/rules.js Hasta Pasar Tests (Green Phase)

**Archivo**: `core/rules.js`

```bash
cat > core/rules.js << 'EOF'
/**
 * Core de Reglas - Lógica de decisión para workspace management
 * JavaScript puro (sin dependencias de GJS/GNOME)
 */

/**
 * Decide qué acción tomar al activar una aplicación
 *
 * @param {Object} context - Contexto de la aplicación
 * @param {number} context.currentWorkspace - Workspace actual (0-based)
 * @param {string} context.app - ID de la aplicación
 * @param {Array} context.existingWindows - Ventanas existentes de la app
 * @returns {Object} Decisión con action, workspace, y switchWorkspace
 */
export function decideAction(context) {
    // Validación defensiva
    if (!context || typeof context !== 'object') {
        throw new TypeError('context is required and must be an object');
    }

    const currentWorkspace = context.currentWorkspace || 0;
    const existingWindows = context.existingWindows || [];

    // Regla 1: Si hay ventana NO minimizada en workspace actual → activarla
    const localActiveWindows = existingWindows.filter((w, index) =>
        w.workspace === currentWorkspace && !w.minimized
    ).map((w, _, arr) => existingWindows.indexOf(w));

    if (localActiveWindows.length > 0) {
        return {
            action: 'ACTIVATE_EXISTING',
            targetWindow: localActiveWindows[0],
            workspace: currentWorkspace,
            switchWorkspace: false
        };
    }

    // Regla 2: Si hay ventana minimizada en workspace actual → restaurarla
    const localMinimizedWindows = existingWindows.filter((w, index) =>
        w.workspace === currentWorkspace && w.minimized
    ).map((w, _, arr) => existingWindows.indexOf(w));

    if (localMinimizedWindows.length > 0) {
        return {
            action: 'RESTORE_WINDOW',
            targetWindow: localMinimizedWindows[0],
            workspace: currentWorkspace,
            switchWorkspace: false
        };
    }

    // Regla 3: Si NO hay ventanas locales → crear nueva
    return {
        action: 'CREATE_NEW_WINDOW',
        workspace: currentWorkspace,
        switchWorkspace: false
    };
}
EOF
```

**Ejecutar tests (DEBEN PASAR AHORA)**:
```bash
npm test
```

**Resultado esperado**:
```
✔ Core de Reglas - decideAction() > REQ-001 > debe crear nueva ventana si app no tiene ventanas existentes
✔ Core de Reglas - decideAction() > REQ-001 > debe crear nueva ventana si app solo tiene ventanas en otros workspaces
✔ Core de Reglas - decideAction() > REQ-002 > nunca debe retornar switchWorkspace: true
✔ Core de Reglas - decideAction() > REQ-003 > debe activar ventana NO minimizada en workspace actual
✔ Core de Reglas - decideAction() > REQ-003 > debe restaurar ventana minimizada en workspace actual
✔ Core de Reglas - decideAction() > REQ-003 > debe preferir ventana NO minimizada sobre minimizada
✔ Core de Reglas - decideAction() > Validaciones > debe manejar context sin currentWorkspace
✔ Core de Reglas - decideAction() > Validaciones > debe manejar context sin existingWindows
✔ Core de Reglas - decideAction() > Validaciones > debe lanzar error si context es null

tests 9
pass 9
```

**Entregable**: ✅ `core/rules.js` implementado y tests pasando (Green phase de TDD)

---

### 3.6. Refactorizar core/rules.js (Refactor Phase)

**Optimizaciones**:
- Extraer funciones helper para filtrar ventanas
- Documentación JSDoc completa
- Manejo de casos edge adicionales

**Archivo**: `core/rules.js` (actualizado)

```bash
cat > core/rules.js << 'EOF'
/**
 * Core de Reglas - Lógica de decisión para workspace management
 * JavaScript puro (sin dependencias de GJS/GNOME)
 *
 * @module core/rules
 */

/**
 * @typedef {Object} WindowInfo
 * @property {number} workspace - Workspace donde está la ventana (0-based)
 * @property {boolean} minimized - ¿Está minimizada?
 */

/**
 * @typedef {Object} WindowContext
 * @property {number} currentWorkspace - Workspace actual del usuario (0-based)
 * @property {string} app - ID de la aplicación (e.g., 'chrome')
 * @property {WindowInfo[]} existingWindows - Ventanas existentes de la app
 */

/**
 * @typedef {Object} Decision
 * @property {'CREATE_NEW_WINDOW'|'ACTIVATE_EXISTING'|'RESTORE_WINDOW'} action
 * @property {number} [targetWindow] - Índice en existingWindows (si aplica)
 * @property {number} workspace - Workspace destino
 * @property {boolean} switchWorkspace - ¿Cambiar de workspace? (siempre false)
 */

/**
 * Filtra ventanas por workspace y estado de minimización
 *
 * @param {WindowInfo[]} windows - Array de ventanas
 * @param {number} workspace - Workspace a filtrar
 * @param {boolean} minimized - Estado de minimización
 * @returns {number[]} Índices de ventanas que cumplen criterio
 */
function filterWindowsByWorkspace(windows, workspace, minimized) {
    return windows
        .map((w, index) => ({ window: w, index }))
        .filter(({ window }) =>
            window.workspace === workspace && window.minimized === minimized
        )
        .map(({ index }) => index);
}

/**
 * Decide qué acción tomar al activar una aplicación
 *
 * Implementa las reglas:
 * - REQ-001: Crear nueva ventana en workspace actual si no hay local
 * - REQ-002: Nunca cambiar de workspace automáticamente
 * - REQ-003: Activar ventana existente en workspace actual si existe
 *
 * @param {WindowContext} context - Contexto de la aplicación
 * @returns {Decision} Decisión con action, workspace, y switchWorkspace
 * @throws {TypeError} Si context no es objeto válido
 */
export function decideAction(context) {
    // Validación defensiva
    if (!context || typeof context !== 'object') {
        throw new TypeError('context is required and must be an object');
    }

    const currentWorkspace = context.currentWorkspace ?? 0;
    const existingWindows = context.existingWindows ?? [];

    // Regla 1: Si hay ventana NO minimizada en workspace actual → activarla
    const localActiveWindows = filterWindowsByWorkspace(
        existingWindows,
        currentWorkspace,
        false // no minimized
    );

    if (localActiveWindows.length > 0) {
        return {
            action: 'ACTIVATE_EXISTING',
            targetWindow: localActiveWindows[0],
            workspace: currentWorkspace,
            switchWorkspace: false
        };
    }

    // Regla 2: Si hay ventana minimizada en workspace actual → restaurarla
    const localMinimizedWindows = filterWindowsByWorkspace(
        existingWindows,
        currentWorkspace,
        true // minimized
    );

    if (localMinimizedWindows.length > 0) {
        return {
            action: 'RESTORE_WINDOW',
            targetWindow: localMinimizedWindows[0],
            workspace: currentWorkspace,
            switchWorkspace: false
        };
    }

    // Regla 3: Si NO hay ventanas locales → crear nueva
    // REQ-001: Siempre en workspace actual
    return {
        action: 'CREATE_NEW_WINDOW',
        workspace: currentWorkspace,
        switchWorkspace: false // REQ-002: Nunca auto-switch
    };
}
EOF
```

**Ejecutar tests nuevamente**:
```bash
npm test
```

**Resultado esperado**: Todos los tests siguen pasando (refactor no rompe funcionalidad).

**Entregable**: ✅ `core/rules.js` refactorizado y documentado

---

## FASE 4: Implementación Robusta de la Extensión

### Objetivo

Implementar la extensión GNOME Shell que integra el core de reglas con señales de GNOME.

---

### 4.1. Crear metadata.json

**Archivo**: `extension/metadata.json`

```bash
cat > extension/metadata.json << 'EOF'
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
EOF
```

**Entregable**: ✅ `metadata.json` creado

---

### 4.2. Implementar extension.js (Integración GNOME)

**Archivo**: `extension/extension.js`

```bash
cat > extension/extension.js << 'EOF'
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

// Importar core de reglas (JavaScript puro)
import {decideAction} from './core/rules.js';

/**
 * Extensión Multitarea Soberana
 * Implementa control total de workspaces siguiendo ADR-001 y ADR-002
 */
export default class MultitareaSoberanaExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._injectionManager = new InjectionManager();
        this._windowCreatedId = null;
        this._windowTrackedHandlers = new Map();
    }

    /**
     * Habilitar extensión
     * Conecta señales de GNOME Shell y aplica overrides
     */
    enable() {
        log('[Multitarea-Soberana] Habilitando extensión...');

        // 1. Interceptar creación de ventanas (REQ-001)
        this._windowCreatedId = global.display.connect('window-created',
            (display, window) => this._onWindowCreated(window));

        // 2. Override comportamiento del dock (REQ-002, REQ-003)
        this._overrideDockBehavior();

        log('[Multitarea-Soberana] Extensión habilitada correctamente');
    }

    /**
     * Deshabilitar extensión
     * Limpia señales y restaura comportamiento original
     */
    disable() {
        log('[Multitarea-Soberana] Deshabilitando extensión...');

        // Limpiar handlers de ventanas
        for (const [window, mappedId] of this._windowTrackedHandlers) {
            try {
                window.disconnect(mappedId);
            } catch (e) {
                // Ventana puede haber sido destruida
            }
        }
        this._windowTrackedHandlers.clear();

        // Desconectar window-created
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        // Restaurar dock behavior
        this._injectionManager.clear();

        log('[Multitarea-Soberana] Extensión deshabilitada');
    }

    /**
     * Handler de window-created
     * Fuerza ventana al workspace actual (REQ-001)
     *
     * @param {Meta.Window} window - Ventana recién creada
     */
    _onWindowCreated(window) {
        // Esperar a que ventana esté mapeada (visible)
        const mappedId = window.connect('notify::mapped', () => {
            if (!window.get_mapped()) return;

            // Desconectar (ejecutar solo una vez)
            window.disconnect(mappedId);
            this._windowTrackedHandlers.delete(window);

            // Aplicar lógica de force-to-current-workspace
            this._forceToCurrentWorkspace(window);
        });

        this._windowTrackedHandlers.set(window, mappedId);
    }

    /**
     * Fuerza ventana al workspace actual
     * Skip dialogs, popups, y sticky windows
     *
     * @param {Meta.Window} window - Ventana a mover
     */
    _forceToCurrentWorkspace(window) {
        try {
            // Skip casos especiales
            if (window.skip_taskbar || window.is_on_all_workspaces()) {
                return;
            }

            const currentWsIndex = global.workspace_manager.get_active_workspace_index();
            const windowWsIndex = window.get_workspace().index();

            if (windowWsIndex !== currentWsIndex) {
                log(`[Multitarea-Soberana] Moviendo "${window.title || 'untitled'}" de WS ${windowWsIndex} a WS ${currentWsIndex}`);

                // Delay pequeño para apps extremadamente rebeldes (Chrome, VSCode)
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    try {
                        window.change_workspace_by_index(currentWsIndex, false);
                    } catch (e) {
                        log(`[Multitarea-Soberana] Error al mover ventana: ${e.message}`);
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }
        } catch (e) {
            log(`[Multitarea-Soberana] Error en _forceToCurrentWorkspace: ${e.message}`);
        }
    }

    /**
     * Override comportamiento del dock
     * Usa core/rules.js para decidir acción (REQ-002, REQ-003)
     */
    async _overrideDockBehavior() {
        try {
            const AppDisplay = await import('resource:///org/gnome/shell/ui/appDisplay.js');
            const {AppIcon} = AppDisplay;

            this._injectionManager.overrideMethod(
                AppIcon.prototype,
                'activate',
                originalMethod => {
                    return function(button) {
                        try {
                            const context = this._extension._buildWindowContext(this.app);
                            const decision = decideAction(context);

                            this._extension._executeDecision(this.app, decision, originalMethod, this, button);
                        } catch (e) {
                            log(`[Multitarea-Soberana] Error en activate override: ${e.message}`);
                            // Fallback: comportamiento original
                            originalMethod.call(this, button);
                        }
                    }.bind({app: this.app, _extension: this});
                }
            );

            log('[Multitarea-Soberana] Dock behavior overridden');
        } catch (e) {
            log(`[Multitarea-Soberana] Error al override dock behavior: ${e.message}`);
        }
    }

    /**
     * Construye contexto para core/rules.js desde Shell.App
     *
     * @param {Shell.App} app - Aplicación
     * @returns {WindowContext} Contexto para decideAction()
     */
    _buildWindowContext(app) {
        const currentWorkspace = global.workspace_manager.get_active_workspace_index();
        const windows = app.get_windows();

        const existingWindows = windows.map(w => ({
            workspace: w.get_workspace().index(),
            minimized: w.minimized
        }));

        return {
            currentWorkspace,
            app: app.get_id(),
            existingWindows
        };
    }

    /**
     * Ejecuta decisión del core de reglas
     *
     * @param {Shell.App} app - Aplicación
     * @param {Decision} decision - Decisión de decideAction()
     * @param {Function} originalMethod - Método original de activate
     * @param {Object} context - Contexto de this
     * @param {number} button - Botón de mouse
     */
    _executeDecision(app, decision, originalMethod, context, button) {
        const windows = app.get_windows();

        switch (decision.action) {
            case 'CREATE_NEW_WINDOW':
                if (app.can_open_new_window()) {
                    app.open_new_window(-1);
                } else {
                    // Fallback: comportamiento original
                    originalMethod.call(context, button);
                }
                break;

            case 'ACTIVATE_EXISTING':
                if (decision.targetWindow < windows.length) {
                    const window = windows[decision.targetWindow];
                    window.activate(global.get_current_time());
                }
                break;

            case 'RESTORE_WINDOW':
                if (decision.targetWindow < windows.length) {
                    const window = windows[decision.targetWindow];
                    window.unminimize();
                    window.activate(global.get_current_time());
                }
                break;

            default:
                log(`[Multitarea-Soberana] Acción desconocida: ${decision.action}`);
                originalMethod.call(context, button);
        }
    }
}
EOF
```

**Entregable**: ✅ `extension/extension.js` implementado con integración completa

---

### 4.3. Copiar core/rules.js a extension/core/

**Comando**:
```bash
mkdir -p extension/core
cp core/rules.js extension/core/
```

**Verificar**:
```bash
ls -la extension/core/rules.js
```

**Entregable**: ✅ Core de reglas disponible para la extensión

---

### 4.4. Implementar script dev-logs.sh

**Archivo**: `scripts/dev-logs.sh`

```bash
cat > scripts/dev-logs.sh << 'EOF'
#!/bin/bash

echo "=== Logs de Multitarea Soberana ==="
echo "Presiona Ctrl+C para salir"
echo ""

journalctl -f -o cat /usr/bin/gnome-shell | grep -i --line-buffered "multitarea-soberana"
EOF

chmod +x scripts/dev-logs.sh
```

**Uso**:
```bash
./scripts/dev-logs.sh
```

**Entregable**: ✅ Script de logging implementado

---

### 4.5. Evaluación de Segundo Dock

**Decisión documentada en**:
- `docs/requisitos/requisitos-detallados.md` - REQ-005
- Conclusión: 🔴 NO IMPLEMENTAR en v1.0 (no aporta valor funcional real)

**Entregable**: ✅ Evaluación completada (no implementar)

---

## FASE 5: Verificación, Empaquetado y Documentación

### Objetivo

Validar que la solución cumple requisitos, crear scripts de instalación y documentación completa.

---

### 5.1. Ejecutar Tests Automatizados

**Comando**:
```bash
npm test
```

**Criterio de aceptación**: Todos los tests pasan (9/9)

**Entregable**: ✅ Tests automatizados pasando

---

### 5.2. Crear Checklist de Verificación Manual

**Archivo**: `docs/testing/manual-checklist.md`

```markdown
# Checklist de Verificación Manual

**Fecha**: _____
**Tester**: _____
**Versión GNOME**: _____

## Instalación

- [ ] `./scripts/install.sh` ejecuta sin errores
- [ ] Extensión aparece en `gnome-extensions list`
- [ ] Después de reiniciar GNOME, extensión está habilitada

## REQ-001: Lanzamiento en Workspace Actual

- [ ] Chrome en WS 1, abrir Chrome desde dock en WS 8 → nueva ventana en WS 8
- [ ] Firefox sin ventanas, abrir desde buscador (Super) en WS 5 → abre en WS 5
- [ ] Terminal en WS 2, abrir Terminal con atajo Ctrl+Alt+T en WS 7 → abre en WS 7
- [ ] VSCode en múltiples workspaces → nueva ventana siempre en WS actual

## REQ-002: Sin Cambio Automático de Workspace

- [ ] Chrome en WS 1 y 3, hacer clic en dock en WS 8 → NO salta a WS 1 ni 3
- [ ] Firefox con ventanas en WS 2, activar desde Super en WS 5 → NO salta a WS 2
- [ ] Configuración abierta en WS 1, clic en dock en WS 4 → NO salta a WS 1

## REQ-003: Control del Dock

- [ ] Terminal minimizada en WS actual, clic en dock → restaura ventana
- [ ] Nautilus activa en WS actual, clic en dock → activa ventana existente
- [ ] LibreOffice en WS 1, clic en dock en WS 8 → nueva ventana en WS 8

## REQ-004: Todas las Aplicaciones

- [ ] Chrome: funciona como esperado
- [ ] Firefox: funciona como esperado
- [ ] VSCode (Electron): funciona como esperado
- [ ] GNOME Terminal: funciona como esperado
- [ ] Configuración: funciona como esperado
- [ ] Nautilus: funciona como esperado

## Robustez

- [ ] No crashes al habilitar extensión
- [ ] No crashes al deshabilitar extensión
- [ ] No crashes al cambiar entre workspaces rápidamente
- [ ] Logs claros y útiles en `./scripts/dev-logs.sh`

## Desinstalación

- [ ] `./scripts/uninstall.sh` ejecuta sin errores
- [ ] Extensión eliminada de `gnome-extensions list`
- [ ] Comportamiento de GNOME restaurado a original
```

**Ejecutar checklist**: José debe completar manualmente después de instalar.

**Entregable**: ✅ Checklist de verificación manual creado

---

### 5.3. Implementar Scripts de Instalación

**Scripts a crear**:
1. `scripts/install.sh` (según ADR-003)
2. `scripts/update.sh` (según ADR-003)
3. `scripts/uninstall.sh` (según ADR-003)

**Contenido**: Ver ADR-003 sección "Flujos de Operación"

**Entregable**: ✅ Scripts de instalación, actualización y desinstalación

---

### 5.4. Escribir README.md

**Archivo**: `README.md`

```markdown
# Multitarea Soberana

Control total de workspaces en GNOME Shell (Ubuntu 24 Desktop con Wayland).

## ¿Qué hace?

- ✅ **Todas las apps se abren en el workspace actual** (no en workspace 1 arbitrariamente)
- ✅ **Sin cambio automático de workspace** al activar apps existentes
- ✅ **Control del dock**: clic simple = nueva ventana en workspace actual

## Requisitos

- Ubuntu 24 Desktop (o derivado)
- GNOME Shell 46 o 47
- Wayland (Funciona también en X11)

## Instalación

\`\`\`bash
# 1. Clonar repositorio
git clone https://github.com/josem4pro/multitarea-soberana.git
cd multitarea-soberana

# 2. Instalar extensión
./scripts/install.sh

# 3. Reiniciar GNOME Shell
# Wayland: Cerrar sesión y volver a iniciar
# X11: Alt+F2 → r → Enter

# 4. Verificar instalación
gnome-extensions list --enabled | grep multitarea-soberana
\`\`\`

## Actualización

\`\`\`bash
cd ~/multitarea-soberana
git pull
./scripts/update.sh

# Reiniciar GNOME Shell (ver arriba)
\`\`\`

## Desinstalación

\`\`\`bash
cd ~/multitarea-soberana
./scripts/uninstall.sh
\`\`\`

## Limitaciones Conocidas

- Firefox al restaurar sesión puede ignorar workspace (bug de Wayland)
- Apps Electron antiguas (<20) pueden tener comportamiento inconsistente
- Monkey-patching puede romperse en futuras versiones de GNOME (tenemos plan B)

## Documentación Técnica

- [Requisitos Detallados](docs/requisitos/requisitos-detallados.md)
- [ADR-001: Elección de GNOME Shell Extension](ADR/ADR-001-eleccion-gnome-shell-extension.md)
- [ADR-002: Separación Core vs Integración](ADR/ADR-002-separacion-core-reglas-integracion-gnome.md)
- [ADR-003: Estrategia de Instalación](ADR/ADR-003-estrategia-instalacion-actualizacion.md)

## Desarrollo

\`\`\`bash
# Ejecutar tests
npm test

# Ver logs en tiempo real
./scripts/dev-logs.sh
\`\`\`

## Licencia

MIT

## Autor

José - https://github.com/josem4pro
\`\`\`

**Entregable**: ✅ README.md completo

---

### 5.5. Verificación Final de Requisitos

**Matriz de cumplimiento**:

| Requisito | Estado | Evidencia |
|-----------|--------|-----------|
| REQ-001: Lanzamiento en WS actual | ✅ 95% | Tests + checklist manual |
| REQ-002: Sin auto-switch | ⚠️ 85% | Override de activate() |
| REQ-003: Control del dock | ⚠️ 75% | Monkey-patch con InjectionManager |
| REQ-004: Todas las apps | ✅ 90% | Lógica agnóstica en core/rules.js |
| REQ-005: Segundo dock | 🔴 NO | Decisión: no implementar v1.0 |
| REQ-NF-001: Robustez | ✅ | Try-catch + validaciones defensivas |
| REQ-NF-002: Instalable/Revertible | ✅ | Scripts + docs |
| REQ-NF-003: Documentación | ✅ | README + ADRs + docs/ |
| REQ-NF-004: Testeable | ✅ | Tests automatizados + checklist |

**Entregable**: ✅ Verificación final documentada

---

## Entrega Final

**Estructura final del repositorio**:

```
~/multitarea-soberana/
├── README.md                          ← Guía de usuario
├── package.json                       ← Config de tests
├── ADR/                               ← Decision records
│   ├── ADR-001-eleccion-gnome-shell-extension.md
│   ├── ADR-002-separacion-core-reglas-integracion-gnome.md
│   └── ADR-003-estrategia-instalacion-actualizacion.md
├── core/
│   └── rules.js                       ← Lógica de reglas (JS puro)
├── extension/
│   ├── extension.js                   ← Integración GNOME (GJS)
│   ├── metadata.json                  ← Metadata
│   └── core/
│       └── rules.js                   ← Copia para extensión
├── tests/
│   ├── rules.test.js                  ← Tests automatizados
│   └── fixtures/
│       └── window-contexts.json       ← Datos de test
├── scripts/
│   ├── install.sh                     ← Instalación
│   ├── update.sh                      ← Actualización
│   ├── uninstall.sh                   ← Desinstalación
│   ├── dev-logs.sh                    ← Logs en tiempo real
│   └── test.sh                        ← Wrapper de npm test
└── docs/
    ├── investigacion/                 ← Investigación técnica (FASE 1)
    │   ├── 01-apis-gnome-shell.md
    │   ├── 02-limitaciones-wayland.md
    │   └── 03-extensiones-relevantes.md
    ├── requisitos/
    │   └── requisitos-detallados.md   ← REQ-001 a REQ-NF-004
    └── testing/
        └── manual-checklist.md        ← Checklist de verificación
```

---

## Cómo José Puede Usar Esto

### 1. Clonar/Copiar el Repo

```bash
# Ya está en ~/multitarea-soberana
cd ~/multitarea-soberana
```

### 2. Ejecutar Tests

```bash
npm test
```

**Esperado**: 9/9 tests pasando

### 3. Instalar Extensión

```bash
./scripts/install.sh
```

### 4. Activar y Probar

```bash
# Cerrar sesión y volver a iniciar (Wayland)
# Verificar
gnome-extensions list --enabled | grep multitarea-soberana
```

### 5. Probar Comportamiento

- Abrir Chrome en diferentes workspaces
- Verificar que siempre abre en workspace actual
- Hacer clic en dock y verificar que no cambia de workspace

### 6. Ver Logs

```bash
./scripts/dev-logs.sh
```

### 7. Reportar Issues/Mejoras

- Usar checklist manual para detectar problemas
- Documentar edge cases encontrados
- Proponer mejoras para v2.0

---

**FIN DEL PLAN DE IMPLEMENTACIÓN**

**Estado**: Borrador (Pendiente revisión por plan-reviewer)
**Próximo paso**: Someter a revisión con agente plan-reviewer
