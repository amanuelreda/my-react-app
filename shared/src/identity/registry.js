// TeleBlock IdentityRegistry call encoding. Apache-2.0
//
// Encodes calldata for the on-chain IdentityRegistry so a client can publish its identity after
// login: register() anchors the Ed25519 signing key + the IPFS CID of the X25519 pre-key bundle;
// rotateKeys() updates them; claimUsername() reserves a name hash. The signing-key bytes and CIDs
// are public; no plaintext or PII is sent on-chain. Encoding lives here (with viem) so it is shared
// across web/mobile and unit-tested independently of any wallet.
import { encodeFunctionData, parseAbi, keccak256, toBytes } from 'viem';

// Minimal ABI matching contracts/src/IdentityRegistry.sol.
export const IDENTITY_REGISTRY_ABI = parseAbi([
  'function register(bytes signingPubKey, string preKeyBundleCID, string profileCID)',
  'function rotateKeys(bytes newSigningPubKey, string newPreKeyBundleCID)',
  'function setProfile(string profileCID)',
  'function claimUsername(bytes32 nameHash)',
]);

/**
 * Encode an IdentityRegistry.register() call.
 * @param {{signingPubKeyHex:`0x${string}`, preKeyBundleCID:string, profileCID:string}} payload
 *        (as produced by buildRegistrationPayload)
 * @returns {`0x${string}`} calldata
 */
export function encodeRegisterCall(payload) {
  return encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [payload.signingPubKeyHex, payload.preKeyBundleCID, payload.profileCID ?? ''],
  });
}

/** Encode rotateKeys(newSigningPubKey, newPreKeyBundleCID). */
export function encodeRotateKeysCall(signingPubKeyHex, newPreKeyBundleCID) {
  return encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'rotateKeys',
    args: [signingPubKeyHex, newPreKeyBundleCID],
  });
}

/** Encode claimUsername(keccak256(name)). The human-readable name lives off-chain. */
export function encodeClaimUsernameCall(username) {
  const nameHash = keccak256(toBytes(username.toLowerCase()));
  return encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'claimUsername',
    args: [nameHash],
  });
}
