# Requisitos Detallados - multitarea-soberana

**Fecha**: 2025-11-18
**Versión**: 1.0
**Estado**: Definido y validado técnicamente

---

## Objetivos del Proyecto

Crear una solución **robusta, instalable y revertible** para Ubuntu 24 Desktop con GNOME Shell (dock lateral) y Wayland que proporcione control total sobre el comportamiento de workspaces y lanzamiento de aplicaciones.

**Nombre del proyecto**: multitarea-soberana
**Directorio raíz**: `~/multitarea-soberana`

---

## Requisitos Funcionales

### REQ-001: Lanzamiento en Workspace Actual [CRÍTICO]

**Descripción**:
Si estoy en el workspace (área de trabajo) X, **todas** las aplicaciones que lance desde el dock, buscador (Super), accesos directos o menús deben abrirse en **ese** workspace X.

**Casos de uso**:
1. Usuario está en workspace 8
2. Usuario lanza Chrome desde dock
3. Chrome se abre en workspace 8 (no en workspace 1, 2, etc.)

**Aplicaciones objetivo**:
- Chrome/Chromium
- Firefox
- Terminal (GNOME Terminal)
- VSCode
- Configuración del sistema
- Nautilus
- Cualquier otra aplicación GUI

**Viabilidad**: ✅ **ALTA (95% efectividad)**

**Implementación**:
- Usar signal `global.display.connect('window-created', ...)` para detectar nuevas ventanas
- Forzar ventana al workspace actual con `window.change_workspace_by_index(currentWsIndex, false)`
- Ejecutar después de mapeo (`notify::mapped`) para garantizar aplicación

**Limitaciones conocidas**:
- Firefox al restaurar sesión puede ignorar el workspace (bug conocido de Wayland)
- Chrome/Chromium tiene comportamiento inconsistente en ~5% de casos
- Workaround: Delay de 100ms para apps extremadamente rebeldes

**Referencia técnica**: `docs/investigacion/01-apis-gnome-shell.md`

**Estado**: ✅ Implementable

---

### REQ-002: Sin Cambio Automático de Workspace [CRÍTICO]

**Descripción**:
El sistema **no debe cambiar automáticamente de workspace** cuando active una aplicación que ya tenga una ventana en otro workspace.

**Casos de uso**:
1. Chrome tiene ventanas en workspace 1 y 3
2. Usuario está en workspace 8
3. Usuario hace clic en Chrome desde el dock
4. Sistema **NO debe** saltar a workspace 1 ni 3
5. Si deseo ir a ese workspace, **lo haré manualmente** (Super+scroll, gestos, etc.)

**Viabilidad**: ⚠️ **MEDIA-ALTA (85% efectividad)**

**Implementación principal**:
- Opción A: Configurar dash-to-dock via gsettings
  ```bash
  gsettings set org.gnome.shell.extensions.dash-to-dock isolate-workspaces true
  gsettings set org.gnome.shell.extensions.dash-to-dock click-action 'focus-or-previews'
  ```
- Opción B: Monkey-patch de `AppIcon.activate()` usando `InjectionManager`
- Usar `window.activate(timestamp)` en lugar de `Main.activateWindow(window)`

**Limitaciones conocidas**:
- Monkey-patching puede romperse en futuras versiones de GNOME (especialmente 46+)
- Algunas extensiones pueden interferir con el override
- gsettings solo no proporciona control fino suficiente

**Estrategia recomendada**:
1. Intentar primero con gsettings (estable)
2. Si no es suficiente, aplicar monkey-patch (documentar riesgos)
3. Tener plan B: fork de dash-to-dock (última opción)

**Referencia técnica**: `docs/investigacion/02-limitaciones-wayland.md`

**Estado**: ⚠️ Implementable con limitaciones

---

### REQ-003: Control del Dock - Nueva Ventana en Workspace Actual [CRÍTICO]

**Descripción**:
Desde el dock:
- **Clic simple sobre una app = nueva ventana en el workspace actual**
- Aunque haya otras ventanas de esa app en otros workspaces
- **No "saltar"** a otra ventana ni workspace sin acción explícita

**Casos de uso**:
1. Firefox tiene ventanas en workspace 1, 3, 5
2. Usuario está en workspace 8
3. Usuario hace clic en Firefox en el dock
4. Se crea **nueva ventana de Firefox en workspace 8**
5. Sistema **NO salta** a workspace 1, 3 ni 5

