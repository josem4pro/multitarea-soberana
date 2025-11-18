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
 * CORRECCIÓN aplicada por plan-reviewer: Preservar índice original
 *
 * @param {WindowInfo[]} windows - Array de ventanas
 * @param {number} workspace - Workspace a filtrar
 * @param {boolean} minimized - Estado de minimización
 * @returns {number[]} Índices de ventanas que cumplen criterio
 */
function filterWindowsByWorkspace(windows, workspace, minimized) {
    return windows
        .map((w, index) => ({ window: w, originalIndex: index }))
        .filter(({ window }) =>
            window.workspace === workspace && window.minimized === minimized
        )
        .map(({ originalIndex }) => originalIndex);
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
