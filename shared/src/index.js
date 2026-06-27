// TeleBlock shared — public surface. Apache-2.0
export {
  getSodium,
  sealMessage,
  openMessage,
  deriveIdentityKey,
} from './crypto/message.js';
export { ratchetStep, SymmetricChain } from './crypto/ratchet.js';
export {
  generateKeyMaterial,
  buildPreKeyBundle,
  verifyPreKeyBundle,
} from './identity/prekeys.js';
export { initiateSession, respondSession } from './identity/x3dh.js';
export {
  identityChallenge,
  buildLoginMessage,
  verifyLogin,
  provisionIdentity,
  buildRegistrationPayload,
} from './identity/siwe.js';
export {
  IDENTITY_REGISTRY_ABI,
  encodeRegisterCall,
  encodeRotateKeysCall,
  encodeClaimUsernameCall,
} from './identity/registry.js';
export {
  GROUP_MANAGER_ABI,
  FORUM_MANAGER_ABI,
  encodeCreateGroupCall,
  encodeJoinGroupCall,
  encodeBanCall,
  encodeCreateForumCall,
  encodeCreatePostCall,
  encodeVoteCall,
  encodeModerateCall,
} from './onchain/contracts.js';
export { deriveTopic, deriveConversationTopic, InMemoryRelay } from './transport/relay.js';
export { Conversation } from './transport/conversation.js';
export {
  cidOf,
  InMemoryStore,
  putEncrypted,
  getDecrypted,
} from './storage/store.js';
export { createGroupSession, GroupSession } from './group/groupSession.js';
export {
  frameHash,
  buildMerkleRoot,
  merkleProof,
  verifyMerkleProof,
  proofHash,
} from './anchor.js';
export { safetyNumber, sessionId } from './safety.js';
export {
  attachMedia,
  loadMedia,
  encodePayload,
  decodePayload,
  isExpired,
} from './media.js';
