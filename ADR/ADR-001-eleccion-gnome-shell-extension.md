# ADR-001: Elección de GNOME Shell Extension como Tecnología Principal

**Estado**: Aceptado
**Fecha**: 2025-11-18
**Decisores**: José (usuario) + Claude Code (análisis técnico)
**Contexto técnico**: Investigación exhaustiva en `docs/investigacion/`

---

## Contexto

El proyecto `multitarea-soberana` requiere controlar el comportamiento de lanzamiento de aplicaciones y workspaces en GNOME Shell (Ubuntu 24 Desktop con Wayland). Se necesita decidir la tecnología principal para implementar esta funcionalidad.

**Requisitos clave que influyen en la decisión**:
- REQ-001: Forzar aplicaciones al workspace actual (95% efectividad requerida)
- REQ-002: Evitar cambio automático de workspace (85% efectividad requerida)
- REQ-003: Control del dock (nueva ventana en workspace actual)
- REQ-NF-001: Robustez (sin crashes)
- REQ-NF-002: Instalable y revertible

**Restricciones del entorno**:
- Ubuntu 24 Desktop
- GNOME Shell 46+
- Wayland (no X11)
- Usuario sin permisos de root para modificar sistema

---

## Decisión

**Implementar la solución como una extensión GNOME Shell en GJS (GNOME JavaScript).**

La extensión se instalará en `~/.local/share/gnome-shell/extensions/multitarea-soberana@local/` y utilizará:
- Señales de GNOME Shell (`global.display.connect('window-created', ...)`)
- Meta.Window API para manipulación de ventanas
- Meta.WorkspaceManager para gestión de workspaces
- InjectionManager para monkey-patching cuando sea necesario

---

## Alternativas Consideradas

### Alternativa 1: Daemon Externo (Python/Bash)

**Descripción**: Servicio que corra en background monitoreando eventos de GNOME via D-Bus.

**Ventajas**:
- ✅ Tecnología familiar (Python/Bash más conocidas que GJS)
- ✅ Fácil de debuggear (logs externos)
- ✅ No depende de versiones específicas de GNOME Shell

**Desventajas**:
- ❌ **Acceso limitado a señales internas**: D-Bus no expone `window-created` ni muchas señales críticas
- ❌ **Latencia aumentada**: Comunicación via D-Bus añade delay (50-100ms)
- ❌ **Wayland restringe control externo**: No se puede manipular ventanas desde procesos externos
- ❌ **Necesita extensión auxiliar de todos modos**: Para acceder a APIs internas de GNOME Shell

**Conclusión**: ❌ **Rechazada** - No puede cumplir con requisitos críticos en Wayland.

**Referencia**: `docs/investigacion/02-limitaciones-wayland.md` (sección "Manipulación Externa de Ventanas")

---

### Alternativa 2: Modificar Código de GNOME Shell

**Descripción**: Patchear directamente `/usr/share/gnome-shell/` con código custom.

**Ventajas**:
- ✅ Control total sobre comportamiento
- ✅ No depende de APIs públicas

**Desventajas**:
- ❌ **Requiere permisos de root**
- ❌ **Se pierde en cada actualización del sistema**
- ❌ **Viola REQ-NF-002** (instalable y revertible)
- ❌ **Altamente inseguro** (romper GNOME Shell = sesión inutilizable)
- ❌ **Difícil de mantener y distribuir**

**Conclusión**: ❌ **Rechazada** - Inaceptable por requisitos no funcionales.

---

### Alternativa 3: Fork de Dash-to-Dock

**Descripción**: Hacer fork del código de dash-to-dock y modificar comportamiento de clic.

**Ventajas**:
- ✅ Control total sobre comportamiento del dock
- ✅ No depende de monkey-patching (cambios permanentes)
- ✅ Puede publicarse como extensión independiente

**Desventajas**:
- ❌ **Solo cubre REQ-003** (control del dock) - no soluciona REQ-001 ni REQ-002 completamente
- ❌ **Mantenimiento constante**: Necesita merge periódico con upstream
- ❌ **Conflicto con Ubuntu Dock oficial**: Solo uno puede estar activo
- ❌ **Complejidad innecesaria**: dash-to-dock tiene ~10,000 líneas de código

