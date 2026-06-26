// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IGate} from "./interfaces/IGate.sol";

/// @title GroupManager
/// @notice Smart-contract-managed membership, roles, and permissions for TeleBlock groups.
///         Message *content* never touches this contract — only membership, role bitmasks,
///         moderation events, and batched message commitments (Merkle roots) for tamper-evidence.
/// @dev    Off-chain, an MLS group mirrors membership: joins/bans here trigger an MLS epoch
///         rotation client-side so removed members lose forward access (post-compromise security).
contract GroupManager {
    // ----- Permission bits -----
    uint16 internal constant POST = 1;
    uint16 internal constant MEDIA = 2;
    uint16 internal constant INVITE = 4;
    uint16 internal constant PIN = 8;
    uint16 internal constant DELETE_OTHERS = 16;
    uint16 internal constant BAN = 32;
    uint16 internal constant MANAGE_ADMINS = 64;
    uint16 internal constant CHANGE_INFO = 128;
    uint16 internal constant OWNER = 0xFFFF;
    // default permission set granted to a plain member on join
    uint16 internal constant MEMBER_DEFAULT = POST | MEDIA | INVITE;

    enum Visibility { Public, Private, TokenGated }

    struct Group {
        address owner;
        bytes32 metadataCID;   // name/avatar/description (encrypted for private groups)
        Visibility visibility;
        IGate gate;            // address(0) if no gate
        uint32 memberCount;
        bool slowMode;
        uint32 slowModeSecs;
        bytes32 mlsGroupId;    // binds this group to its off-chain MLS ciphersuite group
        uint256 batchSeq;      // monotonically increasing commitment counter
    }

    uint256 public nextGroupId = 1;
    mapping(uint256 => Group) public groups;
    mapping(uint256 => mapping(address => uint16)) public perms;     // groupId => member => permission bitmask
    mapping(uint256 => mapping(address => bool)) public banned;      // groupId => member => banned
    mapping(uint256 => bytes32) public lastCommitment;              // latest anchored Merkle root

    event GroupCreated(uint256 indexed groupId, address indexed owner, Visibility visibility, bytes32 metadataCID);
    event MemberJoined(uint256 indexed groupId, address indexed member, uint16 permMask);
    event MemberLeft(uint256 indexed groupId, address indexed member);
    event MemberBanned(uint256 indexed groupId, address indexed member, bytes32 reasonCID);
    event RoleChanged(uint256 indexed groupId, address indexed member, uint16 permMask);
    event SlowModeSet(uint256 indexed groupId, bool on, uint32 secs);
    event GateSet(uint256 indexed groupId, address gate);
    event MetadataUpdated(uint256 indexed groupId, bytes32 metadataCID);
    event CommitmentAppended(uint256 indexed groupId, bytes32 merkleRoot, uint256 batchSeq);
    event MlsEpochRotated(uint256 indexed groupId, bytes32 newMlsGroupId);

    error NotMember();
    error Forbidden();
    error AlreadyMember();
    error IsBanned();
    error GateRejected();
    error CannotTargetOwner();
    error NoSuchGroup();

    modifier onlyPermitted(uint256 groupId, uint16 bit) {
        if (perms[groupId][msg.sender] & bit == 0) revert Forbidden();
        _;
    }

    modifier exists(uint256 groupId) {
        if (groups[groupId].owner == address(0)) revert NoSuchGroup();
        _;
    }

    /// @notice Create a group; the caller becomes owner with full permissions.
    /// @param mlsGroupId Identifier of the off-chain MLS group set up client-side.
    function createGroup(bytes32 metadataCID, Visibility visibility, IGate gate, bytes32 mlsGroupId)
        external
        returns (uint256 groupId)
    {
        groupId = nextGroupId++;
        groups[groupId] = Group({
            owner: msg.sender,
            metadataCID: metadataCID,
            visibility: visibility,
            gate: gate,
            memberCount: 1,
            slowMode: false,
            slowModeSecs: 0,
            mlsGroupId: mlsGroupId,
            batchSeq: 0
        });
        perms[groupId][msg.sender] = OWNER;
        emit GroupCreated(groupId, msg.sender, visibility, metadataCID);
        emit MemberJoined(groupId, msg.sender, OWNER);
    }

    /// @notice Join a public or token-gated group. Private groups use requestJoin/approveJoin.
    /// @param proof Optional data forwarded to the gate adapter (e.g. allowlist Merkle proof).
    function join(uint256 groupId, bytes calldata proof) external exists(groupId) {
        Group storage g = groups[groupId];
        if (banned[groupId][msg.sender]) revert IsBanned();
        if (perms[groupId][msg.sender] != 0) revert AlreadyMember();
        if (g.visibility == Visibility.Private) revert Forbidden();
        if (address(g.gate) != address(0)) {
            if (!g.gate.check(groupId, msg.sender, proof)) revert GateRejected();
        }
        perms[groupId][msg.sender] = MEMBER_DEFAULT;
        g.memberCount += 1;
        emit MemberJoined(groupId, msg.sender, MEMBER_DEFAULT);
    }

    /// @notice Owner/admin adds a member directly (used for private groups / approved requests).
    function addMember(uint256 groupId, address member)
        external
        exists(groupId)
        onlyPermitted(groupId, MANAGE_ADMINS)
    {
        if (banned[groupId][member]) revert IsBanned();
        if (perms[groupId][member] != 0) revert AlreadyMember();
        perms[groupId][member] = MEMBER_DEFAULT;
        groups[groupId].memberCount += 1;
        emit MemberJoined(groupId, member, MEMBER_DEFAULT);
    }

    /// @notice Leave a group voluntarily. The owner must transfer ownership before leaving.
    function leave(uint256 groupId) external exists(groupId) {
        uint16 p = perms[groupId][msg.sender];
        if (p == 0) revert NotMember();
        if (p == OWNER) revert Forbidden();
        delete perms[groupId][msg.sender];
        groups[groupId].memberCount -= 1;
        emit MemberLeft(groupId, msg.sender);
    }

    /// @notice Set a member's permission bitmask. Requires MANAGE_ADMINS. Cannot target the owner.
    function setRole(uint256 groupId, address member, uint16 permMask)
        external
        exists(groupId)
        onlyPermitted(groupId, MANAGE_ADMINS)
    {
        if (member == groups[groupId].owner) revert CannotTargetOwner();
        if (permMask == OWNER) revert Forbidden(); // ownership transfer is explicit
        bool wasMember = perms[groupId][member] != 0;
        perms[groupId][member] = permMask;
        if (!wasMember && permMask != 0) groups[groupId].memberCount += 1;
        emit RoleChanged(groupId, member, permMask);
    }

    /// @notice Ban a member; requires BAN. Off-chain triggers an MLS epoch rotation.
    function ban(uint256 groupId, address member, bytes32 reasonCID)
        external
        exists(groupId)
        onlyPermitted(groupId, BAN)
    {
        if (member == groups[groupId].owner) revert CannotTargetOwner();
        if (perms[groupId][member] != 0) {
            delete perms[groupId][member];
            groups[groupId].memberCount -= 1;
        }
        banned[groupId][member] = true;
        emit MemberBanned(groupId, member, reasonCID);
    }

    /// @notice Lift a ban; the address may re-join afterwards.
    function unban(uint256 groupId, address member)
        external
        exists(groupId)
        onlyPermitted(groupId, BAN)
    {
        banned[groupId][member] = false;
    }

    /// @notice Transfer ownership to an existing or new member.
    function transferOwnership(uint256 groupId, address newOwner) external exists(groupId) {
        Group storage g = groups[groupId];
        if (msg.sender != g.owner) revert Forbidden();
        bool wasMember = perms[groupId][newOwner] != 0;
        perms[groupId][g.owner] = MANAGE_ADMINS | CHANGE_INFO | BAN | PIN | DELETE_OTHERS | POST | MEDIA | INVITE;
        perms[groupId][newOwner] = OWNER;
        if (!wasMember) g.memberCount += 1;
        g.owner = newOwner;
        emit RoleChanged(groupId, newOwner, OWNER);
    }

    function setSlowMode(uint256 groupId, bool on, uint32 secs)
        external
        exists(groupId)
        onlyPermitted(groupId, CHANGE_INFO)
    {
        Group storage g = groups[groupId];
        g.slowMode = on;
        g.slowModeSecs = secs;
        emit SlowModeSet(groupId, on, secs);
    }

    function setGate(uint256 groupId, IGate gate)
        external
        exists(groupId)
        onlyPermitted(groupId, CHANGE_INFO)
    {
        groups[groupId].gate = gate;
        emit GateSet(groupId, address(gate));
    }

    function setMetadata(uint256 groupId, bytes32 metadataCID)
        external
        exists(groupId)
        onlyPermitted(groupId, CHANGE_INFO)
    {
        groups[groupId].metadataCID = metadataCID;
        emit MetadataUpdated(groupId, metadataCID);
    }

    /// @notice Anchor a batch of message hashes (Merkle root) for tamper-evidence. Cheap & batched:
    ///         one root per N messages or T seconds, not per message.
    function appendCommitment(uint256 groupId, bytes32 merkleRoot)
        external
        exists(groupId)
        onlyPermitted(groupId, POST)
    {
        Group storage g = groups[groupId];
        g.batchSeq += 1;
        lastCommitment[groupId] = merkleRoot;
        emit CommitmentAppended(groupId, merkleRoot, g.batchSeq);
    }

    /// @notice Record a new MLS epoch id after a membership change.
    function rotateMlsEpoch(uint256 groupId, bytes32 newMlsGroupId)
        external
        exists(groupId)
        onlyPermitted(groupId, MANAGE_ADMINS)
    {
        groups[groupId].mlsGroupId = newMlsGroupId;
        emit MlsEpochRotated(groupId, newMlsGroupId);
    }

    // ----- views -----
    function isMember(uint256 groupId, address user) external view returns (bool) {
        return perms[groupId][user] != 0;
    }

    function hasPermission(uint256 groupId, address user, uint16 bit) external view returns (bool) {
        return perms[groupId][user] & bit != 0;
    }
}
