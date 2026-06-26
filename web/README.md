# @teleblock/web

Telegram-style web client for TeleBlock — Vite + React + TypeScript. Dark-mode-first, 3-column
desktop layout (navigation rail · chat list · conversation), collapsing to a single column on mobile.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc --noEmit && vite build  -> dist/
npm run typecheck
npm run e2e        # Playwright browser test (uses pre-installed Chromium)
```

## What's implemented

- **Login gate** (`src/components/LoginScreen.tsx`): provisions a **real identity** — a burner
  embedded-wallet account signs the fixed identity challenge and derives E2EE keys via
  `provisionIdentity` (the same path a real wallet/SIWE login uses).
- **Live 1:1 E2EE** (`src/engine/secretChat.ts`): the first DM is a *real* end-to-end-encrypted
  conversation — X3DH key agreement, a symmetric ratchet, and AEAD frames over an in-memory relay,
  with a simulated peer that decrypts and replies. An **encryption inspector** shows the actual
  ciphertext frame on the wire (proving no plaintext leaves the device).
- **Groups / Forums / Discover wired to the indexer** (`src/engine/indexerData.ts`): these sections
  render **real state derived from the `@teleblock/indexer` reducer** running in-browser over seed
  events — on-chain group rosters with roles, reputation-weighted forum thread ranking with nested
  replies, and people ranked by reputation. Swapping the seed for a live indexer `fetch()` / subgraph
  query doesn't change the view code.
- **Telegram-fidelity UI shell:** left rail (Chats · Groups · Forums · Discover · Profile), searchable
  chat list with avatars/unread badges, conversation pane, composer with Enter-to-send.
- **`ChatBubble`**: accent/gray bubbles, ✓/✓✓ read ticks, lock glyph, reactions, reply quotes,
  swipe-to-reply. Theme tokens in `src/theme.css` mirror Telegram's dark palette (`--tg-*`).

The remaining chats use local/optimistic state; they share the same component API and swap onto the
live engine the same way the first DM does.

## Verified in a real browser

`npm run e2e` builds the bundle, serves it, drives Chromium, and asserts: an identity is provisioned,
a message sends over the live conversation, the peer's **decrypted** reply appears, and the on-wire
frame contains `"ciphertext"` but **not** the plaintext. This exercises libsodium + the full crypto
core compiled for the browser.

## Browser bundling note

libsodium-wrappers ships a broken ESM entry, so `vite.config.ts` aliases the bare specifier to the
package's working CommonJS build (resolved from `../shared`). `@teleblock/shared` selects a
browser-safe libsodium loader at runtime (Node uses `createRequire`; the browser uses a dynamic
import). Production pin/relay nodes are configured in [`../infra`](../infra) (Phase 2).

## Production target

Per the spec, the production web target is **Next.js** (SSR for discovery/SEO pages) + **Tauri** for
a desktop binary. This Vite SPA is the fast-iteration MVP shell; the components port directly.
