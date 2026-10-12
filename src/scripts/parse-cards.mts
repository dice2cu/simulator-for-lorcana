import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseCatalog } from '../parser/index.ts';
import { readCatalog } from './embed-cards.mts';

// File access lives here. The parser itself also works in a browser.
const root = process.cwd();
const { cards } = readCatalog(JSON.parse(readFileSync(resolve(root, 'temp/allCards.json'), 'utf8')));
const output = resolve(process.argv[2] ?? resolve(root, 'reports/parser.json'));
const report = parseCatalog(cards);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const s = report.summary;
console.log(`Printings: ${s.supportedPrintings}/${s.printings}`);
console.log(`Printed slots: ${s.supportedSlots}/${s.slots}`);
console.log(`Unsupported wordings: ${s.unsupportedWordings}`);
console.log(`Report: ${output}`);
if (report.unsupported.length) process.exitCode = 1;
