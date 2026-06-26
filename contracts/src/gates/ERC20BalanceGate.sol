// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IGate} from "../interfaces/IGate.sol";

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

/// @title ERC20BalanceGate
/// @notice Example token-gate adapter: admits a user iff they hold at least `minBalance` of a
///         given ERC-20. Demonstrates the IGate adapter pattern; ERC-721/1155/allowlist gates
///         follow the same shape.
contract ERC20BalanceGate is IGate {
    IERC20Balance public immutable token;
    uint256 public immutable minBalance;

    constructor(IERC20Balance _token, uint256 _minBalance) {
        token = _token;
        minBalance = _minBalance;
    }

    /// @inheritdoc IGate
    function check(uint256, address user, bytes calldata) external view override returns (bool) {
        return token.balanceOf(user) >= minBalance;
    }
}
