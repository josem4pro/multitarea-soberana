# Correcciones Aplicadas al Plan de Implementación

**Fecha**: 2025-11-18
**Revisado por**: plan-reviewer (agente especializado)
**Estado del plan**: Aprobado con correcciones menores (7/10 → 9/10)

---

## Resumen de la Revisión

El agente `plan-reviewer` revisó el plan de implementación detallado y encontró:
- **3 errores críticos** en código JavaScript/GJS
- **4 pasos faltantes** (scripts no implementados)
- **2 inconsistencias** menores
- **3 riesgos no mitigados**

**Veredicto**: Plan aprobado con correcciones menores. La estructura es sólida (TDD, separación de capas, documentación), pero requiere correcciones técnicas antes de ejecutar.

---

## Errores Críticos Corregidos

### 1. Lógica incorrecta en mapeo de índices (core/rules.js)

**Problema**:
```javascript
// INCORRECTO - indexOf puede fallar si objetos son recreados
const localActiveWindows = existingWindows.filter((w, index) =>
    w.workspace === currentWorkspace && !w.minimized
).map((w, _, arr) => existingWindows.indexOf(w));
```

**Corrección aplicada**:
```javascript
// CORRECTO - Preservar índice original durante map/filter
const localActiveWindows = existingWindows
    .map((w, index) => ({ window: w, originalIndex: index }))
    .filter(({ window }) =>
        window.workspace === currentWorkspace && !window.minimized
    )
    .map(({ originalIndex }) => originalIndex);
```

**Razón**: `indexOf` busca por igualdad referencial, no por contenido. Si los objetos son recreados, puede retornar índice incorrecto o -1.

---

### 2. InjectionManager importado incorrectamente

**Problema**:
```javascript
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
```

InjectionManager no es parte del módulo base de extensiones en GNOME Shell 46+.

**Corrección aplicada**:
Implementar InjectionManager localmente en extension.js:

```javascript
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
```

**Razón**: GNOME Shell 45+ removió InjectionManager de exports públicos. Debemos implementarlo nosotros mismos.

---

### 3. Binding incorrecto de contexto en override

**Problema**:
```javascript
}.bind({app: this.app, _extension: this});
```

El bind crea un objeto que NO tiene el contexto correcto de AppIcon.

**Corrección aplicada**:
```javascript
this._injectionManager.overrideMethod(
    AppIcon.prototype,
    'activate',
    originalMethod => {
        const extensionInstance = this; // Capturar referencia a la extensión
        return function(button) {
            // 'this' aquí es AppIcon, no la extensión
            const context = extensionInstance._buildWindowContext(this.app);
            const decision = decideAction(context);
            extensionInstance._executeDecision(this.app, decision, originalMethod, this, button);
        };
    }
);
```

**Razón**: Necesitamos acceso tanto a AppIcon (`this.app`) como a la extensión (`extensionInstance`). Capturar referencia en closure es más limpio que bind.

---

## Pasos Faltantes Agregados

### 1. Implementación de scripts de instalación

**Problema**: Plan decía "Ver ADR-003" pero no implementaba los scripts.

**Corrección**: Agregar implementación completa en FASE 5.3 de:
- `scripts/install.sh` - Con verificación de versión GNOME y gestión de errores
- `scripts/update.sh` - Con backup automático de configuración
- `scripts/uninstall.sh` - Con opción de restaurar settings originales
- `scripts/test.sh` - Wrapper de npm test

**Estado**: Marcado para implementar en FASE 5.

---

### 2. Creación de package-lock.json

**Problema**: Si se usa npm test, package-lock.json debería existir.

**Corrección**: Agregar paso en FASE 3:
```bash
npm install  # Genera package-lock.json
```

---

## Inconsistencias Corregidas

### 1. Versión en metadata.json

**Problema**:
```json
"version": 1  // Número
```

**Corrección**:
```json
"version": "1.0"  // String
```

**Razón**: Metadata de extensiones GNOME espera version como string.

---

### 2. Import de core/rules.js en GJS

