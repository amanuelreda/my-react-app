// Event ABIs for log ingestion. Apache-2.0
//
// Human-readable event signatures (parsed by viem) for the four TeleBlock contracts, matching the
// Solidity events in ../../contracts and the subgraph manifest. ingest.js uses these to decode logs
// into the normalized events the reducer (store.js) consumes.
import { parseAbi } from 'viem';

export function loadAbis() {
  return {
    IdentityRegistry: parseAbi([
      'event Registered(address indexed user, bytes signingPubKey, string preKeyBundleCID)',
      'event KeysRotated(address indexed user, bytes newSigningPubKey, string newPreKeyBundleCID)',
      'event ProfileUpdated(address indexed user, string profileCID)',
      'event UsernameClaimed(address indexed user, bytes32 indexed nameHash)',
    ]),
    GroupManager: parseAbi([
      'event GroupCreated(uint256 indexed groupId, address indexed owner, uint8 visibility, bytes32 metadataCID)',
      'event MemberJoined(uint256 indexed groupId, address indexed member, uint16 permMask)',
      'event MemberLeft(uint256 indexed groupId, address indexed member)',
      'event MemberBanned(uint256 indexed groupId, address indexed member, bytes32 reasonCID)',
      'event RoleChanged(uint256 indexed groupId, address indexed member, uint16 permMask)',
      'event CommitmentAppended(uint256 indexed groupId, bytes32 merkleRoot, uint256 batchSeq)',
      'event MlsEpochRotated(uint256 indexed groupId, bytes32 newMlsGroupId)',
    ]),
    ForumManager: parseAbi([
      'event ForumCreated(uint256 indexed forumId, address indexed owner, uint8 gov, uint8 visibility)',
      'event ModeratorSet(uint256 indexed forumId, address indexed mod, bool enabled)',
      'event PostCreated(uint256 indexed postId, uint256 indexed forumId, uint256 indexed parentId, address author, bytes32 contentCID)',
      'event Voted(uint256 indexed postId, address indexed voter, int8 dir, uint256 weight)',
      'event Moderated(uint256 indexed postId, uint8 newStatus, bytes32 reasonCID)',
    ]),
    Reputation: parseAbi([
      'event Awarded(address indexed user, uint256 amount, bytes32 sourceRef, uint256 newTotal)',
      'event BadgeMinted(address indexed user, uint256 indexed badgeId)',
    ]),
  };
}
