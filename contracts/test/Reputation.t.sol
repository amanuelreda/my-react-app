// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Reputation} from "../src/Reputation.sol";

contract ReputationTest is Test {
    Reputation rep;
    address hook = address(0xC0C0);
    address user = address(0x1234);

    function setUp() public {
        rep = new Reputation();
        rep.setHook(hook, true);
    }

    function test_award_onlyAuthorized() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(Reputation.NotAuthorized.selector);
        rep.award(user, 10, bytes32(0));

        vm.prank(hook);
        rep.award(user, 100, bytes32(0));
        assertEq(rep.reputationOf(user), 100);
    }

    function test_weight_isSqrt() public {
        vm.prank(hook);
        rep.award(user, 100, bytes32(0));
        assertEq(rep.weight(user), 10); // sqrt(100)

        vm.prank(hook);
        rep.award(user, 21, bytes32(0)); // total 121
        assertEq(rep.weight(user), 11); // sqrt(121)
    }

    function test_weight_dampensWhales() public {
        // 100x more reputation -> only 10x more weight
        vm.startPrank(hook);
        rep.award(user, 10000, bytes32(0));
        vm.stopPrank();
        address small = address(0x5);
        vm.prank(hook);
        rep.award(small, 100, bytes32(0));
        assertEq(rep.weight(user), 100);
        assertEq(rep.weight(small), 10);
    }

    function test_badge_mintOnce() public {
        vm.prank(hook);
        rep.mintBadge(user, 1);
        assertEq(rep.badgesOf(user).length, 1);
        vm.prank(hook);
        vm.expectRevert(Reputation.BadgeExists.selector);
        rep.mintBadge(user, 1);
    }

    function testFuzz_sqrtMonotonic(uint128 a, uint128 b) public {
        vm.assume(a <= b);
        vm.startPrank(hook);
        rep.award(address(0xAA), a, bytes32(0));
        rep.award(address(0xBB), b, bytes32(0));
        vm.stopPrank();
        assertLe(rep.weight(address(0xAA)), rep.weight(address(0xBB)));
    }
}
