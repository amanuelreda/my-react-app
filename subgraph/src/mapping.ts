// TeleBlock subgraph mappings — Apache-2.0
//
// AssemblyScript handlers that translate contract events into subgraph entities. Types under
// ../generated are produced by `graph codegen` from schema.graphql + the ABIs (run before build);
// they are intentionally not committed. Only public on-chain data is indexed — never message content.
import { BigInt, Bytes, Address } from '@graphprotocol/graph-ts';
import {
  Registered,
  KeysRotated,
  ProfileUpdated,
  UsernameClaimed,
} from '../generated/IdentityRegistry/IdentityRegistry';
import {
  GroupCreated,
  MemberJoined,
  MemberLeft,
  MemberBanned,
  RoleChanged,
  CommitmentAppended,
  MlsEpochRotated,
} from '../generated/GroupManager/GroupManager';
import {
  ForumCreated,
  ModeratorSet,
  PostCreated,
  Voted,
  Moderated,
} from '../generated/ForumManager/ForumManager';
import { Awarded, BadgeMinted } from '../generated/Reputation/Reputation';
import {
  User,
  Group,
  GroupMember,
  Forum,
  Moderator,
  Post,
  Vote,
  Badge,
} from '../generated/schema';

// ---- helpers ----
function loadUser(addr: Address): User {
  let id = addr.toHexString();
  let u = User.load(id);
  if (u == null) {
    u = new User(id);
    u.reputation = BigInt.zero();
    u.save();
  }
  return u as User;
}

function memberId(groupId: BigInt, addr: Address): string {
  return groupId.toString() + '-' + addr.toHexString();
}

// ---- IdentityRegistry ----
export function handleRegistered(e: Registered): void {
  let u = loadUser(e.params.user);
  u.signingPubKey = e.params.signingPubKey;
  u.preKeyBundleCID = e.params.preKeyBundleCID;
  u.save();
}

export function handleKeysRotated(e: KeysRotated): void {
  let u = loadUser(e.params.user);
  u.signingPubKey = e.params.newSigningPubKey;
  u.preKeyBundleCID = e.params.newPreKeyBundleCID;
  u.save();
}

export function handleProfileUpdated(e: ProfileUpdated): void {
  let u = loadUser(e.params.user);
  u.profileCID = e.params.profileCID;
  u.save();
}

export function handleUsernameClaimed(e: UsernameClaimed): void {
  let u = loadUser(e.params.user);
  u.username = e.params.nameHash;
  u.save();
}

// ---- GroupManager ----
export function handleGroupCreated(e: GroupCreated): void {
  let owner = loadUser(e.params.owner);
  let g = new Group(e.params.groupId.toString());
  g.owner = owner.id;
  g.visibility = e.params.visibility;
  g.metadataCID = e.params.metadataCID;
  g.memberCount = 1;
  g.createdAt = e.block.timestamp;
  g.save();

  let m = new GroupMember(memberId(e.params.groupId, e.params.owner));
  m.group = g.id;
  m.user = owner.id;
  m.permMask = 0xffff;
  m.banned = false;
  m.joinedAt = e.block.timestamp;
  m.save();
}

export function handleMemberJoined(e: MemberJoined): void {
  let g = Group.load(e.params.groupId.toString());
  if (g == null) return;
  let user = loadUser(e.params.member);
  let mid = memberId(e.params.groupId, e.params.member);
  let m = GroupMember.load(mid);
  if (m == null) {
    m = new GroupMember(mid);
    m.group = g.id;
    m.user = user.id;
    m.banned = false;
    m.joinedAt = e.block.timestamp;
    g.memberCount = g.memberCount + 1;
    g.save();
  }
  m.permMask = e.params.permMask;
  m.save();
}

export function handleRoleChanged(e: RoleChanged): void {
  let user = loadUser(e.params.member);
  let mid = memberId(e.params.groupId, e.params.member);
  let m = GroupMember.load(mid);
  if (m == null) {
    let g = Group.load(e.params.groupId.toString());
    if (g != null) {
      g.memberCount = g.memberCount + 1;
      g.save();
    }
    m = new GroupMember(mid);
    m.group = e.params.groupId.toString();
    m.user = user.id;
    m.banned = false;
    m.joinedAt = e.block.timestamp;
  }
  m.permMask = e.params.permMask;
  m.save();
}

