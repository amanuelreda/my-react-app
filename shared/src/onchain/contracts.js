// TeleBlock GroupManager / ForumManager call encoding. Apache-2.0
//
// Encodes calldata for the group and forum contracts so clients can submit membership, posting, and
// voting actions. Content lives on IPFS/Arweave; only CIDs (packed as bytes32 digests), hashes,
// roles, and numeric state go on-chain. Encoding is shared across web/mobile and unit-tested
// independently of any wallet/chain.
import { encodeFunctionData, parseAbi } from 'viem';

export const GROUP_MANAGER_ABI = parseAbi([
  'function createGroup(bytes32 metadataCID, uint8 visibility, address gate, bytes32 mlsGroupId) returns (uint256)',
  'function join(uint256 groupId, bytes proof)',
  'function ban(uint256 groupId, address member, bytes32 reasonCID)',
  'function setRole(uint256 groupId, address member, uint16 permMask)',
  'function appendCommitment(uint256 groupId, bytes32 merkleRoot)',
]);

export const FORUM_MANAGER_ABI = parseAbi([
  'function createForum(bytes32 metaCID, uint8 gov, address governor, uint8 visibility) returns (uint256)',
  'function createPost(uint256 forumId, uint256 parentId, bytes32 contentCID, bytes32 contentHash) returns (uint256)',
  'function vote(uint256 postId, int8 dir)',
  'function moderate(uint256 postId, uint8 newStatus, bytes32 reasonCID)',
]);

// ---- GroupManager ----
export function encodeCreateGroupCall({ metadataCID, visibility, gate, mlsGroupId }) {
  return encodeFunctionData({
    abi: GROUP_MANAGER_ABI,
    functionName: 'createGroup',
    args: [metadataCID, visibility, gate ?? '0x0000000000000000000000000000000000000000', mlsGroupId],
  });
}

export function encodeJoinGroupCall(groupId, proof = '0x') {
  return encodeFunctionData({ abi: GROUP_MANAGER_ABI, functionName: 'join', args: [BigInt(groupId), proof] });
}

export function encodeBanCall(groupId, member, reasonCID) {
  return encodeFunctionData({ abi: GROUP_MANAGER_ABI, functionName: 'ban', args: [BigInt(groupId), member, reasonCID] });
}

// ---- ForumManager ----
export function encodeCreateForumCall({ metaCID, gov, governor, visibility }) {
  return encodeFunctionData({
    abi: FORUM_MANAGER_ABI,
    functionName: 'createForum',
    args: [metaCID, gov, governor ?? '0x0000000000000000000000000000000000000000', visibility],
  });
}

export function encodeCreatePostCall(forumId, parentId, contentCID, contentHash) {
  return encodeFunctionData({
    abi: FORUM_MANAGER_ABI,
    functionName: 'createPost',
    args: [BigInt(forumId), BigInt(parentId), contentCID, contentHash],
  });
}

export function encodeVoteCall(postId, dir) {
  return encodeFunctionData({ abi: FORUM_MANAGER_ABI, functionName: 'vote', args: [BigInt(postId), dir] });
}
