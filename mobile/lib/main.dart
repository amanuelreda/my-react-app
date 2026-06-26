// TeleBlock mobile (Flutter) — app shell scaffold. Apache-2.0
//
// Dark-mode-first Telegram-style shell with bottom tabs (Chats · Groups · Forums · Discover ·
// Profile). This is a scaffold: the chat list here is static. Production wires the same protocol the
// web client uses (see ../shared semantics): X3DH → Double Ratchet (1:1) / MLS (groups), AEAD frames
// over Waku, media on IPFS, identity via SIWE/wallet. Crypto uses the `cryptography` package
// (X25519/Ed25519/AEAD) mirroring shared/src/crypto.
import 'package:flutter/material.dart';
import 'widgets/chat_bubble.dart';

void main() => runApp(const TeleBlockApp());

class TeleBlockApp extends StatelessWidget {
  const TeleBlockApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TeleBlock',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF0E1621),
        colorScheme: const ColorScheme.dark(primary: Color(0xFF3390EC)),
      ),
      home: const HomeShell(),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF17212B),
        title: const Text('TeleBlock'),
        actions: const [Padding(padding: EdgeInsets.all(16), child: Text('🔒', style: TextStyle(fontSize: 14)))],
      ),
      body: const _ConversationDemo(),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: const Color(0xFF17212B),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Chats'),
          NavigationDestination(icon: Icon(Icons.group_outlined), label: 'Groups'),
          NavigationDestination(icon: Icon(Icons.forum_outlined), label: 'Forums'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), label: 'Discover'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}

class _ConversationDemo extends StatelessWidget {
  const _ConversationDemo();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 12),
      children: const [
        ChatBubble(text: 'hey! is this actually end-to-end encrypted?', time: '14:01', outgoing: false),
        ChatBubble(text: 'yep — your keys never leave your device', time: '14:02', outgoing: true, status: 'read'),
        ChatBubble(text: 'this one self-destructs', time: '14:03', outgoing: true, status: 'read', ttl: 5),
      ],
    );
  }
}
