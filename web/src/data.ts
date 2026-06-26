// Demo data + types for the TeleBlock web shell. Apache-2.0
import type { Status } from './components/ChatBubble';

export type Section = 'chats' | 'groups' | 'forums' | 'discover' | 'profile';

export interface Message {
  id: string;
  text: string;
  outgoing: boolean;
  time: string;
  status?: Status;
  encrypted?: boolean;
  reactions?: { emoji: string; count: number }[];
  replyTo?: { author: string; preview: string };
}

export interface Chat {
  id: string;
  name: string;
  kind: 'dm' | 'group';
  color: string;
  members?: number;
  online?: boolean;
  unread?: number;
  messages: Message[];
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const lastPreview = (c: Chat): string =>
  c.messages.length ? c.messages[c.messages.length - 1].text : 'No messages yet';

export const CHATS: Chat[] = [
  {
    id: 'dm-nadia',
    name: 'Nadia',
    kind: 'dm',
    color: '#e17076',
    online: true,
    messages: [
      { id: 'm1', text: 'hey! is this actually end-to-end encrypted?', outgoing: false, time: '14:01', encrypted: true },
      { id: 'm2', text: 'yep — your keys never leave your device 🔒', outgoing: true, time: '14:02', status: 'read', encrypted: true, reactions: [{ emoji: '🔥', count: 2 }] },
      { id: 'm3', text: 'and no phone number?? love it', outgoing: false, time: '14:03', encrypted: true },
    ],
  },
  {
    id: 'grp-builders',
    name: 'TeleBlock Builders',
    kind: 'group',
    color: '#7bc862',
    members: 1248,
    unread: 3,
    messages: [
      { id: 'g1', text: 'MLS rekeying PR is up for review', outgoing: false, time: '13:40', encrypted: true },
      { id: 'g2', text: 'nice — O(log n) on a 5k group is wild', outgoing: true, time: '13:41', status: 'read', encrypted: true, replyTo: { author: 'dev.eth', preview: 'MLS rekeying PR is up...' } },
    ],
  },
  {
    id: 'grp-dao',
    name: 'Forum Governance DAO',
    kind: 'group',
    color: '#a695e7',
    members: 312,
    messages: [
      { id: 'd1', text: 'Proposal #14: pin the onboarding thread', outgoing: false, time: '12:10', encrypted: true },
    ],
  },
];
