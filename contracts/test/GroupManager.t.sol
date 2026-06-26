// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GroupManager} from "../src/GroupManager.sol";
import {IGate} from "../src/interfaces/IGate.sol";

contract AllowAllGate is IGate {
    function check(uint256, address, bytes calldata) external pure returns (bool) {
        return true;
    }
}

contract DenyAllGate is IGate {
    function check(uint256, address, bytes calldata) external pure returns (bool) {
        return false;
    }
}

contract GroupManagerTest is Test {
    GroupManager gm;
    address owner = address(0x0001);
    address admin = address(0x0002);
    address member = address(0x0003);
    address stranger = address(0x0004);

    // mirror of the contract's permission bits for assertions
    uint16 constant POST = 1;
    uint16 constant BAN = 32;
    uint16 constant MANAGE_ADMINS = 64;
    uint16 constant OWNER = 0xFFFF;

    function setUp() public {
        gm = new GroupManager();
    }

    function _createPublic() internal returns (uint256 id) {
        vm.prank(owner);
        id = gm.createGroup(bytes32("meta"), GroupManager.Visibility.Public, IGate(address(0)), bytes32("mls1"));
    }

    function test_create_ownerGetsFullPerms() public {
        uint256 id = _createPublic();
        assertTrue(gm.isMember(id, owner));
        assertEq(gm.perms(id, owner), OWNER);
        (address o,,,, uint32 count,,,, ) = gm.groups(id);
        assertEq(o, owner);
        assertEq(count, 1);
    }

    function test_join_public() public {
        uint256 id = _createPublic();
        vm.prank(member);
        gm.join(id, "");
        assertTrue(gm.isMember(id, member));
        assertTrue(gm.hasPermission(id, member, POST));
    }

    function test_join_revertsOnDouble() public {
        uint256 id = _createPublic();
        vm.startPrank(member);
        gm.join(id, "");
        vm.expectRevert(GroupManager.AlreadyMember.selector);
        gm.join(id, "");
        vm.stopPrank();
    }

    function test_join_privateReverts() public {
        vm.prank(owner);
        uint256 id =
            gm.createGroup(bytes32("m"), GroupManager.Visibility.Private, IGate(address(0)), bytes32("mls"));
        vm.prank(member);
        vm.expectRevert(GroupManager.Forbidden.selector);
        gm.join(id, "");
    }

    function test_tokenGate_allowAndDeny() public {
        AllowAllGate allow = new AllowAllGate();
        DenyAllGate deny = new DenyAllGate();

        vm.prank(owner);
        uint256 g1 =
            gm.createGroup(bytes32("m"), GroupManager.Visibility.TokenGated, allow, bytes32("mls"));
        vm.prank(member);
        gm.join(g1, "");
        assertTrue(gm.isMember(g1, member));

        vm.prank(owner);
        uint256 g2 = gm.createGroup(bytes32("m"), GroupManager.Visibility.TokenGated, deny, bytes32("mls"));
        vm.prank(stranger);
        vm.expectRevert(GroupManager.GateRejected.selector);
        gm.join(g2, "");
    }

    function test_setRole_requiresManageAdmins() public {
        uint256 id = _createPublic();
        vm.prank(member);
        gm.join(id, "");

        // stranger cannot set roles
        vm.prank(stranger);
        vm.expectRevert(GroupManager.Forbidden.selector);
        gm.setRole(id, member, BAN);

        // owner promotes member to admin (BAN + MANAGE_ADMINS)
        vm.prank(owner);
        gm.setRole(id, admin, BAN | MANAGE_ADMINS);
        assertTrue(gm.hasPermission(id, admin, BAN));
    }

    function test_ban_removesMemberAndBlocksRejoin() public {
        uint256 id = _createPublic();
        vm.prank(member);
        gm.join(id, "");

        vm.prank(owner);
        gm.ban(id, member, bytes32("spam"));
        assertFalse(gm.isMember(id, member));
        assertTrue(gm.banned(id, member));

        vm.prank(member);
        vm.expectRevert(GroupManager.IsBanned.selector);
        gm.join(id, "");
    }

    function test_ban_cannotTargetOwner() public {
        uint256 id = _createPublic();
        vm.prank(owner);
        gm.setRole(id, admin, BAN);
        // admin is not a member yet via setRole? setRole adds them
        vm.prank(admin);
        vm.expectRevert(GroupManager.CannotTargetOwner.selector);
        gm.ban(id, owner, bytes32("x"));
    }

    function test_unban_allowsRejoin() public {
        uint256 id = _createPublic();
        vm.prank(member);
        gm.join(id, "");
        vm.startPrank(owner);
        gm.ban(id, member, bytes32("x"));
        gm.unban(id, member);
        vm.stopPrank();
        vm.prank(member);
        gm.join(id, "");
        assertTrue(gm.isMember(id, member));
    }

    function test_leave_ownerCannotLeave() public {
        uint256 id = _createPublic();
        vm.prank(owner);
        vm.expectRevert(GroupManager.Forbidden.selector);
        gm.leave(id);
    }

    function test_transferOwnership() public {
        uint256 id = _createPublic();
        vm.prank(owner);
        gm.transferOwnership(id, admin);
        assertEq(gm.perms(id, admin), OWNER);
        (address o,,,,,,,,) = gm.groups(id);
        assertEq(o, admin);
    }

    function test_appendCommitment_incrementsSeq() public {
        uint256 id = _createPublic();
        vm.startPrank(owner);
        gm.appendCommitment(id, bytes32("root1"));
        gm.appendCommitment(id, bytes32("root2"));
        vm.stopPrank();
        assertEq(gm.lastCommitment(id), bytes32("root2"));
        (,,,,,,,, uint256 seq) = gm.groups(id);
        assertEq(seq, 2);
    }

    function test_appendCommitment_requiresPost() public {
        uint256 id = _createPublic();
        vm.prank(stranger);
        vm.expectRevert(GroupManager.Forbidden.selector);
        gm.appendCommitment(id, bytes32("r"));
    }

    function test_noSuchGroupReverts() public {
        vm.prank(member);
        vm.expectRevert(GroupManager.NoSuchGroup.selector);
        gm.join(999, "");
    }
}
