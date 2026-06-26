// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData } from 'viem';
import {
  GROUP_MANAGER_ABI,
  FORUM_MANAGER_ABI,
  encodeCreateGroupCall,
  encodeJoinGroupCall,
  encodeBanCall,
  encodeCreateForumCall,
  encodeCreatePostCall,
  encodeVoteCall,
} from '../src/onchain/contracts.js';

const B32 = (n) => ('0x' + n.toString().padStart(64, '0'));
const ADDR = '0x' + '11'.repeat(20);

test('createGroup encodes visibility + gate + CIDs', () => {
  const data = encodeCreateGroupCall({ metadataCID: B32(1), visibility: 2, gate: ADDR, mlsGroupId: B32(2) });
  const d = decodeFunctionData({ abi: GROUP_MANAGER_ABI, data });
  assert.equal(d.functionName, 'createGroup');
  assert.equal(d.args[1], 2);
  assert.equal(String(d.args[2]).toLowerCase(), ADDR);
});

test('join encodes groupId + proof', () => {
  const d = decodeFunctionData({ abi: GROUP_MANAGER_ABI, data: encodeJoinGroupCall(7, '0xabcd') });
  assert.equal(d.functionName, 'join');
  assert.equal(d.args[0], 7n);
  assert.equal(d.args[1], '0xabcd');
});

test('ban encodes target + reason', () => {
  const d = decodeFunctionData({ abi: GROUP_MANAGER_ABI, data: encodeBanCall(1, ADDR, B32(9)) });
  assert.equal(d.functionName, 'ban');
  assert.equal(d.args[2], B32(9));
});

test('createForum encodes governance + visibility', () => {
  const d = decodeFunctionData({ abi: FORUM_MANAGER_ABI, data: encodeCreateForumCall({ metaCID: B32(1), gov: 2, governor: ADDR, visibility: 0 }) });
  assert.equal(d.functionName, 'createForum');
  assert.equal(d.args[1], 2); // DAO
});

test('createPost encodes forum/parent/CID/hash', () => {
  const d = decodeFunctionData({ abi: FORUM_MANAGER_ABI, data: encodeCreatePostCall(1, 0, B32(5), B32(6)) });
  assert.equal(d.functionName, 'createPost');
  assert.equal(d.args[0], 1n);
  assert.equal(d.args[1], 0n);
  assert.equal(d.args[2], B32(5));
});

test('vote encodes signed direction', () => {
  const up = decodeFunctionData({ abi: FORUM_MANAGER_ABI, data: encodeVoteCall(10, 1) });
  assert.equal(up.args[1], 1);
  const down = decodeFunctionData({ abi: FORUM_MANAGER_ABI, data: encodeVoteCall(10, -1) });
  assert.equal(down.args[1], -1);
});