**Viabilidad**: ⚠️ **MEDIA (70-80% efectividad)**

**Implementación**:
- Override de `AppIcon.activate()` para modificar comportamiento de clic
- Filtrar ventanas por workspace actual: `windows.filter(w => w.located_on_workspace(currentWs))`
- Si hay ventana local → activar sin cambiar workspace
- Si NO hay ventana local → lanzar nueva instancia con `app.open_new_window(-1)`

**Código propuesto**:
```javascript
this._injectionManager.overrideMethod(AppIcon.prototype, 'activate',
    originalMethod => {
        return function(button) {
            const windows = this.app.get_windows();
            const currentWs = global.workspace_manager.get_active_workspace();
            const localWindows = windows.filter(w =>
                w.located_on_workspace(currentWs) && !w.minimized
            );

            if (localWindows.length > 0) {
                localWindows[0].activate(global.get_current_time());
            } else if (this.app.can_open_new_window()) {
                this.app.open_new_window(-1);
            } else {
                originalMethod.call(this, button);
            }
        };
    }
);
```

**Limitaciones conocidas**:
- Algunas apps no soportan `can_open_new_window()` (casos edge raros)
- Monkey-patching frágil en GNOME 46+
- Puede entrar en conflicto con otras extensiones que modifiquen el dock

**Referencia técnica**: `docs/investigacion/03-extensiones-relevantes.md` (Launch New Instance)

**Estado**: ⚠️ Implementable con monkey-patching (riesgo moderado)

---

### REQ-004: Aplicable a Todas las Aplicaciones [IMPORTANTE]

**Descripción**:
La lógica de control de workspaces debe funcionar para **todas** las aplicaciones GUI, no solo para un tipo específico.

**Aplicaciones mínimas a cubrir**:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Terminal (GNOME Terminal)
- ✅ Configuración del sistema
- ✅ VSCode (Electron)
- ✅ Nautilus
- ✅ LibreOffice
- ✅ GIMP
- ✅ Cualquier app que respete Meta.Window API

**Viabilidad**: ✅ **ALTA (90%+)**

**Implementación**:
- Solución agnóstica de aplicación (basada en Meta.Window, no en app-specific logic)
- Excepciones solo para casos edge documentados (dialogs, popups, etc.)

**Excepciones conocidas**:
- Dialogs y popups (`window.skip_taskbar === true`)
- Sticky windows (`window.is_on_all_workspaces() === true`)
- Apps que no crean ventanas tradicionales (daemons, systray-only apps)

**Estado**: ✅ Implementable

---

### REQ-005: Segundo Dock [NICE-TO-HAVE]

**Descripción**:
Evaluar si es viable tener un segundo dock (por ejemplo, izquierdo + derecho) con comportamientos específicos.

**Criterio de evaluación**:
- ✅ Si es posible hacerlo razonablemente estable → documentar e implementar
- ❌ Si no es razonable → explicarlo claramente y NO inventar soluciones mágicas

**Viabilidad**: ⚠️ **TÉCNICAMENTE VIABLE PERO NO RECOMENDADO**

**Análisis detallado**:

#### Opción 1: Dash to Panel (modo dual)
- **Técnicamente**: ✅ Funciona (soporta múltiples paneles desde v69)
- **Estabilidad**: ✅ Alta (extensión madura, 1M+ usuarios)
- **Trade-off**: ❌ Reemplaza Ubuntu Dock (no coexiste)
- **Cambio visual**: ❌ Significativo (aspecto de KDE/Windows)

#### Opción 2: Dash-to-Dock + Plank
- **Técnicamente**: ⚠️ Posible pero conflictivo
- **Estabilidad**: ⚠️ Media (reportes de conflictos)
- **Integración**: ❌ Plank no está integrado con GNOME Shell
- **Auto-hide**: ❌ Conflictos entre ambos docks

#### Opción 3: Dos instancias de Dash-to-Dock
- **Técnicamente**: ❌ NO POSIBLE
- **Razón**: Diseñado como singleton, conflictos en gsettings
- **Resultado**: Solo uno aparece, crashes al bloquear/desbloquear

**Recomendación final**:

**NO IMPLEMENTAR segundo dock en v1.0** por las siguientes razones:

