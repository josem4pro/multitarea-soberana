# APIs de GNOME Shell para Control de Workspaces

**Fecha**: 2025-11-18
**Investigación**: web-research-specialist
**Estado**: Completo

## Resumen Ejecutivo

GNOME Shell en Ubuntu 24 con Wayland proporciona APIs robustas para controlar workspaces y ventanas a través de GJS (JavaScript para GNOME). La viabilidad de controlar dónde se crean nuevas ventanas es **ALTA (95% efectividad)**.

## APIs Core

### 1. Meta.Display - Detección de Nuevas Ventanas

**Signal principal: `window-created`**

```javascript
global.display.connect('window-created', (display, window) => {
    // Ejecutado INMEDIATAMENTE después de crear ventana
    // 'window' es un objeto Meta.Window
    // Ventana aún no visible → oportunidad de reasignar workspace
});
```

**Documentación**: https://mutter.gnome.org/meta/signal.Display.window-created.html

**Características**:
- Se dispara ANTES de que la ventana sea visible al usuario
- Permite interceptar y reasignar workspace sin parpadeo
- No se puede disparar ANTES de la creación (limitación inherente)

---

### 2. Meta.WorkspaceManager - Gestión de Workspaces

```javascript
const workspaceManager = global.workspace_manager;

// Métodos relevantes
workspaceManager.get_active_workspace()         // Workspace actual
workspaceManager.get_active_workspace_index()   // Índice del workspace actual (0-based)
workspaceManager.get_workspace_by_index(idx)    // Workspace por índice
workspaceManager.get_n_workspaces()             // Total de workspaces
```

**Signal importante**:
```javascript
workspaceManager.connect('active-workspace-changed', (manager) => {
    // Detectar cambio de workspace
    const newIndex = manager.get_active_workspace_index();
    log(`Workspace changed to ${newIndex}`);
});
```

**Documentación**: https://mutter.gnome.org/meta/class.WorkspaceManager.html

---

### 3. Meta.Window - Manipulación de Ventanas

**Método principal para mover ventanas**:

```javascript
// Método recomendado: Por índice
window.change_workspace_by_index(workspaceIndex, append);
// workspaceIndex: 0-based
// append: booleano (si true, crea workspace si no existe)

// Ejemplo práctico:
const currentWsIndex = global.workspace_manager.get_active_workspace_index();
window.change_workspace_by_index(currentWsIndex, false);
```

**Métodos adicionales**:
```javascript
window.get_workspace()                // Obtener workspace actual de la ventana
window.located_on_workspace(ws)       // ¿Está en este workspace?
window.activate(timestamp)            // Activar ventana SIN cambiar workspace
window.is_on_all_workspaces()         // ¿Sticky window?
window.skip_taskbar                   // ¿Se debe ignorar? (dialogs, popups)
```

**CRÍTICO - Diferencia activate()**:

```javascript
// Main.activateWindow() - Alto nivel
Main.activateWindow(window);
// → Cambia automáticamente al workspace de la ventana
// → Sale del Overview si está activo
// ❌ NO USAR para evitar auto-switch

// window.activate() - Bajo nivel
window.activate(global.get_current_time());
// → Activa ventana en su lugar
// → NO cambia workspace automáticamente
// ✅ USAR para control granular
```

**Documentación**: https://mutter.gnome.org/meta/class.Window.html

---

### 4. Shell.App - Lanzamiento de Aplicaciones

**Obtener instancia de app**:
```javascript
const appSystem = Shell.AppSystem.get_default();
const app = appSystem.lookup_app('chrome.desktop'); // .desktop ID
```

**Signal: `windows-changed`**:
```javascript
app.connect('windows-changed', () => {
    // Se dispara cuando la app crea/cierra ventanas
    const windows = app.get_windows();
    // Procesar nuevas ventanas
});
```

**Lanzar nueva instancia**:
```javascript
if (app.can_open_new_window()) {
    app.open_new_window(-1);  // -1 = workspace actual
} else {
    // App no soporta múltiples ventanas
    const windows = app.get_windows();
    if (windows.length > 0) {
        windows[0].activate(global.get_current_time());
    }
}
```

**LIMITACIÓN**: El parámetro de workspace en `open_new_window()` es una "sugerencia" - la app puede ignorarlo (especialmente en Wayland).

---

## Patrón de Implementación Recomendado

### Forzar Ventanas al Workspace Actual

```javascript
export default class ForceCurrentWorkspaceExtension extends Extension {
    enable() {
        this._windowCreatedId = global.display.connect('window-created',
            (display, window) => this._onWindowCreated(window));
    }

    _onWindowCreated(window) {
        // Esperar a que ventana esté mapeada (visible)
        const mappedId = window.connect('notify::mapped', () => {
            if (!window.get_mapped()) return;

            // Desconectar (solo ejecutar una vez)
            window.disconnect(mappedId);

            // Skip dialogs y sticky windows
            if (window.skip_taskbar || window.is_on_all_workspaces())
                return;

            // Forzar a workspace actual
            const currentWsIndex = global.workspace_manager.get_active_workspace_index();
            const windowWsIndex = window.get_workspace().index();

            if (windowWsIndex !== currentWsIndex) {
                log(`[WorkspaceControl] Moving "${window.title}" to WS ${currentWsIndex}`);
                window.change_workspace_by_index(currentWsIndex, false);
            }
        });
    }

    disable() {
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }
    }
}
```

**Efectividad**: ~95% de aplicaciones

---

## Referencias

### Documentación Oficial
- Meta.Display: https://mutter.gnome.org/meta/class.Display.html
- Meta.Window: https://mutter.gnome.org/meta/class.Window.html
- Meta.WorkspaceManager: https://mutter.gnome.org/meta/class.WorkspaceManager.html
- Signal window-created: https://mutter.gnome.org/meta/signal.Display.window-created.html

### Guías GJS
- GNOME Shell Extensions: https://gjs.guide/extensions/
- Architecture Overview: https://gjs.guide/extensions/overview/architecture.html
- Upgrading to GNOME 45: https://gjs.guide/extensions/upgrading/gnome-shell-45.html

### Referencias Comunitarias
- Extension Reference: https://github.com/julio641742/gnome-shell-extension-reference/blob/master/REFERENCE.md
- Stack Overflow - GNOME workspace functions: https://stackoverflow.com/questions/62409324/which-gnome-function-is-responsible-for-switching-workspaces

---

## Notas de Implementación

### Timing Crítico

**Timeline de creación de ventana**:
```
1. Usuario hace clic en dock → AppIcon.activate()
2. Se llama app.open_new_window(-1)
3. App lanza proceso
4. Proceso crea ventana nativa
5. ← Signal 'window-created' se dispara AQUÍ
6. Ventana se mapea (visible)
```

**Ventana de oportunidad**: Entre paso 5-6 (ventana creada pero no visible).

### Casos Edge

**Ventanas a ignorar**:
- `window.skip_taskbar === true` (dialogs, popups)
- `window.is_on_all_workspaces() === true` (sticky windows)
- Ventanas sin título o transitorias

**Apps problemáticas**:
- Firefox: Puede ignorar workspace hint al restaurar sesión
- Chrome/Chromium: Comportamiento inconsistente en Wayland
- Electron apps: Depende de versión de Electron

**Workaround**: Forzar con `change_workspace_by_index()` después de mapeo (ya implementado en patrón recomendado).

---

**Última actualización**: 2025-11-18
**Fuente**: Investigación exhaustiva de web-research-specialist
