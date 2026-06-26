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
export { deriveTopic, deriveConversationTopic, InMemoryRelay } from './transport/relay.js';
export { Conversation } from './transport/conversation.js';
export {
  cidOf,
  InMemoryStore,
  putEncrypted,
  getDecrypted,
} from './storage/store.js';
