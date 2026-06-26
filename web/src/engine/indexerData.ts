// Client read-model backed by the real indexer reducer. Apache-2.0
//
// Runs @teleblock/indexer's IndexStore IN THE BROWSER over a set of seed events (the same shape
// ingest.js emits after decoding on-chain logs). The Groups / Forums / Discover views read their
// lists and rankings from this store — i.e. exactly the derived state a deployed subgraph/indexer
// would serve. Swapping the seed for a live `fetch()` to the indexer API (or a subgraph query) is a
// one-line change; the view code does not change.
import { IndexStore, PERM } from '@teleblock/indexer';
import { buildSearchIndex } from '@teleblock/indexer/src/search.js';

export { PERM };

let seq = 0;
const ev = (name: string, args: Record<string, unknown>, blockNumber = 1) => ({
  name,
  args,
  blockNumber,
  logIndex: seq++,
});

/** Build an IndexStore seeded with demo on-chain activity. */
export function buildReadModel() {
  seq = 0;
  const s = new IndexStore();
  s.applyAll([
    // identities
    ev('Registered', { user: '0xalice', signingPubKey: '0x01', preKeyBundleCID: 'bafkalice' }),
    ev('Registered', { user: '0xbob', signingPubKey: '0x02', preKeyBundleCID: 'bafkbob' }),
    ev('Registered', { user: '0xcarol', signingPubKey: '0x03', preKeyBundleCID: 'bafkcarol' }),
    ev('UsernameClaimed', { user: '0xalice', nameHash: '0xnamealice' }),

    // groups
    ev('GroupCreated', { groupId: '1', owner: '0xalice', visibility: 0, metadataCID: 'gmeta1' }),
    ev('MemberJoined', { groupId: '1', member: '0xbob', permMask: PERM.POST | PERM.MEDIA }),
    ev('MemberJoined', { groupId: '1', member: '0xcarol', permMask: PERM.POST }),
    ev('RoleChanged', { groupId: '1', member: '0xbob', permMask: PERM.MANAGE_ADMINS | PERM.BAN | PERM.POST }),
    ev('GroupCreated', { groupId: '2', owner: '0xbob', visibility: 2, metadataCID: 'gmeta2' }),
    ev('MemberJoined', { groupId: '2', member: '0xalice', permMask: PERM.POST | PERM.MEDIA }),

    // forum + threads
    ev('ForumCreated', { forumId: '1', owner: '0xalice', gov: 2, visibility: 0 }), // DAO-governed
    ev('PostCreated', { postId: '10', forumId: '1', parentId: '0', author: '0xalice', contentCID: 'bafkpost10' }),
    ev('PostCreated', { postId: '11', forumId: '1', parentId: '0', author: '0xbob', contentCID: 'bafkpost11' }),
    ev('PostCreated', { postId: '12', forumId: '1', parentId: '10', author: '0xcarol', contentCID: 'bafkpost12' }),
    ev('PostCreated', { postId: '13', forumId: '1', parentId: '10', author: '0xbob', contentCID: 'bafkpost13' }),
    // weighted votes: post 11 surfaces above post 10
    ev('Voted', { postId: '11', voter: '0xcarol', dir: 1, weight: 7 }),
    ev('Voted', { postId: '11', voter: '0xalice', dir: 1, weight: 4 }),
    ev('Voted', { postId: '10', voter: '0xbob', dir: 1, weight: 3 }),
    ev('Voted', { postId: '12', voter: '0xalice', dir: 1, weight: 4 }),

    // reputation + badges
    ev('Awarded', { user: '0xbob', amount: 110, sourceRef: '0x', newTotal: 110 }),
    ev('Awarded', { user: '0xalice', amount: 40, sourceRef: '0x', newTotal: 40 }),
    ev('BadgeMinted', { user: '0xbob', badgeId: 1 }),
  ]);
  return s;
}

// Display metadata the chain stores only as CIDs (resolved off-chain from IPFS in production).
export const GROUP_META: Record<string, { name: string; color: string }> = {
  '1': { name: 'TeleBlock Builders', color: '#7bc862' },
  '2': { name: 'Token-gated Alpha', color: '#a695e7' },
};
export const FORUM_META: Record<string, { name: string; color: string }> = {
  '1': { name: 'Protocol & Governance', color: '#5eb5f7' },
};
export const POST_META: Record<string, { title: string; preview: string }> = {
  '10': { title: 'MLS vs Sender Keys for large groups', preview: 'Trade-offs of O(log n) rekeying…' },
  '11': { title: 'Proposal: reputation-gated forum visibility', preview: 'Low-rep posts start collapsed…' },
  '12': { title: 're: MLS vs Sender Keys', preview: 'PCS matters most when admins rotate…' },
  '13': { title: 're: MLS vs Sender Keys', preview: 'Agreed — TreeKEM it is.' },
};
export const USER_NAME: Record<string, string> = {
  '0xalice': 'alice.eth',
  '0xbob': 'bob.eth',
  '0xcarol': 'carol.eth',
};

// Display metadata for posts created at runtime (e.g. chat→forum cross-posts), shared across views.
export const DYNAMIC_POST_META: Record<string, { title: string; preview: string }> = {};

// On-chain achievement badges (soulbound). badgeId → display.
export const BADGE_META: Record<string, { icon: string; name: string }> = {
  '1': { icon: '🏅', name: 'Top Contributor' },
  '2': { icon: '🛡️', name: 'Trusted Moderator' },
  '3': { icon: '🚀', name: 'Early Builder' },
};

export const govLabel = (g: string) => ({ owner: '👤 owner', moderatorSet: '🛡️ mods', dao: '🏛️ DAO' }[g] ?? g);
export const visLabel = (v: string) =>
  ({ public: 'public', private: 'private', tokenGated: '🔑 token-gated' }[v] ?? v);

/** Build the full-text search index over public groups/forums/posts/users using the display metadata. */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function buildSearch(store: any) {
  return buildSearchIndex(store, {
    groups: GROUP_META,
    forums: FORUM_META,
    posts: POST_META,
    users: USER_NAME,
  });
}
