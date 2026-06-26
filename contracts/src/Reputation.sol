// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IReputation} from "./interfaces/IReputation.sol";

/// @title Reputation
/// @notice Soulbound (non-transferable) reputation score and achievement badges. Reputation is
///         earned via authorized hooks (e.g. ForumManager awarding for upvoted posts) and feeds
///         sybil-dampened voting weight. Badges are minted at thresholds and can gate features.
contract Reputation is IReputation {
    address public owner;
    mapping(address => bool) public authorizedHook; // contracts allowed to award reputation

    mapping(address => uint256) private _rep;
    mapping(bytes32 => bool) public badgeMinted; // keccak256(user, badgeId) => minted
    mapping(address => uint256[]) private _badges;

    event Awarded(address indexed user, uint256 amount, bytes32 sourceRef, uint256 newTotal);
    event BadgeMinted(address indexed user, uint256 indexed badgeId);
    event HookSet(address indexed hook, bool allowed);

    error NotOwner();
    error NotAuthorized();
    error BadgeExists();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Authorize/deauthorize a contract (e.g. ForumManager) to award reputation.
    function setHook(address hook, bool allowed) external onlyOwner {
        authorizedHook[hook] = allowed;
        emit HookSet(hook, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// @inheritdoc IReputation
    function award(address user, uint256 amount, bytes32 sourceRef) external override {
        if (!authorizedHook[msg.sender]) revert NotAuthorized();
        _rep[user] += amount;
        emit Awarded(user, amount, sourceRef, _rep[user]);
    }

    /// @notice Mint a soulbound achievement badge once per (user, badgeId). Owner or hook only.
    function mintBadge(address user, uint256 badgeId) external {
        if (msg.sender != owner && !authorizedHook[msg.sender]) revert NotAuthorized();
        bytes32 key = keccak256(abi.encodePacked(user, badgeId));
        if (badgeMinted[key]) revert BadgeExists();
        badgeMinted[key] = true;
        _badges[user].push(badgeId);
        emit BadgeMinted(user, badgeId);
    }

    /// @inheritdoc IReputation
    function reputationOf(address user) external view override returns (uint256) {
        return _rep[user];
    }

    /// @inheritdoc IReputation
    /// @dev Quadratic-style dampening: weight = floor(sqrt(rep)). A 100x reputation lead becomes
    ///      only a 10x voting-weight lead, resisting whale/sybil dominance in forum voting.
    function weight(address user) external view override returns (uint256) {
        return _sqrt(_rep[user]);
    }

    function badgesOf(address user) external view returns (uint256[] memory) {
        return _badges[user];
    }

    /// @dev Integer square root (Babylonian method).
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
