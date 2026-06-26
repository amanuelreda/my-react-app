// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IReputation — soulbound reputation read/write surface.
interface IReputation {
    /// @notice Award non-transferable reputation. Restricted to authorized hook callers.
    function award(address user, uint256 amount, bytes32 sourceRef) external;

    /// @notice Raw reputation balance.
    function reputationOf(address user) external view returns (uint256);

    /// @notice Voting weight derived from reputation (sybil-dampened, e.g. sqrt).
    function weight(address user) external view returns (uint256);
}