1. **No aporta valor real** para workspace management
   - El control de workspaces funciona igual con uno o dos docks
   - Aumenta complejidad sin beneficio funcional proporcional

2. **Trade-offs significativos**:
   - Dash to Panel requiere reemplazar Ubuntu Dock (cambio visual drástico)
   - Plank no está integrado con GNOME Shell (experiencia inconsistente)
   - Mantenimiento y debugging se duplica

3. **Alcanzable en v2.0** si José decide que realmente lo necesita después de usar v1.0

**Decisión**: 🔴 **NO IMPLEMENTAR en v1.0** (marcar como feature request para futuro)

**Referencia técnica**: `docs/investigacion/03-extensiones-relevantes.md` (Dash to Panel)

**Estado**: ⚠️ Implementable técnicamente, **NO recomendado** funcionalmente

---

## Requisitos No Funcionales

### REQ-NF-001: Robustez [CRÍTICO]

**Descripción**:
La solución debe ser estable y no causar crashes de GNOME Shell.

**Criterios de aceptación**:
- ✅ No crashes al habilitar/deshabilitar extensión
- ✅ No crashes al cambiar de workspace
- ✅ No crashes al lanzar aplicaciones
- ✅ Manejo defensivo de casos edge (ventanas nulas, workspaces inexistentes, etc.)

**Implementación**:
- Validaciones defensivas en todos los handlers
- Try-catch en secciones críticas
- Desconexión limpia de señales al deshabilitar
- Testing exhaustivo

**Estado**: ✅ Implementable con TDD

---

### REQ-NF-002: Instalable y Revertible [CRÍTICO]

**Descripción**:
La solución debe ser fácil de instalar, actualizar y **desinstalar completamente** sin dejar rastros.

**Criterios de aceptación**:
- ✅ Script `install.sh` que instala la extensión
- ✅ Script `update.sh` que actualiza desde el repo
- ✅ Script `uninstall.sh` que remueve completamente la extensión
- ✅ No modificar archivos del sistema fuera de `~/.local/share/gnome-shell/extensions/`
- ✅ Desinstalar restaura comportamiento original de GNOME

**Implementación**:
- Estructura clara en `~/multitarea-soberana/`
- Scripts Bash documentados
- Instalación solo en directorios de usuario
- Backup de configuración antes de modificar gsettings (si aplica)

**Estado**: ✅ Implementable

---

### REQ-NF-003: Documentación Exhaustiva [IMPORTANTE]

**Descripción**:
Documentación completa y clara para instalación, uso y troubleshooting.

**Documentos requeridos**:
- ✅ README.md con instrucciones paso a paso
- ✅ ADRs (Architectural Decision Records) explicando decisiones técnicas
- ✅ Limitaciones conocidas documentadas
- ✅ FAQ con casos edge comunes
- ✅ Guía de contribución (para futuras mejoras)

**Criterios de aceptación**:
- Otra persona puede instalar siguiendo el README sin ayuda
- Limitaciones claramente expuestas (no promesas mágicas)
- Troubleshooting guide para problemas comunes

**Estado**: ✅ Implementable

---

### REQ-NF-004: Testeable [CRÍTICO - TDD BLOQUEANTE]

**Descripción**:
La lógica de negocio debe ser testeable de forma automatizada.

**Estrategia**:
- ✅ Separar **core de reglas** (JavaScript puro) de **integración GNOME** (GJS)
- ✅ Tests automatizados para `core/rules.js` (Node.js)
- ✅ Checklist de verificación manual para integración GNOME

**Tests automatizados (core/rules.js)**:
```javascript
// Ejemplo de caso de test
test('decide crear nueva ventana en workspace actual si app existe en otro workspace', () => {
    const context = {
        currentWorkspace: 8,
        app: 'chrome',
        existingWindows: [
            { workspace: 1, minimized: false },
            { workspace: 3, minimized: false }
        ]
    };

    const decision = decideAction(context);

    expect(decision.action).toBe('CREATE_NEW_WINDOW');
    expect(decision.workspace).toBe(8);
    expect(decision.switchWorkspace).toBe(false);
});
```

**Verificación manual (checklist)**:
- Chrome en WS 1, abrir desde dock en WS 8 → nueva ventana en WS 8 ✓
- Firefox con múltiples ventanas → siempre nueva en WS actual ✓
- Configuración → nunca salto de workspace ✓
- VSCode → funciona igual que otras apps ✓

