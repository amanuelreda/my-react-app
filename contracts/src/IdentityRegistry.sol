// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IdentityRegistry
/// @notice On-chain registry of messaging identities: signing public keys, X25519 pre-key
///         bundle CIDs, and profile CIDs. Stores NO plaintext or PII — only public keys,
///         content identifiers, and usernames hashes.
/// @dev    Signing keys (Ed25519) are derived client-side from a domain-separated wallet
///         signature and are distinct from the wallet's own key. Pre-key bundles live on
///         IPFS; only their CID is anchored here so MITM key substitution is detectable.
contract IdentityRegistry {
    struct Identity {
        bytes signingPubKey;      // Ed25519 public key (raw 32 bytes, abi-encoded as bytes)
        string preKeyBundleCID;   // IPFS CID of the X25519 pre-key bundle
        string profileCID;        // IPFS CID of profile metadata (avatar/bio/links)
        uint64 updatedAt;         // block timestamp of last update
        bool registered;
    }

    mapping(address => Identity) private _identities;
    mapping(bytes32 => address) public usernameToAddr; // keccak256(name) => owner
    mapping(address => bytes32) public addrToUsername;

    event Registered(address indexed user, bytes signingPubKey, string preKeyBundleCID);
    event KeysRotated(address indexed user, bytes newSigningPubKey, string newPreKeyBundleCID);
    event ProfileUpdated(address indexed user, string profileCID);
    event UsernameClaimed(address indexed user, bytes32 indexed nameHash);

    error AlreadyRegistered();
    error NotRegistered();
    error EmptyKey();
    error UsernameTaken();

    modifier onlyRegistered() {
        if (!_identities[msg.sender].registered) revert NotRegistered();
        _;
    }

    /// @notice Register the caller's messaging identity. One-time; use rotateKeys afterwards.
    function register(bytes calldata signingPubKey, string calldata preKeyBundleCID, string calldata profileCID)
        external
    {
        if (_identities[msg.sender].registered) revert AlreadyRegistered();
        if (signingPubKey.length == 0) revert EmptyKey();
        _identities[msg.sender] = Identity({
            signingPubKey: signingPubKey,
            preKeyBundleCID: preKeyBundleCID,
            profileCID: profileCID,
            updatedAt: uint64(block.timestamp),
            registered: true
        });
        emit Registered(msg.sender, signingPubKey, preKeyBundleCID);
    }

    /// @notice Rotate signing key and/or pre-key bundle. Clients surface a "safety number
    ///         changed" warning to peers when this fires.
    function rotateKeys(bytes calldata newSigningPubKey, string calldata newPreKeyBundleCID)
        external
        onlyRegistered
    {
        if (newSigningPubKey.length == 0) revert EmptyKey();
        Identity storage id = _identities[msg.sender];
        id.signingPubKey = newSigningPubKey;
        id.preKeyBundleCID = newPreKeyBundleCID;
        id.updatedAt = uint64(block.timestamp);
        emit KeysRotated(msg.sender, newSigningPubKey, newPreKeyBundleCID);
    }

    /// @notice Update the off-chain profile pointer.
    function setProfile(string calldata profileCID) external onlyRegistered {
        Identity storage id = _identities[msg.sender];
        id.profileCID = profileCID;
        id.updatedAt = uint64(block.timestamp);
        emit ProfileUpdated(msg.sender, profileCID);
    }

    /// @notice Claim a unique username (stored as a hash; the human-readable string lives off-chain).
    function claimUsername(bytes32 nameHash) external onlyRegistered {
        if (usernameToAddr[nameHash] != address(0)) revert UsernameTaken();
        // release any previously held username
        bytes32 prev = addrToUsername[msg.sender];
        if (prev != bytes32(0)) delete usernameToAddr[prev];
        usernameToAddr[nameHash] = msg.sender;
        addrToUsername[msg.sender] = nameHash;
        emit UsernameClaimed(msg.sender, nameHash);
    }

    /// @notice Read an identity record.
    function identityOf(address user) external view returns (Identity memory) {
        return _identities[user];
    }

    function isRegistered(address user) external view returns (bool) {
        return _identities[user].registered;
    }
}
