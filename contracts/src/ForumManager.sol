// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IReputation} from "./interfaces/IReputation.sol";

/// @title ForumManager
/// @notice Threaded forums with categories/topics, reputation-weighted voting, and pluggable
///         moderation (owner / moderator-set / DAO). Post *content* lives on IPFS/Arweave;
///         only the CID, a content hash (integrity), authorship, threading, and score live here.
contract ForumManager {
    enum Governance { Owner, ModeratorSet, Dao }
    enum Visibility { Public, GroupLinked, Private }
    enum PostStatus { Active, Hidden, Locked, Pinned }

    struct Forum {
        address owner;
        Governance gov;
        address governor;   // OZ Governor + Timelock when gov == Dao; else may be address(0)
        bytes32 metaCID;
        Visibility visibility;
        bool exists;
    }

    struct Post {
        uint256 forumId;
        uint256 parentId;   // 0 == top-level thread (original post)
        address author;
        bytes32 contentCID; // IPFS/Arweave content identifier (bytes32-packed CIDv1 digest)
        bytes32 contentHash;// keccak of canonical content, for integrity
        uint64 ts;
        int64 score;        // running weighted score (up - down)
        PostStatus status;
    }

    IReputation public reputation; // optional; if address(0), votes are unweighted (weight 1)
    uint256 public constant UPVOTE_REP_AWARD = 5; // reputation granted to author per net upvote tick

    uint256 public nextForumId = 1;
    uint256 public nextPostId = 1;
    mapping(uint256 => Forum) public forums;
    mapping(uint256 => Post) public posts;
    mapping(uint256 => mapping(address => int8)) public voteOf; // postId => voter => -1/0/+1
    mapping(uint256 => mapping(address => bool)) public isModerator; // forumId => addr => mod

    event ForumCreated(uint256 indexed forumId, address indexed owner, Governance gov, Visibility visibility);
    event ModeratorSet(uint256 indexed forumId, address indexed mod, bool enabled);
    event PostCreated(
        uint256 indexed postId, uint256 indexed forumId, uint256 indexed parentId, address author, bytes32 contentCID
    );
    event Voted(uint256 indexed postId, address indexed voter, int8 dir, uint256 weight);
    event Moderated(uint256 indexed postId, PostStatus newStatus, bytes32 reasonCID);
    event CrossPosted(uint256 indexed postId, uint256 indexed forumId, bytes32 sourceRef);

    error NoSuchForum();
    error NoSuchPost();
    error Forbidden();
    error ThreadLocked();
    error BadParent();
    error BadVote();

    constructor(IReputation _reputation) {
        reputation = _reputation;
    }

    // ----- creation -----

    function createForum(bytes32 metaCID, Governance gov, address governor, Visibility visibility)
        external
        returns (uint256 forumId)
    {
        forumId = nextForumId++;
        forums[forumId] = Forum({
            owner: msg.sender,
            gov: gov,
            governor: governor,
            metaCID: metaCID,
            visibility: visibility,
            exists: true
        });
        emit ForumCreated(forumId, msg.sender, gov, visibility);
    }

    function setModerator(uint256 forumId, address mod, bool enabled) external {
        Forum storage f = forums[forumId];
        if (!f.exists) revert NoSuchForum();
        _requireModAuthority(forumId, f);
        isModerator[forumId][mod] = enabled;
        emit ModeratorSet(forumId, mod, enabled);
    }

    /// @notice Create a post or reply. parentId == 0 starts a new thread; otherwise it nests
    ///         under an existing post in the same forum (Reddit/Discourse style).
    function createPost(uint256 forumId, uint256 parentId, bytes32 contentCID, bytes32 contentHash)
        external
        returns (uint256 postId)
    {
        return _createPost(msg.sender, forumId, parentId, contentCID, contentHash);
    }

    /// @notice Bring a chat excerpt into a forum as a new top-level thread, linking back to source.
    function crossPostFromChat(uint256 forumId, bytes32 contentCID, bytes32 contentHash, bytes32 sourceRef)
        external
        returns (uint256 postId)
    {
        postId = _createPost(msg.sender, forumId, 0, contentCID, contentHash);
        emit CrossPosted(postId, forumId, sourceRef);
    }

    function _createPost(
        address author,
        uint256 forumId,
        uint256 parentId,
        bytes32 contentCID,
        bytes32 contentHash
    ) internal returns (uint256 postId) {
        Forum storage f = forums[forumId];
        if (!f.exists) revert NoSuchForum();
        if (parentId != 0) {
            Post storage parent = posts[parentId];
            if (parent.author == address(0) || parent.forumId != forumId) revert BadParent();
            if (parent.status == PostStatus.Locked) revert ThreadLocked();
        }
        postId = nextPostId++;
        posts[postId] = Post({
            forumId: forumId,
            parentId: parentId,
            author: author,
            contentCID: contentCID,
            contentHash: contentHash,
            ts: uint64(block.timestamp),
            score: 0,
            status: PostStatus.Active
        });
        emit PostCreated(postId, forumId, parentId, author, contentCID);
    }

    // ----- voting -----

    /// @notice Up/down/clear vote on a post. Weight is reputation-derived (sybil-dampened) when a
    ///         Reputation contract is configured; otherwise 1. Changing a vote adjusts the delta.
    function vote(uint256 postId, int8 dir) external {
        if (dir < -1 || dir > 1) revert BadVote();
        Post storage p = posts[postId];
        if (p.author == address(0)) revert NoSuchPost();

        int8 prev = voteOf[postId][msg.sender];
        if (prev == dir) return; // no-op

        uint256 w = _weightOf(msg.sender);
        // remove previous contribution, add new one
        p.score -= int64(int256(uint256(_abs(prev)) * w));
        p.score += int64(int256(uint256(_abs(dir)) * w));
        voteOf[postId][msg.sender] = dir;

        // reward author reputation when a net upvote is added (not for downvotes / self-votes)
        if (dir == 1 && prev != 1 && msg.sender != p.author && address(reputation) != address(0)) {
            reputation.award(p.author, UPVOTE_REP_AWARD, bytes32(postId));
        }
        emit Voted(postId, msg.sender, dir, w);
    }

    // ----- moderation -----

    /// @notice Change a post's status (hide/lock/pin/active). In DAO mode this is execute-only via
    ///         the configured governor; otherwise the forum owner or a moderator may call it.
    function moderate(uint256 postId, PostStatus newStatus, bytes32 reasonCID) external {
        Post storage p = posts[postId];
        if (p.author == address(0)) revert NoSuchPost();
        Forum storage f = forums[p.forumId];
        _requireModAuthority(p.forumId, f);
        p.status = newStatus;
        emit Moderated(postId, newStatus, reasonCID);
    }

    // ----- internal -----

    /// @dev Resolves moderation authority by governance mode:
    ///      - Dao:          only the configured governor (timelock executor) may act.
    ///      - ModeratorSet: the forum owner or any address in isModerator[forumId].
    ///      - Owner:        only the forum owner.
    function _requireModAuthority(uint256 forumId, Forum storage f) internal view {
        if (f.gov == Governance.Dao) {
            if (msg.sender != f.governor) revert Forbidden();
        } else if (f.gov == Governance.ModeratorSet) {
            if (msg.sender != f.owner && !isModerator[forumId][msg.sender]) revert Forbidden();
        } else {
            if (msg.sender != f.owner) revert Forbidden();
        }
    }

    function _weightOf(address user) internal view returns (uint256) {
        if (address(reputation) == address(0)) return 1;
        uint256 w = reputation.weight(user);
        return w == 0 ? 1 : w; // floor weight of 1 so new users can still participate
    }

    function _abs(int8 v) internal pure returns (uint8) {
        return v < 0 ? uint8(-v) : uint8(v);
    }
}
