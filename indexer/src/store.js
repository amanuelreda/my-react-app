// TeleBlock off-chain indexer — derived-state store. Apache-2.0
//
// A pure event reducer that turns the on-chain event log into the read-optimized state the clients
// need (group rosters, forum threads ranked by score, reputation, identities, search). It is the
// fast read path: clients never scan the chain for lists. The same reducer backs both the live
// service (fed by ingest.js over an RPC provider) and the test suite (fed synthetic events), so the
// indexing logic is verified independently of any chain connection.
//
// Events are normalized to { name, args, blockNumber, logIndex } — exactly the shape ingest.js emits
// after ABI-decoding logs. Event names and arg fields mirror the Solidity events in ../contracts.

// GroupManager permission bits (mirror contracts/src/GroupManager.sol).
export const PERM = {
  POST: 1,
  MEDIA: 2,
  INVITE: 4,
  PIN: 8,
  DELETE_OTHERS: 16,
  BAN: 32,
  MANAGE_ADMINS: 64,
  CHANGE_INFO: 128,
  OWNER: 0xffff,
};

const VISIBILITY = ['public', 'private', 'tokenGated'];
const GOVERNANCE = ['owner', 'moderatorSet', 'dao'];
const POST_STATUS = ['active', 'hidden', 'locked', 'pinned'];

export class IndexStore {
  constructor() {
    /** @type {Map<string, object>} address -> identity */
    this.identities = new Map();
    /** @type {Map<string, string>} usernameHash -> address */
    this.usernames = new Map();
    /** @type {Map<string, object>} groupId -> group */
    this.groups = new Map();
    /** @type {Map<string, object>} forumId -> forum */
    this.forums = new Map();
    /** @type {Map<string, object>} postId -> post */
    this.posts = new Map();
    /** @type {Map<string, number>} address -> reputation */
    this.reputation = new Map();
    /** @type {Map<string, Set<string>>} address -> badgeIds */
    this.badges = new Map();
    /** monotonic cursor of the last applied event */
    this.cursor = { blockNumber: 0, logIndex: -1 };
  }

  /** Apply one normalized event. Idempotent w.r.t. ordering via the (block, logIndex) cursor. */
  apply(ev) {
    // Skip already-applied events (supports safe re-org replays / resumable ingestion).
    if (
      ev.blockNumber < this.cursor.blockNumber ||
      (ev.blockNumber === this.cursor.blockNumber && ev.logIndex <= this.cursor.logIndex)
    ) {
      return this;
    }
    const h = this[`_on${ev.name}`];
    if (h) h.call(this, ev.args, ev);
    this.cursor = { blockNumber: ev.blockNumber, logIndex: ev.logIndex };
    return this;
  }

  applyAll(events) {
    for (const ev of events) this.apply(ev);
    return this;
  }

  // ---------- IdentityRegistry ----------
  _onRegistered(a) {
    this.identities.set(a.user, {
      address: a.user,
      signingPubKey: a.signingPubKey,
      preKeyBundleCID: a.preKeyBundleCID,
      profileCID: null,
      username: null,
    });
  }
  _onKeysRotated(a) {
    const id = this.identities.get(a.user);
    if (id) {
      id.signingPubKey = a.newSigningPubKey;
      id.preKeyBundleCID = a.newPreKeyBundleCID;
    }
  }
  _onProfileUpdated(a) {
    const id = this.identities.get(a.user);
    if (id) id.profileCID = a.profileCID;
  }
  _onUsernameClaimed(a) {
    // release any previous holder of this hash
    const prev = this.usernames.get(a.nameHash);
    if (prev && prev !== a.user) {
      const pid = this.identities.get(prev);
      if (pid) pid.username = null;
    }
    this.usernames.set(a.nameHash, a.user);
    const id = this.identities.get(a.user);
    if (id) id.username = a.nameHash;
  }

