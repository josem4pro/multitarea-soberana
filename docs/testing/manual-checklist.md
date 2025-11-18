# Checklist de Verificación Manual

**Fecha**: _____
**Tester**: José
**Versión GNOME**: _____
**Comando para verificar versión**: `gnome-shell --version`

---

## Instalación

- [ ] `./scripts/install.sh` ejecuta sin errores
- [ ] Extensión aparece en `gnome-extensions list`
- [ ] Después de reiniciar GNOME (logout/login), extensión está habilitada
- [ ] Verificar estado: `gnome-extensions info multitarea-soberana@local`

---

## REQ-001: Lanzamiento en Workspace Actual

### Caso 1: App sin ventanas existentes
- [ ] Chrome cerrado completamente
- [ ] Cambiar a workspace 8
- [ ] Abrir Chrome desde dock
- [ ] **Resultado esperado**: Chrome se abre en workspace 8

### Caso 2: App en otro workspace
- [ ] Chrome abierto en workspace 1
- [ ] Cambiar a workspace 8
- [ ] Abrir Chrome desde buscador (Super) o dock
- [ ] **Resultado esperado**: Nueva ventana de Chrome en workspace 8 (NO salta a WS 1)

### Caso 3: Terminal con atajo de teclado
- [ ] Terminal abierto en workspace 2
- [ ] Cambiar a workspace 7
- [ ] Presionar Ctrl+Alt+T (atajo terminal)
- [ ] **Resultado esperado**: Nueva ventana de terminal en workspace 7

### Caso 4: VSCode en múltiples workspaces
- [ ] VSCode abierto en workspace 1, 3, 5
- [ ] Cambiar a workspace 8
- [ ] Lanzar VSCode desde dock
- [ ] **Resultado esperado**: Nueva ventana de VSCode en workspace 8

---

## REQ-002: Sin Cambio Automático de Workspace

### Caso 1: Chrome distribuido
- [ ] Chrome abierto en workspace 1 y 3
- [ ] Cambiar a workspace 8
- [ ] Hacer clic en icono de Chrome en dock
- [ ] **Resultado esperado**: NO salta a WS 1 ni 3, crea nueva ventana en WS 8

### Caso 2: Firefox desde buscador
- [ ] Firefox con ventanas en workspace 2 y 4
- [ ] Cambiar a workspace 5
- [ ] Buscar "Firefox" en overview (Super) y lanzar
- [ ] **Resultado esperado**: NO salta a WS 2 ni 4, abre en WS 5

### Caso 3: Configuración del sistema
- [ ] Configuración abierta en workspace 1
- [ ] Cambiar a workspace 4
- [ ] Hacer clic en Configuración en dock
- [ ] **Resultado esperado**: NO salta a WS 1, nueva ventana en WS 4

---

## REQ-003: Control del Dock

### Caso 1: Ventana minimizada en workspace actual
- [ ] Terminal abierto y minimizado en workspace actual
- [ ] Hacer clic en icono de Terminal en dock
- [ ] **Resultado esperado**: Terminal se restaura (deja de estar minimizado)

### Caso 2: Ventana activa en workspace actual
- [ ] Nautilus abierto y visible en workspace actual
- [ ] Cambiar foco a otra app (ej: Chrome)
- [ ] Hacer clic en icono de Nautilus en dock
- [ ] **Resultado esperado**: Nautilus recibe foco (se activa)

### Caso 3: Múltiples ventanas
- [ ] LibreOffice abierto en workspace 1
- [ ] Cambiar a workspace 8
- [ ] Hacer clic en LibreOffice en dock
- [ ] **Resultado esperado**: Nueva ventana de LibreOffice en workspace 8

---

## REQ-004: Todas las Aplicaciones

Probar con diferentes tipos de aplicaciones:

### Apps Electron
- [ ] VSCode: funciona como esperado
- [ ] Slack (si está instalado): funciona como esperado

### Navegadores
- [ ] Chrome/Chromium: funciona como esperado
- [ ] Firefox: funciona como esperado
- [ ] Edge (si está instalado): funciona como esperado

### Apps GNOME nativas
- [ ] GNOME Terminal: funciona como esperado
- [ ] Nautilus (Archivos): funciona como esperado
- [ ] GNOME Configuración: funciona como esperado
- [ ] GNOME Text Editor: funciona como esperado

### Apps de terceros
- [ ] LibreOffice: funciona como esperado
- [ ] GIMP (si está instalado): funciona como esperado

---

## Robustez

### Estabilidad
- [ ] No crashes al habilitar extensión
- [ ] No crashes al deshabilitar extensión
- [ ] No crashes al cambiar entre workspaces rápidamente (10+ cambios seguidos)
- [ ] No crashes al lanzar 10+ apps simultáneamente

### Logging
- [ ] `./scripts/dev-logs.sh` muestra logs de la extensión
- [ ] Logs son legibles y útiles
- [ ] Logs indican cuando ventana es movida a workspace actual

### Edge cases
- [ ] Apps que solo permiten una instancia (ej: GNOME Configuración) se activan correctamente
- [ ] Dialogs y popups NO son movidos (comportamiento correcto)
- [ ] Ventanas sticky (en todos los workspaces) NO son movidas

---

## Desinstalación

- [ ] `./scripts/uninstall.sh` ejecuta sin errores
- [ ] Extensión eliminada de `gnome-extensions list`
- [ ] Después de reiniciar GNOME, extensión NO aparece
- [ ] Comportamiento de GNOME restaurado a original (ventanas abren donde GNOME decide)
- [ ] No quedan rastros en `~/.local/share/gnome-shell/extensions/`

---

## Notas de Pruebas

**Apps problemáticas encontradas**:
- _____________________
- _____________________

**Comportamientos inesperados**:
- _____________________
- _____________________

**Casos edge no cubiertos**:
- _____________________
- _____________________

---

## Resumen Final

**Total de casos probados**: ___ / ___
**Casos exitosos**: ___
**Casos fallidos**: ___
**Casos parcialmente funcionales**: ___

**¿Extensión lista para uso diario?** Sí / No / Con reservas

**Comentarios adicionales**:
_____________________________________________________________________________
_____________________________________________________________________________
