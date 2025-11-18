import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

/**
 * InjectionManager - Implementado localmente
 * CORRECCIÓN aplicada: GNOME Shell 45+ no exporta InjectionManager
 */
class InjectionManager {
    constructor() {
        this._overrides = [];
    }

    overrideMethod(prototype, methodName, override) {
        const original = prototype[methodName];
        prototype[methodName] = override(original);
        this._overrides.push({ prototype, methodName, original });
    }

    clear() {
        for (const { prototype, methodName, original } of this._overrides) {
            prototype[methodName] = original;
        }
        this._overrides = [];
    }
}

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
        this._decideAction = null; // Referencia a función del core
    }

    /**
     * Habilitar extensión
     * Conecta señales de GNOME Shell y aplica overrides
     */
    enable() {
        log('[Multitarea-Soberana] Habilitando extensión...');

        // Cargar core/rules.js
        this._loadCoreRules();

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

        // Limpiar referencia a core
        this._decideAction = null;

        log('[Multitarea-Soberana] Extensión deshabilitada');
    }

    /**
     * Carga módulo core/rules.js
     * CORRECCIÓN aplicada: Import compatible con GJS (no ES6 import directo)
     */
    _loadCoreRules() {
        try {
            // NOTA: En GJS moderno (GNOME 46+), podemos usar dynamic import
            // pero por compatibilidad, cargamos el archivo directamente
            const extensionPath = this.path;
            const rulesPath = `${extensionPath}/core/rules.js`;

            // Importar usando import() dinámico
            import(`file://${rulesPath}`).then(module => {
                this._decideAction = module.decideAction;
                log('[Multitarea-Soberana] Core de reglas cargado correctamente');
            }).catch(e => {
                log(`[Multitarea-Soberana] ERROR al cargar core/rules.js: ${e.message}`);
                log('[Multitarea-Soberana] Extensión funcionará solo con force-to-workspace (sin dock override)');
            });
        } catch (e) {
            log(`[Multitarea-Soberana] ERROR al cargar core/rules.js: ${e.message}`);
        }
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
     * CORRECCIÓN aplicada: Binding correcto de contexto
     */
    async _overrideDockBehavior() {
        try {
            const AppDisplay = await import('resource:///org/gnome/shell/ui/appDisplay.js');
            const {AppIcon} = AppDisplay;

            // Capturar referencia a la extensión para usar en closure
            const extensionInstance = this;

            this._injectionManager.overrideMethod(
                AppIcon.prototype,
                'activate',
                originalMethod => {
                    return function(button) {
                        try {
                            // 'this' aquí es AppIcon, no la extensión
                            // Verificar que core esté cargado
                            if (!extensionInstance._decideAction) {
                                // Fallback: comportamiento original si core no está cargado
                                log('[Multitarea-Soberana] Core no cargado, usando comportamiento original');
                                originalMethod.call(this, button);
                                return;
                            }

                            const context = extensionInstance._buildWindowContext(this.app);
                            const decision = extensionInstance._decideAction(context);

                            extensionInstance._executeDecision(this.app, decision, originalMethod, this, button);
                        } catch (e) {
                            log(`[Multitarea-Soberana] Error en activate override: ${e.message}`);
                            // Fallback: comportamiento original
                            originalMethod.call(this, button);
                        }
                    };
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
            app: app.get_id().replace('.desktop', ''), // Normalizar ID
            existingWindows
        };
    }

    /**
     * Ejecuta decisión del core de reglas
     *
     * @param {Shell.App} app - Aplicación
     * @param {Decision} decision - Decisión de decideAction()
     * @param {Function} originalMethod - Método original de activate
     * @param {Object} context - Contexto de this (AppIcon)
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
                    // Usar window.activate() (no Main.activateWindow) para evitar auto-switch
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
