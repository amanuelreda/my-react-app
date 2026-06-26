// Foundry-independent compile check for the TeleBlock contracts. Apache-2.0
//
// Compiles contracts/src with solc-js (no native toolchain needed) and fails on any error. This is a
// fast sanity gate that runs anywhere npm runs; `forge build`/`forge test` remain the full pipeline.
import solc from 'solc';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const sources = {};
function addDir(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) addDir(p);
    else if (f.endsWith('.sol')) sources[relative(ROOT, p)] = { content: readFileSync(p, 'utf8') };
  }
}
addDir(ROOT);

function findImports(rel) {
  const p = join(ROOT, rel);
  try {
    return { contents: readFileSync(p, 'utf8') };
  } catch {
    return { error: 'File not found: ' + rel };
  }
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors || []).filter((e) => e.severity === 'error');
const warnings = (out.errors || []).filter((e) => e.severity === 'warning');

console.log(`solc ${solc.version()}`);
console.log(`Compiled ${Object.keys(sources).length} source files · ${errors.length} errors · ${warnings.length} warnings`);
for (const w of warnings) console.log('warn:', (w.formattedMessage || '').split('\n')[0]);
for (const e of errors) console.log(e.formattedMessage);

if (errors.length) process.exit(1);

let withBytecode = 0;
for (const file of Object.keys(out.contracts || {})) {
  for (const name of Object.keys(out.contracts[file])) {
    if (out.contracts[file][name].evm.bytecode.object?.length) withBytecode++;
  }
}
console.log(`OK — ${withBytecode} contracts produced bytecode.`);
