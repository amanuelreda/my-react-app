// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {GroupManager} from "../src/GroupManager.sol";
import {Reputation} from "../src/Reputation.sol";
import {ForumManager} from "../src/ForumManager.sol";
import {IReputation} from "../src/interfaces/IReputation.sol";

/// @notice Deploys the TeleBlock core contracts and wires the Reputation hook for ForumManager.
///         Usage: forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        IdentityRegistry identity = new IdentityRegistry();
        GroupManager groups = new GroupManager();
        Reputation reputation = new Reputation();
        ForumManager forums = new ForumManager(IReputation(address(reputation)));

        // Authorize ForumManager to award reputation for upvoted posts.
        reputation.setHook(address(forums), true);

        vm.stopBroadcast();

        console2.log("IdentityRegistry:", address(identity));
        console2.log("GroupManager:    ", address(groups));
        console2.log("Reputation:      ", address(reputation));
        console2.log("ForumManager:    ", address(forums));
    }
}
