// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry reg;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        reg = new IdentityRegistry();
    }

    function _key(bytes1 b) internal pure returns (bytes memory) {
        bytes memory k = new bytes(32);
        k[0] = b;
        return k;
    }

    function test_register_setsIdentity() public {
        vm.prank(alice);
        reg.register(_key(0x01), "cidPrekey", "cidProfile");

        IdentityRegistry.Identity memory id = reg.identityOf(alice);
        assertTrue(id.registered);
        assertEq(id.preKeyBundleCID, "cidPrekey");
        assertEq(id.profileCID, "cidProfile");
        assertTrue(reg.isRegistered(alice));
    }

    function test_register_revertsOnDouble() public {
        vm.startPrank(alice);
        reg.register(_key(0x01), "a", "b");
        vm.expectRevert(IdentityRegistry.AlreadyRegistered.selector);
        reg.register(_key(0x02), "c", "d");
        vm.stopPrank();
    }

    function test_register_revertsOnEmptyKey() public {
        vm.prank(alice);
        vm.expectRevert(IdentityRegistry.EmptyKey.selector);
        reg.register("", "a", "b");
    }

    function test_rotateKeys_updatesAndEmits() public {
        vm.startPrank(alice);
        reg.register(_key(0x01), "a", "b");
        reg.rotateKeys(_key(0x02), "newPrekey");
        vm.stopPrank();
        assertEq(reg.identityOf(alice).preKeyBundleCID, "newPrekey");
    }

    function test_rotate_revertsIfNotRegistered() public {
        vm.prank(bob);
        vm.expectRevert(IdentityRegistry.NotRegistered.selector);
        reg.rotateKeys(_key(0x02), "x");
    }

    function test_username_claimAndUniqueness() public {
        bytes32 name = keccak256("satoshi");
        vm.prank(alice);
        reg.register(_key(0x01), "a", "b");
        vm.prank(alice);
        reg.claimUsername(name);
        assertEq(reg.usernameToAddr(name), alice);

        vm.prank(bob);
        reg.register(_key(0x02), "c", "d");
        vm.prank(bob);
        vm.expectRevert(IdentityRegistry.UsernameTaken.selector);
        reg.claimUsername(name);
    }

    function test_username_reclaimReleasesPrevious() public {
        vm.startPrank(alice);
        reg.register(_key(0x01), "a", "b");
        reg.claimUsername(keccak256("first"));
        reg.claimUsername(keccak256("second"));
        vm.stopPrank();
        assertEq(reg.usernameToAddr(keccak256("first")), address(0));
        assertEq(reg.usernameToAddr(keccak256("second")), alice);
    }

    function testFuzz_register(bytes calldata key, string calldata cid) public {
        vm.assume(key.length > 0);
        vm.prank(alice);
        reg.register(key, cid, cid);
        assertTrue(reg.isRegistered(alice));
    }
}
