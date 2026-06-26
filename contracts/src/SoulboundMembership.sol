// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title SoulboundMembership
/// @notice ERC-1155-subset membership token for TeleBlock groups. One token id per group; a balance
///         of 1 means "member". `GroupManager` (the configured minter) mints on join and burns on
///         leave/ban. Per-group `soulbound` flag makes membership non-transferable (identity-bound) —
///         transfers of a soulbound id revert. Emits standard ERC-1155 `TransferSingle` so wallets
///         and explorers recognize the token. Self-contained (no external imports).
contract SoulboundMembership {
    string public constant name = "TeleBlock Membership";

    address public minter; // the GroupManager (or owner) authorized to mint/burn

    mapping(uint256 => mapping(address => uint256)) private _balance; // id (groupId) => account => amount
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => bool) public soulbound; // id => non-transferable

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event SoulboundSet(uint256 indexed id, bool soulbound);
    event MinterChanged(address indexed minter);

    error NotMinter();
    error Soulbound();
    error NotApproved();
    error InsufficientBalance();

    constructor() {
        minter = msg.sender;
    }

    modifier onlyMinter() {
        if (msg.sender != minter) revert NotMinter();
        _;
    }

    function setMinter(address m) external onlyMinter {
        minter = m;
        emit MinterChanged(m);
    }

    function setSoulbound(uint256 id, bool s) external onlyMinter {
        soulbound[id] = s;
        emit SoulboundSet(id, s);
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return _balance[id][account];
    }

    /// @notice Mint a membership (groupId = id). Idempotent-ish: balance can exceed 1 only if minted twice.
    function mint(address to, uint256 id) external onlyMinter {
        _balance[id][to] += 1;
        emit TransferSingle(msg.sender, address(0), to, id, 1);
    }

    /// @notice Burn a membership on leave/ban.
    function burn(address from, uint256 id) external onlyMinter {
        uint256 b = _balance[id][from];
        if (b == 0) revert InsufficientBalance();
        _balance[id][from] = b - 1;
        emit TransferSingle(msg.sender, from, address(0), id, 1);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /// @notice ERC-1155 transfer. Reverts for soulbound ids (membership is identity-bound).
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        if (soulbound[id]) revert Soulbound();
        if (from != msg.sender && !isApprovedForAll[from][msg.sender]) revert NotApproved();
        uint256 b = _balance[id][from];
        if (b < amount) revert InsufficientBalance();
        _balance[id][from] = b - amount;
        _balance[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
    }

    function supportsInterface(bytes4 iid) external pure returns (bool) {
        return iid == 0xd9b67a26 /* ERC-1155 */ || iid == 0x01ffc9a7 /* ERC-165 */;
    }
}
