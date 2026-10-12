import { build } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { cards } from '../cards';

it('bundles and runs in a context with neither Node nor fetch', async () => {
    const result = await build({ entryPoints: ['src/index.ts'], bundle: true, platform: 'browser',
        format: 'iife', globalName: 'Lorcana', write: false, metafile: true, target: 'es2022' });
    const output = result.outputFiles[0];
    if (!output) throw new Error('Build produced no output');
    const api: typeof import('../index') = runInNewContext(`${output.text}\nLorcana`, { structuredClone });
    expect(api.cards).toHaveLength(cards.length);
    const card = api.getCard('Friends on the Other Side');
    if (!card) throw new Error('Missing bundled fixture');
    expect(card.colors).toEqual(['Amethyst']);
    expect(card.names).toEqual(['Friends on the Other Side']);
    expect(card).toMatchObject({ type: 'Action', effect: { type: 'Draw', player: 'You', amount: 2 } });
    const parsed = api.parseCard({ fullName: card.fullName, type: card.type, effects: ['Draw 2 cards.'] });
    expect(parsed.supported).toBe(true);
    if (!parsed.supported) throw new Error(JSON.stringify(parsed.issues));
    expect(parsed.rules).toMatchObject({ type: 'Action', effect: { type: 'Draw', player: 'You', amount: 2 } });
    const player = { lore: 0, turnsTaken: 0, deck: [], hand: [], play: [], discard: [], inkwell: [] };
    const resolution = api.startEffect({ turn: { number: 1, player: 1 }, players: { 1: player } },
        { type: 'Gain Lore', player: 'You', amount: 2 }, {
        card: { fullName: card.fullName, i: 1 }, player: 1, kind: 'Action',
    });
    const next = await api.drive(resolution, () => { throw new Error('Unexpected browser decision'); });
    expect(next.players[1]?.lore).toBe(2);
    for (const input of Object.keys(result.metafile.inputs)) expect(input.startsWith('src/')).toBe(true);
    for (const output of Object.values(result.metafile.outputs)) expect(output.imports).toEqual([]);
});

it('keeps all source imports inside src and Node imports at the edge', () => {
    const root = resolve('src');
    const files = readdirSync(root, { recursive: true }).map(String).filter(file => /\.(ts|mts)$/.test(file));
    for (const file of files) {
        const fullPath = resolve(root, file);
        const source = readFileSync(fullPath, 'utf8');
        const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
        const imports = syntax.statements.flatMap(statement => {
            if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
                statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
                return [statement.moduleSpecifier.text];
            }
            return [];
        });
        for (const imported of imports) {
            if (imported.startsWith('.')) {
                const target = relative(root, resolve(dirname(fullPath), imported));
                expect(target.startsWith('..') || isAbsolute(target), `${file}: ${imported}`).toBe(false);
            } else if (!file.startsWith('tests') && !file.startsWith('scripts')) {
                throw new Error(`Platform dependency in core: ${file} imports ${imported}`);
            }
        }
    }
});