**Conclusión**: ⚠️ **Reservada como Plan B** - Solo si monkey-patching falla en producción.

**Referencia**: `docs/investigacion/02-limitaciones-wayland.md` (sección "Ubuntu Dock - Opción 2")

---

### Alternativa 4: Configuración via gsettings (Sin Código)

**Descripción**: Modificar solo configuración de dash-to-dock sin código custom.

```bash
gsettings set org.gnome.shell.extensions.dash-to-dock isolate-workspaces true
gsettings set org.gnome.shell.extensions.dash-to-dock click-action 'focus-or-previews'
```

**Ventajas**:
- ✅ Sin código custom (máxima estabilidad)
- ✅ Fácil de instalar/revertir
- ✅ Sin riesgo de romper con actualizaciones

**Desventajas**:
- ❌ **No cumple REQ-001** (forzar apps a workspace actual)
- ❌ **Cumplimiento parcial de REQ-002** (reduce auto-switch pero no elimina)
- ❌ **Cumplimiento parcial de REQ-003** (aísla workspaces pero comportamiento no es exacto)

**Conclusión**: ⚠️ **Usable como complemento** - Configurar gsettings + extensión custom.

---

## Justificación de la Decisión

### ¿Por qué GNOME Shell Extension es la mejor opción?

#### 1. Acceso Completo a APIs Internas

**Señales críticas disponibles**:
```javascript
// Signal window-created (no disponible via D-Bus)
global.display.connect('window-created', (display, window) => {
    // Interceptar ANTES de que ventana sea visible
    const currentWs = global.workspace_manager.get_active_workspace_index();
    window.change_workspace_by_index(currentWs, false);
});
```

**Sin este acceso**: Imposible cumplir REQ-001 con 95% efectividad.

**Evidencia**: `docs/investigacion/01-apis-gnome-shell.md` (sección "Meta.Display - window-created")

---

#### 2. Meta.Window API - Control Total de Ventanas

**Operaciones permitidas desde extensión**:
- ✅ `window.change_workspace_by_index()` - Mover ventanas entre workspaces
- ✅ `window.activate()` - Activar sin cambiar workspace
- ✅ `window.located_on_workspace()` - Filtrar ventanas por workspace
- ✅ `window.get_workspace()` - Obtener workspace actual de ventana

**En Wayland desde proceso externo**: ❌ TODAS bloqueadas

**Evidencia**: `docs/investigacion/02-limitaciones-wayland.md` (matriz de compatibilidad)

---

#### 3. Latencia Mínima

**Timeline de creación de ventana**:
```
1. Usuario hace clic → 0ms
2. App lanza → +50ms
3. Ventana creada → signal 'window-created' dispara INMEDIATAMENTE
4. Force-move ejecuta → +1-5ms
5. Ventana visible → usuario no percibe delay
```

**Con daemon externo via D-Bus**: +50-100ms de delay perceptible.

**Impacto**: Sin delay, cumple expectativa de "control total".

---

#### 4. Ejemplos Probados en Producción

**Extensiones oficiales GNOME que usan este approach**:
- Auto Move Windows: ~1M usuarios, estable desde GNOME 3.x
- Launch New Instance: Extensión oficial, mantenida activamente
- Dash to Dock: ~5M usuarios, base de Ubuntu Dock

**Confiabilidad**: ✅ ALTA - Patrón validado por comunidad GNOME.

**Evidencia**: `docs/investigacion/03-extensiones-relevantes.md`

---

#### 5. Instalación sin Root

**Directorio de instalación**:
```
~/.local/share/gnome-shell/extensions/multitarea-soberana@local/
```

**Permisos requeridos**: Solo acceso a directorio home (disponible para usuario normal).

**Cumple REQ-NF-002**: ✅ Instalable sin sudo, revertible borrando directorio.

---

## Consecuencias

### Consecuencias Positivas

1. ✅ **Cumplimiento de requisitos críticos**:
   - REQ-001: 95% efectividad alcanzable
   - REQ-002: 85% efectividad alcanzable
   - REQ-003: 75% efectividad alcanzable (con monkey-patch)