export function handleMemberLeft(e: MemberLeft): void {
  removeMember(e.params.groupId, e.params.member, false);
}

export function handleMemberBanned(e: MemberBanned): void {
  removeMember(e.params.groupId, e.params.member, true);
}

function removeMember(groupId: BigInt, addr: Address, banned: boolean): void {
  let mid = memberId(groupId, addr);
  let m = GroupMember.load(mid);
  if (m == null) return;
  let g = Group.load(groupId.toString());
  if (g != null) {
    g.memberCount = g.memberCount - 1;
    g.save();
  }
  m.banned = banned;
  m.permMask = 0;
  m.save();
}

export function handleCommitmentAppended(e: CommitmentAppended): void {
  let g = Group.load(e.params.groupId.toString());
  if (g == null) return;
  g.lastCommitment = e.params.merkleRoot;
  g.save();
}

export function handleMlsEpochRotated(e: MlsEpochRotated): void {
  let g = Group.load(e.params.groupId.toString());
  if (g == null) return;
  g.mlsGroupId = e.params.newMlsGroupId;
  g.save();
}

// ---- ForumManager ----
export function handleForumCreated(e: ForumCreated): void {
  let owner = loadUser(e.params.owner);
  let f = new Forum(e.params.forumId.toString());
  f.owner = owner.id;
  f.governance = e.params.gov;
  f.visibility = e.params.visibility;
  f.createdAt = e.block.timestamp;
  f.save();
}

export function handleModeratorSet(e: ModeratorSet): void {
  let user = loadUser(e.params.mod);
  let id = e.params.forumId.toString() + '-' + e.params.mod.toHexString();
  let mod = Moderator.load(id);
  if (mod == null) {
    mod = new Moderator(id);
    mod.forum = e.params.forumId.toString();
    mod.user = user.id;
  }
  mod.enabled = e.params.enabled;
  mod.save();
}

export function handlePostCreated(e: PostCreated): void {
  let author = loadUser(e.params.author);
  let p = new Post(e.params.postId.toString());
  p.forum = e.params.forumId.toString();
  if (e.params.parentId.gt(BigInt.zero())) p.parent = e.params.parentId.toString();
  p.author = author.id;
  p.contentCID = e.params.contentCID;
  p.contentHash = Bytes.empty();
  p.score = BigInt.zero();
  p.status = 0;
  p.createdAt = e.block.timestamp;
  p.save();
}

export function handleVoted(e: Voted): void {
  let p = Post.load(e.params.postId.toString());
  if (p == null) return;
  let voter = loadUser(e.params.voter);
  let id = e.params.postId.toString() + '-' + e.params.voter.toHexString();
  let v = Vote.load(id);
  let prev = 0;
  if (v == null) {
    v = new Vote(id);
    v.post = p.id;
    v.voter = voter.id;
  } else {
    prev = v.direction;
  }
  // Signed delta at the event's weight, mirroring ForumManager.vote().
  let delta = BigInt.fromI32(e.params.dir - prev).times(e.params.weight);
  p.score = p.score.plus(delta);
  p.save();
  v.direction = e.params.dir;
  v.weight = e.params.weight;
  v.save();
}

export function handleModerated(e: Moderated): void {
  let p = Post.load(e.params.postId.toString());
  if (p == null) return;
  p.status = e.params.newStatus;
  p.save();
}

// ---- Reputation ----
export function handleAwarded(e: Awarded): void {
  let u = loadUser(e.params.user);
  u.reputation = e.params.newTotal;
  u.save();
}

export function handleBadgeMinted(e: BadgeMinted): void {
  let u = loadUser(e.params.user);
  let id = e.params.user.toHexString() + '-' + e.params.badgeId.toString();
  let b = new Badge(id);
  b.user = u.id;
  b.badgeId = e.params.badgeId;
  b.mintedAt = e.block.timestamp;
  b.save();
}
