// TeleBlock shared — public surface. Apache-2.0
export {
  getSodium,
  sealMessage,
  openMessage,
  deriveIdentityKey,
} from './crypto/message.js';
export { ratchetStep, SymmetricChain } from './crypto/ratchet.js';