2. ✅ **Latencia imperceptible**: Sin delay entre acción del usuario y resultado.

3. ✅ **Instalación simple**: Solo copiar archivos a directorio de usuario.

4. ✅ **Revertible fácilmente**: Deshabilitar extensión o borrar directorio.

5. ✅ **Basado en tecnología probada**: Mismo approach que extensiones oficiales GNOME.

6. ✅ **Debugging facilitado**: Logs accesibles via `journalctl -f /usr/bin/gnome-shell`.

---

### Consecuencias Negativas (y Mitigaciones)

1. ⚠️ **Dependencia de versiones de GNOME Shell**:
   - **Problema**: APIs pueden cambiar entre versiones
   - **Mitigación**: Documentar versiones soportadas (GNOME 46+), probar en cada release

2. ⚠️ **Monkey-patching es frágil**:
   - **Problema**: Override de `AppIcon.activate()` puede romperse
   - **Mitigación**:
     - Usar `InjectionManager` (forma oficial desde GNOME 45)
     - Tener Plan B: fork de dash-to-dock
     - Documentar riesgo claramente en README

3. ⚠️ **GJS menos familiar que Python/Bash**:
   - **Problema**: Curva de aprendizaje para contribuidores
   - **Mitigación**:
     - Documentar código exhaustivamente
     - Separar lógica (JS puro) de integración (GJS)
     - Proveer ejemplos claros

4. ⚠️ **Posibles conflictos con otras extensiones**:
   - **Problema**: Otras extensiones pueden modificar las mismas APIs
   - **Mitigación**:
     - Preservar método original en monkey-patch
     - Documentar extensiones incompatibles conocidas
     - Probar con setup común de Ubuntu 24

---

### Riesgos Residuales

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| GNOME 47+ rompe APIs usadas | Media | Alto | Probar en beta, actualizar código |
| Monkey-patch falla en producción | Baja | Medio | Plan B: fork dash-to-dock |
| Conflicto con extensión X | Baja | Bajo | Documentar incompatibilidades |
| Apps rebeldes ignoran force-move | Media | Bajo | Delay de 100ms, documentar casos |

---

## Decisiones Derivadas

De esta decisión se derivan:

1. **ADR-002**: Separación entre core de reglas (JS puro) e integración GNOME (GJS)
   - Necesaria para testear lógica de negocio sin GNOME Shell

2. **ADR-003**: Estrategia de instalación en `~/.local/share/gnome-shell/extensions/`
   - Directorio estándar para extensiones de usuario

3. **Uso de InjectionManager**: Preferir sobre monkey-patch manual
   - Forma oficial desde GNOME 45+

4. **Testing strategy**: Tests automatizados para core + checklist manual para integración
   - GJS no se puede testear fácilmente en CI

---

## Referencias

### Documentación Técnica
- `docs/investigacion/01-apis-gnome-shell.md` - APIs disponibles
- `docs/investigacion/02-limitaciones-wayland.md` - Por qué daemon externo no funciona
- `docs/investigacion/03-extensiones-relevantes.md` - Extensiones que usan este approach
- `docs/requisitos/requisitos-detallados.md` - Requisitos que esta decisión cumple

### Documentación Oficial GNOME
- GJS Guide: https://gjs.guide/extensions/
- Meta.Window API: https://mutter.gnome.org/meta/class.Window.html
- Signal window-created: https://mutter.gnome.org/meta/signal.Display.window-created.html

### Extensiones de Referencia
- Auto Move Windows: https://github.com/GNOME/gnome-shell-extensions/tree/main/extensions/auto-move-windows
- Launch New Instance: https://github.com/GNOME/gnome-shell-extensions/tree/main/extensions/launch-new-instance

---

## Revisiones

| Fecha | Versión | Cambio | Autor |
|-------|---------|--------|-------|
| 2025-11-18 | 1.0 | Decisión inicial | Claude Code + José |

---

**Estado final**: ✅ **ACEPTADO**

**Confianza**: ALTA (90%)

**Próximo ADR**: ADR-002 - Separación Core de Reglas vs Integración GNOME