  // ---------- GroupManager ----------
  _onGroupCreated(a) {
    this.groups.set(a.groupId, {
      id: a.groupId,
      owner: a.owner,
      visibility: VISIBILITY[a.visibility] ?? 'public',
      metadataCID: a.metadataCID,
      members: new Map([[a.owner, PERM.OWNER]]),
      banned: new Set(),
      memberCount: 1,
      lastCommitment: null,
      mlsGroupId: null,
    });
  }
  _onMemberJoined(a) {
    const g = this.groups.get(a.groupId);
    if (!g) return;
    if (!g.members.has(a.member)) g.memberCount += 1;
    g.members.set(a.member, Number(a.permMask));
  }
  _onMemberLeft(a) {
    const g = this.groups.get(a.groupId);
    if (g && g.members.delete(a.member)) g.memberCount -= 1;
  }
  _onRoleChanged(a) {
    const g = this.groups.get(a.groupId);
    if (!g) return;
    if (!g.members.has(a.member)) g.memberCount += 1;
    g.members.set(a.member, Number(a.permMask));
  }
  _onMemberBanned(a) {
    const g = this.groups.get(a.groupId);
    if (!g) return;
    if (g.members.delete(a.member)) g.memberCount -= 1;
    g.banned.add(a.member);
  }
  _onCommitmentAppended(a) {
    const g = this.groups.get(a.groupId);
    if (g) g.lastCommitment = a.merkleRoot;
  }
  _onMlsEpochRotated(a) {
    const g = this.groups.get(a.groupId);
    if (g) g.mlsGroupId = a.newMlsGroupId;
  }

  // ---------- ForumManager ----------
  _onForumCreated(a) {
    this.forums.set(a.forumId, {
      id: a.forumId,
      owner: a.owner,
      gov: GOVERNANCE[a.gov] ?? 'owner',
      visibility: VISIBILITY[a.visibility] ?? 'public',
      moderators: new Set(),
    });
  }
  _onModeratorSet(a) {
    const f = this.forums.get(a.forumId);
    if (!f) return;
    if (a.enabled) f.moderators.add(a.mod);
    else f.moderators.delete(a.mod);
  }
  _onPostCreated(a) {
    this.posts.set(a.postId, {
      id: a.postId,
      forumId: a.forumId,
      parentId: a.parentId,
      author: a.author,
      contentCID: a.contentCID,
      score: 0,
      status: 'active',
      votes: new Map(), // voter -> dir
    });
  }
  _onVoted(a) {
    const p = this.posts.get(a.postId);
    if (!p) return;
    const prev = p.votes.get(a.voter) ?? 0;
    const dir = Number(a.dir);
    const w = Number(a.weight);
    // Signed contribution delta, mirroring ForumManager.vote(): remove the old (prev*w), add the
    // new (dir*w), both at the event's weight.
    p.score += (dir - prev) * w;
    p.votes.set(a.voter, dir);
  }
  _onModerated(a) {
    const p = this.posts.get(a.postId);
    if (p) p.status = POST_STATUS[a.newStatus] ?? 'active';
  }
  _onCrossPosted() {
    /* PostCreated already recorded the post; CrossPosted is a provenance marker only. */
  }

  // ---------- Reputation ----------
  _onAwarded(a) {
    this.reputation.set(a.user, Number(a.newTotal));
  }
  _onBadgeMinted(a) {
    if (!this.badges.has(a.user)) this.badges.set(a.user, new Set());
    this.badges.get(a.user).add(String(a.badgeId));
  }

  // ---------- queries ----------
  listGroups() {
    return [...this.groups.values()].map((g) => ({
      id: g.id,
      owner: g.owner,
      visibility: g.visibility,
      memberCount: g.memberCount,
    }));
  }
  groupMembers(groupId) {
    const g = this.groups.get(groupId);
    if (!g) return [];
    return [...g.members.entries()].map(([address, perms]) => ({
      address,
      perms,
      isOwner: perms === PERM.OWNER,
      isAdmin: (perms & PERM.MANAGE_ADMINS) !== 0,
    }));
  }
  isBanned(groupId, address) {
    return this.groups.get(groupId)?.banned.has(address) ?? false;
  }
  /** Top-level threads in a forum, ranked by score (hot) then recency. */
  forumThreads(forumId, { sort = 'top' } = {}) {
    const threads = [...this.posts.values()].filter(
      (p) => p.forumId === forumId && p.parentId === '0' && p.status !== 'hidden',
    );
    if (sort === 'top') threads.sort((a, b) => b.score - a.score || cmp(b.id, a.id));
    else threads.sort((a, b) => cmp(b.id, a.id)); // 'new'
    // pinned first
    threads.sort((a, b) => (b.status === 'pinned' ? 1 : 0) - (a.status === 'pinned' ? 1 : 0));
    return threads.map((p) => ({ id: p.id, author: p.author, score: p.score, status: p.status }));
  }
  replies(postId) {
    return [...this.posts.values()]
      .filter((p) => p.parentId === postId)
      .map((p) => ({ id: p.id, author: p.author, score: p.score }));
  }
  reputationOf(address) {
    return this.reputation.get(address) ?? 0;
  }
  badgesOf(address) {
    return [...(this.badges.get(address) ?? [])];
  }
  identityOf(address) {
    return this.identities.get(address) ?? null;
  }
}

function cmp(a, b) {
  // numeric-aware compare for id strings
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}
