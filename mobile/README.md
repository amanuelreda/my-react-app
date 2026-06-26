# @teleblock/mobile (Flutter)

Telegram-style native client for iOS & Android. **Scaffold** — the app shell, theme, and the
Telegram-styled `ChatBubble` are in place; protocol wiring follows the web client's verified
semantics (see [`../shared`](../shared)).

> Status: scaffold. Unlike `shared`/`indexer`/`web` (which have passing test suites in this repo),
> the Flutter app is a starting point — it needs the Flutter SDK to build and the protocol layer
> ported from `@teleblock/shared`.

## Run

```bash
flutter pub get
flutter run        # device/emulator
flutter test
```

## Protocol parity with the web client

The same architecture the web client proves out applies here:

| Concern | Web (`@teleblock/shared`) | Flutter equivalent |
|---|---|---|
| 1:1 E2EE | X3DH → Double Ratchet, XChaCha20-Poly1305, Ed25519 | `cryptography` (X25519/Ed25519/AEAD) |
| Group E2EE | Sender Keys (`GroupSession`) → MLS (Phase 2) | port `group/groupSession` logic |
| Identity | SIWE + deterministic key derivation | `web3dart` + `walletconnect_flutter_v2` |
| Transport | Waku / relay | `web_socket_channel` to a relay/Waku node |
| Storage | IPFS (encrypted blobs + CID) | `http` to an IPFS gateway |
| Anchoring | Merkle commitments (`anchor.js`) | port `anchor` (BLAKE2b Merkle) |
| Keys at rest | Secure Enclave / Keychain | `flutter_secure_storage` |

## Layout

- `lib/main.dart` — dark-mode app shell with bottom tabs (Chats · Groups · Forums · Discover · Profile).
- `lib/widgets/chat_bubble.dart` — Telegram-styled bubble (read ticks, lock, self-destruct, swipe-to-reply).
