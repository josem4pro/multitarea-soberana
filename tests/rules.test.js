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
