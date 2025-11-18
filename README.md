# Multitarea Soberana

**Control total de workspaces en GNOME Shell** para Ubuntu 24 Desktop con Wayland.

## Problema que Resuelve

Por defecto, GNOME Shell tiene comportamientos automáticos que pueden ser frustrantes:

- **Apps se abren en workspace arbitrario** (usualmente workspace 1) en vez del workspace actual
- **Clic en dock cambia automáticamente de workspace** si la app ya tiene ventana en otro workspace
- **Sin control fino** sobre dónde se crean nuevas ventanas

**Multitarea Soberana** te da control total:

✅ **Todas las apps se abren en el workspace actual** (no en workspace 1 arbitrariamente)
✅ **Sin cambio automático de workspace** al activar apps existentes
✅ **Control del dock**: clic simple = nueva ventana en workspace actual

---

## Requisitos

- Ubuntu 24 Desktop (o derivado con GNOME Shell 46+)
- GNOME Shell versión 46 o 47
- Wayland (funciona también en X11)

**Verificar versión de GNOME Shell**:
```bash
gnome-shell --version
```

---

## Instalación Rápida

```bash
# 1. Clonar repositorio
cd ~/
git clone https://github.com/josem4pro/multitarea-soberana.git
cd multitarea-soberana

# 2. Instalar extensión
./scripts/install.sh

# 3. Reiniciar GNOME Shell
# Wayland: Cerrar sesión y volver a iniciar
# X11: Alt+F2 → r → Enter

# 4. Verificar instalación
gnome-extensions list --enabled | grep multitarea-soberana
```

**Resultado esperado**: `multitarea-soberana@local`

---

## Uso

Una vez instalada y activada, la extensión funciona automáticamente:

### Comportamiento 1: Lanzar apps

- Lanzar Chrome desde dock en workspace 8 → **Chrome se abre en workspace 8**
- Lanzar Terminal con Ctrl+Alt+T en workspace 5 → **Terminal se abre en workspace 5**
- Buscar Firefox en overview (Super) estando en workspace 3 → **Firefox se abre en workspace 3**

### Comportamiento 2: Apps existentes

- Chrome abierto en workspace 1, hacer clic en dock estando en workspace 8:
  - **NO salta a workspace 1**
  - **Crea nueva ventana de Chrome en workspace 8**

### Comportamiento 3: Ventanas en workspace actual

- Terminal minimizada en workspace actual:
  - Hacer clic en dock → **Se restaura (deja de estar minimizada)**

- Nautilus activa en workspace actual:
  - Hacer clic en dock → **Recibe foco (se activa)**

---

## Actualización

```bash
cd ~/multitarea-soberana
git pull
./scripts/update.sh

# Reiniciar GNOME Shell (ver arriba)
```

El script de actualización:
- Crea backup automático de configuración
- Actualiza archivos de la extensión
- Preserva tus datos

---

## Desinstalación

```bash
cd ~/multitarea-soberana
./scripts/uninstall.sh
```

El script de desinstalación:
- Deshabilita la extensión
- Elimina archivos instalados
- (Opcional) Elimina configuración guardada

Para eliminar completamente el proyecto:
```bash
rm -rf ~/multitarea-soberana
```

---

## Desarrollo

### Ejecutar Tests

```bash
cd ~/multitarea-soberana
npm test
```

**Resultado esperado**: `9/9 tests pasando`

### Ver Logs en Tiempo Real

```bash
./scripts/dev-logs.sh
```

Muestra logs de la extensión para debugging.

### Arquitectura

El proyecto sigue una arquitectura modular (ver [ADR-002](ADR/ADR-002-separacion-core-reglas-integracion-gnome.md)):

- **`core/rules.js`**: Lógica de decisión (JavaScript puro, testeable)
- **`extension/extension.js`**: Integración con GNOME Shell (GJS)
- **`tests/`**: Tests automatizados (Node.js)
- **`scripts/`**: Scripts de instalación/desinstalación

---

## Limitaciones Conocidas

### 1. Firefox Session Restore

**Problema**: Firefox al restaurar sesión puede ignorar el workspace actual.

