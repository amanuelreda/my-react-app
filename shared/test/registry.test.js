// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, keccak256, toBytes } from 'viem';
import {
  IDENTITY_REGISTRY_ABI,
  encodeRegisterCall,
  encodeRotateKeysCall,
  encodeClaimUsernameCall,
} from '../src/identity/registry.js';
import { buildRegistrationPayload, provisionIdentity } from '../src/identity/siwe.js';

const enc = (s) => new TextEncoder().encode(s);

test('encodeRegisterCall round-trips through the ABI', async () => {
  const { signing } = await provisionIdentity({ identitySignature: enc('seed') });
  const payload = buildRegistrationPayload({
    signingPubKey: signing.publicKey,
    preKeyBundleCID: 'bafkprekey',
    profileCID: 'bafkprofile',
  });
  const data = encodeRegisterCall(payload);
  assert.match(data, /^0x[0-9a-f]+$/);

  const decoded = decodeFunctionData({ abi: IDENTITY_REGISTRY_ABI, data });
  assert.equal(decoded.functionName, 'register');
  assert.equal(decoded.args[0], payload.signingPubKeyHex);
  assert.equal(decoded.args[1], 'bafkprekey');
  assert.equal(decoded.args[2], 'bafkprofile');
});

test('encodeRotateKeysCall encodes the new key + CID', () => {
  const data = encodeRotateKeysCall('0x'.padEnd(66, 'a'), 'bafknew');
  const decoded = decodeFunctionData({ abi: IDENTITY_REGISTRY_ABI, data });
  assert.equal(decoded.functionName, 'rotateKeys');
  assert.equal(decoded.args[1], 'bafknew');
});

test('encodeClaimUsernameCall hashes the lowercased name', () => {
  const data = encodeClaimUsernameCall('Satoshi');
  const decoded = decodeFunctionData({ abi: IDENTITY_REGISTRY_ABI, data });
  assert.equal(decoded.functionName, 'claimUsername');
  assert.equal(decoded.args[0], keccak256(toBytes('satoshi')));
});