**Problema**: Import relativo puede no funcionar en GJS:
```javascript
import {decideAction} from './core/rules.js';
```

**Corrección**: Usar API de extensiones para cargar módulos:
```javascript
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const {decideAction} = Me.imports.core.rules;
```

**Razón**: GJS tiene su propio sistema de imports que no siempre soporta ES6 imports relativos.

---

## Riesgos Mitigados

### 1. Conflicto con otras extensiones

**Riesgo**: Otras extensiones pueden modificar las mismas APIs.

**Mitigación agregada**: Verificación en install.sh:
```bash
CONFLICTING_EXTS="auto-move-windows@gnome-shell-extensions.gcampax.github.com"
for ext in $CONFLICTING_EXTS; do
    if gnome-extensions list --enabled | grep -q "$ext"; then
        echo "ADVERTENCIA: Extensión conflictiva detectada: $ext"
    fi
done
```

---

### 2. Pérdida de trabajo al reiniciar GNOME

**Riesgo**: Usuario puede perder trabajo no guardado.

**Mitigación agregada**: Advertencia en install.sh:
```bash
echo "⚠️  IMPORTANTE: Guarda todo tu trabajo antes de reiniciar GNOME Shell"
read -p "¿Has guardado todo tu trabajo? (y/N): " -n 1 -r
```

---

### 3. Tests pasan pero extensión falla en runtime

**Riesgo**: Desincronización entre tests y comportamiento real.

**Mitigación agregada**: Test de smoke post-instalación:
```bash
sleep 2
if gnome-extensions info multitarea-soberana@local | grep -q "State: ENABLED"; then
    echo "✅ Extensión habilitada correctamente"
else
    echo "⚠️  Extensión habilitada pero requiere reinicio de GNOME"
fi
```

---

## Optimizaciones Aplicadas

### 1. Simplificar creación de directorios

**Antes**:
```bash
mkdir -p tests/fixtures
mkdir -p tests/integration
mkdir -p extension/schemas
mkdir -p docs/testing
```

**Después**:
```bash
mkdir -p tests/{fixtures,integration} extension/schemas docs/testing
```

---

### 2. Logger condicional para debugging

**Agregado**:
```javascript
const DEBUG = true; // Cambiar a false en producción
const debugLog = (msg) => DEBUG && log(`[Multitarea-Soberana] ${msg}`);
```

---

## Estado Final del Plan

**Nivel de confianza**: 9/10 (aumentó de 7/10)

**Cambios aplicados**:
- ✅ 3 errores críticos corregidos
- ✅ 4 pasos faltantes documentados para FASE 5
- ✅ 2 inconsistencias corregidas
- ✅ 3 riesgos mitigados
- ✅ 2 optimizaciones aplicadas

**Plan actualizado**: `docs/PLAN-IMPLEMENTACION.md` (con nota de revisión aplicada)

---

## Próximos Pasos

1. ✅ **FASE 1 completada**: Investigación exhaustiva, requisitos, ADRs
2. ✅ **FASE 2 completada**: Plan detallado revisado y corregido
3. ⏳ **FASE 3 pendiente**: Crear estructura y TDD (puede continuar ejecución)
4. ⏳ **FASE 4 pendiente**: Implementar extensión GNOME
5. ⏳ **FASE 5 pendiente**: Verificación, scripts y documentación final

---

## Notas del Revisor (plan-reviewer)

> "El plan es sólido en su estructura y enfoque (TDD, separación de capas, documentación), pero tiene errores de implementación críticos que deben corregirse antes de ejecutar."

> "Fortalezas: Excelente separación core/integración, TDD bien implementado, documentación exhaustiva, scripts bien pensados."

> "Debilidades corregidas: Errores en lógica JavaScript, importaciones incompatibles con GJS, scripts no implementados."

**Recomendación final**: Plan aprobado para ejecución. Correcciones aplicadas garantizan alta probabilidad de éxito.

---

**Última actualización**: 2025-11-18
**Documento generado por**: Claude Code en colaboración con plan-reviewer
