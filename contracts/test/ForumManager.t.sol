// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForumManager} from "../src/ForumManager.sol";
import {Reputation} from "../src/Reputation.sol";
import {IReputation} from "../src/interfaces/IReputation.sol";

contract ForumManagerTest is Test {
    ForumManager fm;
    Reputation rep;

    address owner = address(0x01);
    address mod = address(0x02);
    address author = address(0x03);
    address voter1 = address(0x04);
    address voter2 = address(0x05);
    address dao = address(0x0DA0);

    function setUp() public {
        rep = new Reputation();
        fm = new ForumManager(IReputation(address(rep)));
        rep.setHook(address(fm), true); // allow ForumManager to award reputation
    }

    function _ownerForum() internal returns (uint256 id) {
        vm.prank(owner);
        id = fm.createForum(bytes32("meta"), ForumManager.Governance.Owner, address(0), ForumManager.Visibility.Public);
    }

    // ----- single-field accessors over the Post tuple (8 fields) -----
    function _forumId(uint256 p) internal view returns (uint256 v) {
        (v,,,,,,,) = fm.posts(p);
    }

    function _parent(uint256 p) internal view returns (uint256 v) {
        (, v,,,,,,) = fm.posts(p);
    }

    function _author(uint256 p) internal view returns (address v) {
        (,, v,,,,,) = fm.posts(p);
    }

    function _score(uint256 p) internal view returns (int64 v) {
        (,,,,,, v,) = fm.posts(p);
    }

    function _status(uint256 p) internal view returns (ForumManager.PostStatus v) {
        (,,,,,,, v) = fm.posts(p);
    }

    // ----- tests -----

    function test_createForum_andPost() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("hash"));
        assertEq(_forumId(pId), fId);
        assertEq(_parent(pId), 0);
        assertEq(_author(pId), author);
    }

    function test_nestedReply() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 op = fm.createPost(fId, 0, bytes32("op"), bytes32("h"));
        vm.prank(voter1);
        uint256 reply = fm.createPost(fId, op, bytes32("re"), bytes32("h"));
        assertEq(_parent(reply), op);
    }

    function test_reply_badParentReverts() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        vm.expectRevert(ForumManager.BadParent.selector);
        fm.createPost(fId, 999, bytes32("x"), bytes32("h"));
    }

    function test_vote_weightedByReputation() public {
        rep.setHook(address(this), true);
        rep.award(voter1, 100, bytes32(0)); // weight = sqrt(100) = 10

        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));

        vm.prank(voter1);
        fm.vote(pId, 1);
        assertEq(_score(pId), int64(10));
    }

    function test_vote_changeAndClear() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));

        // voter2 has no reputation -> weight floored to 1
        vm.startPrank(voter2);
        fm.vote(pId, 1);
        assertEq(_score(pId), int64(1));
        fm.vote(pId, -1); // switch to downvote
        assertEq(_score(pId), int64(-1));
        fm.vote(pId, 0); // clear
        assertEq(_score(pId), int64(0));
        vm.stopPrank();
    }

    function test_vote_awardsAuthorReputation() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));
        vm.prank(voter1);
        fm.vote(pId, 1);
        assertEq(rep.reputationOf(author), fm.UPVOTE_REP_AWARD());
    }

    function test_vote_selfVoteNoReward() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));
        vm.prank(author);
        fm.vote(pId, 1);
        assertEq(rep.reputationOf(author), 0);
    }

    function test_vote_badDirectionReverts() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));
        vm.prank(voter1);
        vm.expectRevert(ForumManager.BadVote.selector);
        fm.vote(pId, 2);
    }

    function test_moderate_ownerCanHide() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));
        vm.prank(owner);
        fm.moderate(pId, ForumManager.PostStatus.Hidden, bytes32("reason"));
        assertEq(uint8(_status(pId)), uint8(ForumManager.PostStatus.Hidden));
    }

    function test_moderate_strangerForbidden() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));
        vm.prank(voter1);
        vm.expectRevert(ForumManager.Forbidden.selector);
        fm.moderate(pId, ForumManager.PostStatus.Hidden, bytes32("r"));
    }

    function test_moderatorSet_modCanModerate() public {
        vm.prank(owner);
        uint256 fId = fm.createForum(
            bytes32("m"), ForumManager.Governance.ModeratorSet, address(0), ForumManager.Visibility.Public
        );
        vm.prank(owner);
        fm.setModerator(fId, mod, true);

        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));
        vm.prank(mod);
        fm.moderate(pId, ForumManager.PostStatus.Pinned, bytes32("pin"));
        assertEq(uint8(_status(pId)), uint8(ForumManager.PostStatus.Pinned));
    }

    function test_dao_onlyGovernorCanModerate() public {
        vm.prank(owner);
        uint256 fId =
            fm.createForum(bytes32("m"), ForumManager.Governance.Dao, dao, ForumManager.Visibility.Public);
        vm.prank(author);
        uint256 pId = fm.createPost(fId, 0, bytes32("cid"), bytes32("h"));

        vm.prank(owner); // even the owner cannot moderate in DAO mode
        vm.expectRevert(ForumManager.Forbidden.selector);
        fm.moderate(pId, ForumManager.PostStatus.Hidden, bytes32("r"));

        vm.prank(dao);
        fm.moderate(pId, ForumManager.PostStatus.Hidden, bytes32("r"));
        assertEq(uint8(_status(pId)), uint8(ForumManager.PostStatus.Hidden));
    }

    function test_lockedThreadRejectsReplies() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 op = fm.createPost(fId, 0, bytes32("op"), bytes32("h"));
        vm.prank(owner);
        fm.moderate(op, ForumManager.PostStatus.Locked, bytes32("lock"));
        vm.prank(voter1);
        vm.expectRevert(ForumManager.ThreadLocked.selector);
        fm.createPost(fId, op, bytes32("re"), bytes32("h"));
    }

    function test_crossPostFromChat_authorIsCaller() public {
        uint256 fId = _ownerForum();
        vm.prank(author);
        uint256 pId = fm.crossPostFromChat(fId, bytes32("cid"), bytes32("h"), bytes32("src"));
        assertEq(_author(pId), author); // not the contract address
    }
}
