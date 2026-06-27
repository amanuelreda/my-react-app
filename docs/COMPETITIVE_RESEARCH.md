# Competitive research → TeleBlock synthesis

A scan of leading decentralized messengers and what TeleBlock takes from each. Standout feature per
app, mapped to its TeleBlock implementation.

| App | Standout feature | In TeleBlock |
|---|---|---|
| **Status** | Wallet identity, **ENS-style usernames**, Web3/WalletConnect | Username claim in Profile (`IdentityRegistry.claimUsername`); wallet (SIWE) login |
| **Session** | No phone/email, random **Session ID**, onion-routed **metadata minimization** | No phone/email; **Session ID** (`sessionId()`) you can paste to **add a contact** (Contacts → Add by Session ID / address / ENS) + a "metadata-min" toggle that hides the wallet address; hashed Waku/relay topics + sealed-sender in the threat model |
| **EXTRA SAFE Chat** | Local keygen + **verifiable identity** (safety numbers) | Keys derived on-device; **safety-number verification** in the contact profile (`shared/safety.js`) |
| **Mixin Messenger** | **In-chat crypto transfers**, multi-chain wallet | **Send crypto in chat** — settles **on-chain** when a wallet is connected and the recipient has a real address (native ETH value transfer or ERC-20 `transfer`), with the tx hash linked from the bubble; network switcher; on-chain registration |
| **ChatLink** | Messages stored **immutably on-chain** (tamper-proof) | **"Save on-chain (proof)"** — `proofHash` + Merkle anchoring (`appendCommitment`) |
| **Wispr** | **VOBP**: ephemeral per-session keys; censorship-resistant voice/calls | **Per-call VOBP ephemeral key** shown in the call screen (destroyed on end); per-message ratchet keys (forward secrecy); voice messages + calls; Waku transport |

## What we implemented from this pass

- **In-chat payments (Mixin):** a 💸 composer action sends an asset/amount/memo as a payment bubble
  (`shared` payment payload type; `web` Composer + ChatBubble). When a wallet is connected and the
  recipient has a real address, it submits a real transfer (`web/src/engine/payments.ts`: native ETH
  value transfer or ERC-20 `transfer(to, amount)`) and links the tx hash on the bubble; otherwise it
  stays a local demo bubble.
- **Safety-number verification (EXTRA SAFE / Signal):** `safetyNumber(pubA, pubB)` derives an
  order-independent 60-digit code from both signing keys; the contact profile shows it and lets you
  mark the contact verified — detecting MITM key substitution.
- **On-chain tamper-proof proof (ChatLink):** the message context menu "Save on-chain (proof)"
  computes a domain-separated `proofHash` and anchors it (ties into the existing Merkle anchoring).
- **Usernames (Status):** claim a handle in Profile (encoded for `IdentityRegistry.claimUsername`).
- **Session ID + metadata-min (Session):** `sessionId()` derives a stable "05…" address-free ID; a
  Privacy toggle hides the wallet address in favor of it, and Contacts can **add someone by pasting
  their Session ID** (or 0x address / `name.eth`) — reachability without a phone number.
- **VOBP per-call key (Wispr):** the call screen shows a fresh ephemeral session key, zeroized when
  the call ends.

All six are covered by tests (`shared/test/synthesis.test.js`, `web/e2e/synthesis.spec.ts`).

## Where TeleBlock already led

TeleBlock already had several properties these apps are known for: end-to-end encryption everywhere
(1:1 **and** groups/forums), forward secrecy (Double Ratchet / MLS-style sender keys), decentralized
transport (Waku-compatible), IPFS media, on-chain governance for groups/forums, reputation-gated
visibility, and Merkle "proof of conversation" anchoring — so this pass focused on the gaps.

## Sources

- Session — getsession.org, helpnetsecurity.com product showcase, Nym blog.
- Mixin — messenger.mixin.one, support.mixin.one, CoinCodex review.
- Status — status.app help, status.im/features, Decrypt.
- Wispr — entrepreneur.com, ueex.com VOBP glossary, cryptodata.com.
- ChatLink — github.com/kunaldhongade/ChatLink.