**Razón**: Bug conocido de Firefox en Wayland ([#1681989](https://bugzilla.mozilla.org/show_bug.cgi?id=1681989))

**Mitigación**: La extensión fuerza ventanas al workspace actual después de que aparecen (~95% efectividad).

### 2. Apps Electron Antiguas

**Problema**: Apps con Electron < 20 pueden tener comportamiento inconsistente.

**Razón**: Soporte limitado de Wayland en versiones antiguas.

**Mitigación**: Delay de 100ms permite capturar ~85% de casos. Apps modernas (Electron 20+) funcionan perfectamente.

### 3. Monkey-Patching del Dock

**Problema**: El override de comportamiento del dock puede romperse en futuras versiones de GNOME.

**Razón**: GNOME Shell no garantiza API estable para modificaciones internas.

**Plan B**: Fork de dash-to-dock o configuración via gsettings (documentado en ADRs).

---

## Documentación Técnica

### Decisiones Arquitectónicas (ADRs)

- [ADR-001: Elección de GNOME Shell Extension](ADR/ADR-001-eleccion-gnome-shell-extension.md)
  - Por qué extensión GNOME vs daemon externo, fork, etc.

- [ADR-002: Separación Core vs Integración](ADR/ADR-002-separacion-core-reglas-integracion-gnome.md)
  - Arquitectura modular para TDD y testabilidad

- [ADR-003: Estrategia de Instalación](ADR/ADR-003-estrategia-instalacion-actualizacion.md)
  - Instalación sin sudo, actualización segura, desinstalación completa

### Investigación Técnica

- [APIs de GNOME Shell](docs/investigacion/01-apis-gnome-shell.md)
  - Meta.Window, WorkspaceManager, señales disponibles

- [Limitaciones de Wayland](docs/investigacion/02-limitaciones-wayland.md)
  - Qué NO se puede hacer en Wayland y workarounds

- [Extensiones GNOME Relevantes](docs/investigacion/03-extensiones-relevantes.md)
  - Análisis de Auto Move Windows, Launch New Instance, etc.

### Requisitos y Plan

- [Requisitos Detallados](docs/requisitos/requisitos-detallados.md)
  - Matriz de cumplimiento, limitaciones aceptadas

- [Plan de Implementación](docs/PLAN-IMPLEMENTACION.md)
  - Plan paso a paso con TDD bloqueante

---

## FAQ

### ¿Por qué no usar gsettings de dash-to-dock?

**Respuesta**: gsettings solo permite configuración básica:
- `isolate-workspaces: true` → Filtra apps por workspace (pero no evita auto-switch completamente)
- `click-action: 'launch'` → Siempre nueva instancia (pero también cuando hay ventana local)

Nuestra extensión implementa lógica más sofisticada:
- Nueva ventana si **NO** hay ventana local
- Activar ventana si **SÍ** hay ventana local
- Restaurar ventana si está minimizada

### ¿Funciona en X11?

**Sí**, aunque fue diseñada primariamente para Wayland. En X11 funciona igual de bien.

### ¿Es compatible con otras extensiones?

**Mayoría sí**, pero puede haber conflictos con:
- `auto-move-windows` (asigna apps a workspaces fijos)
- Extensiones que modifican el dock (Dash to Panel, etc.)

### ¿Puedo personalizar el comportamiento?

**v1.0 no tiene GUI de configuración**, pero puedes:
- Modificar `core/rules.js` para cambiar lógica de decisión
- Ejecutar tests para verificar: `npm test`
- Reinstalar con `./scripts/update.sh`

Configuración via GUI está planificada para v2.0.

### ¿Cómo reporto bugs?

GitHub Issues: https://github.com/josem4pro/multitarea-soberana/issues

Por favor incluye:
- Versión de GNOME Shell (`gnome-shell --version`)
- Logs de la extensión (`./scripts/dev-logs.sh`)
- Pasos para reproducir el problema

---

## Roadmap

### v1.0 (Actual)
- ✅ Force-to-current-workspace
- ✅ Sin auto-switch
- ✅ Control del dock
- ✅ Tests automatizados (9/9 pasando)

### v2.0 (Futuro)
- [ ] GUI de configuración (gsettings schema)
- [ ] Reglas por app (excepciones personalizables)
- [ ] Publicar en extensions.gnome.org
- [ ] Soporte para GNOME 48+

---

## Licencia

MIT License - Ver LICENSE para detalles.

---

## Autor

**José** - https://github.com/josem4pro

## Contribuciones

Contribuciones son bienvenidas. Por favor:
1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/mi-feature`)
3. Commit tus cambios (`git commit -m 'Agregar mi feature'`)
4. Push a la rama (`git push origin feature/mi-feature`)
5. Abre un Pull Request

**Antes de contribuir**, revisa:
- [Plan de Implementación](docs/PLAN-IMPLEMENTACION.md)
- [ADRs](ADR/)
- Ejecuta tests: `npm test` (deben pasar 9/9)

---

## Agradecimientos

- Comunidad GNOME por excelente documentación de APIs
- Desarrolladores de extensiones oficiales (Auto Move Windows, Launch New Instance)
- Proyecto Dash to Dock por código de referencia

---

**¿Listo para tomar control de tus workspaces?** `./scripts/install.sh` 🚀
