// TeleBlock ChatBubble — Telegram-styled (Flutter). Apache-2.0
import 'package:flutter/material.dart';

/// Telegram-style message bubble: accent (blue) right-aligned for sent, surface (gray) left for
/// received, with ✓/✓✓ read ticks, an optional E2EE lock and self-destruct flame, and swipe-to-reply.
class ChatBubble extends StatelessWidget {
  final String text;
  final String time;
  final bool outgoing;
  final String status; // 'sent' | 'delivered' | 'read'
  final bool encrypted;
  final int? ttl; // self-destruct seconds
  final VoidCallback? onReply;

  const ChatBubble({
    super.key,
    required this.text,
    required this.time,
    required this.outgoing,
    this.status = 'read',
    this.encrypted = true,
    this.ttl,
    this.onReply,
  });

  @override
  Widget build(BuildContext context) {
    final bg = outgoing ? const Color(0xFF2B5278) : const Color(0xFF182533);
    final read = status == 'read';
    return Align(
      alignment: outgoing ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onHorizontalDragEnd: (d) {
          if ((d.primaryVelocity ?? 0) > 250) onReply?.call();
        },
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .76),
          margin: const EdgeInsets.symmetric(vertical: 1, horizontal: 8),
          padding: const EdgeInsets.fromLTRB(10, 6, 8, 6),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(14),
              topRight: const Radius.circular(14),
              bottomLeft: Radius.circular(outgoing ? 14 : 4),
              bottomRight: Radius.circular(outgoing ? 4 : 14),
            ),
          ),
          child: Wrap(
            alignment: WrapAlignment.end,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: [
              Text(text, style: const TextStyle(color: Colors.white, fontSize: 16)),
              const SizedBox(width: 8),
              if (ttl != null)
                const Padding(
                  padding: EdgeInsets.only(right: 3),
                  child: Text('🔥', style: TextStyle(fontSize: 11)),
                ),
              if (encrypted)
                const Padding(
                  padding: EdgeInsets.only(right: 3),
                  child: Text('🔒', style: TextStyle(fontSize: 11)),
                ),
              Text(time, style: const TextStyle(color: Colors.white70, fontSize: 11)),
              if (outgoing)
                Padding(
                  padding: const EdgeInsets.only(left: 3),
                  child: Icon(
                    read ? Icons.done_all : Icons.done,
                    size: 14,
                    color: read ? const Color(0xFF34B7F1) : Colors.white70,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
