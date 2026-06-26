// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IGate — token-gating adapter for group membership.
/// @notice Implementations check whether `user` is permitted to join `groupId`.
///         Adapters exist for ERC-20 balance, ERC-721/1155 ownership, allowlists, etc.
interface IGate {
    /// @param groupId The group being joined.
    /// @param user    The address attempting to join.
    /// @param proof   Optional opaque proof data (e.g. Merkle proof for an allowlist).
    /// @return ok     True if the user satisfies the gate.
    function check(uint256 groupId, address user, bytes calldata proof) external view returns (bool ok);
}