**Estado**: ✅ Implementable con arquitectura modular

---

## Limitaciones Aceptadas

Estas limitaciones son **inherentes a Wayland/GNOME** y no pueden resolverse:

### LIM-001: Firefox Session Restore

**Descripción**: Firefox al restaurar sesión siempre intenta volver a los workspaces originales.

**Razón**: Bug conocido de Firefox en Wayland (https://bugzilla.mozilla.org/show_bug.cgi?id=1681989)

**Mitigación**: Force-move después de mapeo reduce problema, pero no elimina 100%.

**Impacto**: BAJO - Solo afecta al restaurar sesión, no al uso normal.

---

### LIM-002: Monkey-Patching Frágil

**Descripción**: Override de `AppIcon.activate()` puede romperse en futuras versiones de GNOME.

**Razón**: GNOME Shell no garantiza API estable para monkey-patching.

**Mitigación**:
- Usar `InjectionManager` (forma oficial desde GNOME 45)
- Documentar versiones de GNOME soportadas
- Tener plan B: gsettings solo o fork de dash-to-dock

**Impacto**: MEDIO - Requiere mantenimiento en actualizaciones de GNOME.

---

### LIM-003: Apps Electron Antiguas

**Descripción**: Apps con Electron < 20 pueden ignorar workspace hints.

**Razón**: Soporte limitado de Wayland en versiones antiguas.

**Mitigación**: Force-move después de mapeo funciona en ~85% de casos.

**Impacto**: BAJO - Mayoría de apps modernas usan Electron 20+.

---

### LIM-004: Wayland No Permite Posicionamiento Absoluto

**Descripción**: No se puede posicionar ventanas en coordenadas específicas.

**Razón**: Restricción de seguridad de Wayland.

**Mitigación**: No necesaria - no es requisito del proyecto.

**Impacto**: NINGUNO para este proyecto.

---

## Matriz de Cumplimiento

| Requisito | Prioridad | Viabilidad | Estado | Limitaciones |
|-----------|-----------|------------|--------|--------------|
| REQ-001: Lanzamiento en WS actual | CRÍTICO | 95% | ✅ Implementable | Apps rebeldes ~5% |
| REQ-002: Sin auto-switch | CRÍTICO | 85% | ⚠️ Limitaciones | Monkey-patch frágil |
| REQ-003: Control del dock | CRÍTICO | 75% | ⚠️ Limitaciones | Monkey-patch requerido |
| REQ-004: Todas las apps | IMPORTANTE | 90% | ✅ Implementable | Dialogs, popups excluidos |
| REQ-005: Segundo dock | NICE-TO-HAVE | N/A | 🔴 NO implementar v1.0 | No aporta valor real |
| REQ-NF-001: Robustez | CRÍTICO | 100% | ✅ Implementable | TDD + defensive coding |
| REQ-NF-002: Instalable/Revertible | CRÍTICO | 100% | ✅ Implementable | Scripts + docs |
| REQ-NF-003: Documentación | IMPORTANTE | 100% | ✅ Implementable | README + ADRs + FAQ |
| REQ-NF-004: Testeable | CRÍTICO | 100% | ✅ Implementable | Arquitectura modular |

---

## Conclusión y Siguiente Paso

**VIABILIDAD GLOBAL DEL PROYECTO**: ✅ **ALTA (85-90%)**

**Requisitos críticos alcanzables**:
- ✅ REQ-001: Lanzamiento en workspace actual (95% efectividad)
- ⚠️ REQ-002: Sin auto-switch (85% efectividad, monkey-patch)
- ⚠️ REQ-003: Control del dock (75% efectividad, monkey-patch)
- ✅ REQ-004: Todas las apps (90% efectividad)

**Requisitos no implementados**:
- 🔴 REQ-005: Segundo dock (técnicamente viable, **no recomendado funcionalmente**)

**Estrategia de implementación**:
1. **Enfoque modular**: Core de reglas (testeable) + Integración GNOME
2. **TDD bloqueante**: Tests primero para lógica de negocio
3. **Defensive coding**: Validaciones y manejo de errores robusto
4. **Documentación honesta**: Limitaciones claramente expuestas

**Próxima fase**: FASE 2 - Blueprint, ADRs y Plan Detallado

**Última actualización**: 2025-11-18
