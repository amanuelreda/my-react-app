# @teleblock/web

Telegram-style web client for TeleBlock — Vite + React + TypeScript. Dark-mode-first, 3-column
desktop layout (navigation rail · chat list · conversation), collapsing to a single column on mobile.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc --noEmit && vite build  -> dist/
npm run typecheck
```

## What's implemented

- **Telegram-fidelity UI shell:** left rail (Chats · Groups · Forums · Discover · Profile), searchable
  chat list with avatars/unread badges, conversation pane, and a composer with Enter-to-send.
- **`ChatBubble`** (`src/components/ChatBubble.tsx`): right-aligned accent bubbles for sent / gray for
  received, ✓/✓✓ read ticks, lock glyph for E2EE, reactions, reply quotes, swipe-to-reply.
- **Optimistic send** with simulated delivery→read receipt transitions, matching Telegram's feel.
- Theme tokens in `src/theme.css` mirroring Telegram's dark palette (`--tg-*`).

## Integrating the protocol core

The shell uses local/optimistic state so it builds and runs standalone. To make it live, wire
[`@teleblock/shared`](../shared) behind the same component API:

```ts
import { InMemoryRelay, deriveConversationTopic, Conversation } from '@teleblock/shared';
// or createWakuTransport() in production
```

- **1:1 chats:** establish a session with X3DH (`initiateSession`/`respondSession`), seed a
  `Conversation` over a `Transport`, and render incoming `onMessage` frames as `ChatBubble`s.
- **Groups:** use `GroupSession` (Sender Keys) keyed off `GroupManager` membership events.
- **Login:** `buildLoginMessage` + `verifyLogin` (SIWE) and `provisionIdentity` for key setup.

> Browser note: `@teleblock/shared` loads libsodium via a browser-safe path (dynamic import), so it
> works under Vite without the Node-only `createRequire` shim. Pin/relay nodes are configured in
> [`../infra`](../infra) (Phase 2).

## Production target

Per the spec, the production web target is **Next.js** (SSR for discovery/SEO pages) + **Tauri** for
a desktop binary. This Vite SPA is the fast-iteration MVP shell; the components port directly.
