// In-process EVM harness for executing the TeleBlock contracts. Apache-2.0
//
// Compiles src/ with solc, deploys to an @ethereumjs/evm instance, and exposes typed call/send
// helpers (calldata via viem). This lets us run contract *behavior* tests anywhere npm runs — a
// Foundry-independent complement to `forge test` (which remains the full pipeline in CI).
import solc from 'solc';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVM } from '@ethereumjs/evm';
import { Address, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

let artifacts; // { [contractName]: { abi, bytecode } }

function compile() {
  if (artifacts) return artifacts;
  const sources = {};
  (function add(dir) {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) add(p);
      else if (f.endsWith('.sol')) sources[relative(SRC, p)] = { content: readFileSync(p, 'utf8') };
    }
  })(SRC);

  const input = {
    language: 'Solidity',
    sources,
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  const out = JSON.parse(
    solc.compile(JSON.stringify(input), {
      import: (rel) => {
        try {
          return { contents: readFileSync(join(SRC, rel), 'utf8') };
        } catch {
          return { error: 'not found ' + rel };
        }
      },
    }),
  );
  const errs = (out.errors || []).filter((e) => e.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.formattedMessage).join('\n'));

  artifacts = {};
  for (const file of Object.keys(out.contracts)) {
    for (const name of Object.keys(out.contracts[file])) {
      artifacts[name] = { abi: out.contracts[file][name].abi, bytecode: '0x' + out.contracts[file][name].evm.bytecode.object };
    }
  }
  return artifacts;
}

const addr = (n) => Address.fromString('0x' + n.toString(16).padStart(40, '0'));

export class Chain {
  static async create() {
    const evm = await EVM.create();
    return new Chain(evm);
  }
  constructor(evm) {
    this.evm = evm;
    compile();
  }

  /** Deploy a compiled contract (constructor args optional). Returns a typed handle. */
  async deploy(name, { from = addr(1), args = [] } = {}) {
    const art = artifacts[name];
    if (!art) throw new Error(`unknown contract ${name}`);
    // Append ABI-encoded constructor args (none of ours need complex encoding beyond addresses).
    let data = art.bytecode;
    const ctor = art.abi.find((x) => x.type === 'constructor');
    if (ctor && ctor.inputs.length) {
      // encode args using a throwaway function-style ABI
      const enc = encodeFunctionData({
        abi: [{ type: 'function', name: '_c', inputs: ctor.inputs, outputs: [] }],
        functionName: '_c',
        args,
      });
      data = data + enc.slice(10); // drop the 4-byte selector, keep the encoded args
    }
    const res = await this.evm.runCall({ caller: from, to: undefined, data: hexToBytes(data), gasLimit: 30_000_000n });
    if (res.execResult.exceptionError) throw new Error('deploy reverted: ' + res.execResult.exceptionError.error);
    return new Contract(this, name, res.createdAddress, art.abi);
  }
}

export class Contract {
  constructor(chain, name, address, abi) {
    this.chain = chain;
    this.name = name;
    this.address = address;
    this.abi = abi;
  }

  async _exec(fn, args, from) {
    const data = encodeFunctionData({ abi: this.abi, functionName: fn, args });
    const res = await this.chain.evm.runCall({
      caller: from ?? addr(1),
      to: this.address,
      data: hexToBytes(data),
      gasLimit: 30_000_000n,
    });
    return res.execResult;
  }

  /** Send a state-changing call. Throws on revert. Returns decoded return (if any). */
  async send(fn, args = [], { from } = {}) {
    const r = await this._exec(fn, args, from);
    if (r.exceptionError) throw new Error(`${fn} reverted: ${r.exceptionError.error}`);
    return this._decode(fn, r.returnValue);
  }

  /** Read a view function. */
  async call(fn, args = [], { from } = {}) {
    const r = await this._exec(fn, args, from);
    if (r.exceptionError) throw new Error(`${fn} reverted: ${r.exceptionError.error}`);
    return this._decode(fn, r.returnValue);
  }

  /** Assert a call reverts (optionally matching a message substring on the decoded data). */
  async expectRevert(fn, args = [], { from } = {}) {
    const r = await this._exec(fn, args, from);
    if (!r.exceptionError) throw new Error(`${fn} did not revert`);
    return true;
  }

  _decode(fn, returnValue) {
    const def = this.abi.find((x) => x.type === 'function' && x.name === fn);
    if (!def || !def.outputs || def.outputs.length === 0) return undefined;
    return decodeFunctionResult({ abi: this.abi, functionName: fn, data: bytesToHex(returnValue) });
  }
}

export { addr, parseAbi };
