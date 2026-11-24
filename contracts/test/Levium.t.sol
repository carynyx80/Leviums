// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LeviumRegistry} from "../src/LeviumRegistry.sol";
import {LeviumVerifier} from "../src/LeviumVerifier.sol";
import {LeviumJudgeEscrow} from "../src/LeviumJudgeEscrow.sol";

abstract contract LeviumBase is Test {
    uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    LeviumRegistry internal registry;
    LeviumVerifier internal verifier;

    address internal owner = makeAddr("owner");
    uint256 internal signerPk = 0xA11CE;
    address internal signer;
    uint256 internal rogueePk = 0xB0B;

    bytes32 internal constant MODEL_ID = keccak256("rugscan-v1");
    bytes32 internal constant FINGERPRINT = keccak256("rugscan-v1 source/config");
    bytes32 internal constant INPUT_HASH = keccak256('{"token":"0x0000000000000000000000000000000000000001"}');
    bytes32 internal constant OUTPUT_HASH = keccak256('{"score":90,"verdict":"SAFE"}');
    uint256 internal constant BLOCK_NUMBER = 44_000_000;
    uint256 internal constant TIMESTAMP = 1_764_000_000;

    function setUp() public virtual {
        vm.chainId(56);
        signer = vm.addr(signerPk);
        registry = new LeviumRegistry(owner);
        verifier = new LeviumVerifier(registry);
        vm.startPrank(owner);
        registry.registerModel(MODEL_ID, FINGERPRINT, "rugscan-v1");
        registry.setSigner(signer, true);
        vm.stopPrank();
    }

    /// Off-chain reference implementation of the SPEC receipt hash (chainId hard-coded to 56).
    function _receiptHash(bytes32 fp, bytes32 inHash, bytes32 outHash, uint256 bn, uint256 ts)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(fp, inHash, outHash, uint256(56), bn, ts));
    }

    function _personalSign(uint256 pk, bytes32 hash) internal pure returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _sign(uint256 pk, bytes32 fp, bytes32 inHash, bytes32 outHash, uint256 bn, uint256 ts)
        internal
        pure
        returns (bytes memory)
    {
        return _personalSign(pk, _receiptHash(fp, inHash, outHash, bn, ts));
    }
}

contract LeviumVerifierTest is LeviumBase {
    event ReceiptAnchored(bytes32 indexed receiptHash, address indexed signer, address indexed anchoredBy);

    function test_ComputeReceiptHashMatchesSpec() public view {
        assertEq(
            verifier.computeReceiptHash(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP),
            _receiptHash(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP)
        );
    }

    function test_ValidSignaturePasses() public view {
        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        (bool valid, address recovered) =
            verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);
        assertTrue(valid);
        assertEq(recovered, signer);
    }

    function test_TamperedOutputHashFails() public view {
        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        bytes32 tampered = keccak256('{"score":10,"verdict":"DANGER"}');
        (bool valid, address recovered) =
            verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, tampered, BLOCK_NUMBER, TIMESTAMP, sig);
        assertFalse(valid);
        assertTrue(recovered != signer);
    }

    function test_TamperedFieldsFail() public view {
        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        (bool v1,) = verifier.verifyReceipt(FINGERPRINT, bytes32(uint256(1)), OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);
        (bool v2,) = verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER + 1, TIMESTAMP, sig);
        (bool v3,) = verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP + 1, sig);
        assertFalse(v1);
        assertFalse(v2);
        assertFalse(v3);
    }

    function test_WrongChainIdFails() public {
        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        vm.chainId(97);
        (bool valid,) = verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);
        assertFalse(valid);
    }

    function test_UntrustedSignerFails() public view {
        bytes memory sig = _sign(rogueePk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        (bool valid, address recovered) =
            verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);
        assertFalse(valid);
        assertEq(recovered, vm.addr(rogueePk));
    }

    function test_RevokedSignerFails() public {
        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        vm.prank(owner);
        registry.setSigner(signer, false);
        (bool valid,) = verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);
        assertFalse(valid);
    }

    function test_InactiveOrUnknownModelFails() public {
        bytes32 unknownFp = keccak256("unknown");
        bytes memory sigUnknown = _sign(signerPk, unknownFp, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        (bool v1,) = verifier.verifyReceipt(unknownFp, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sigUnknown);
        assertFalse(v1);

        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        vm.prank(owner);
        registry.setModelActive(MODEL_ID, false);
        (bool v2,) = verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);
        assertFalse(v2);
    }

    function test_HighSMalleableSignatureRejected() public view {
        bytes32 h = _receiptHash(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);

        // Sanity: the canonical signature is valid.
        (bool ok,) =
            verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, abi.encodePacked(r, s, v));
        assertTrue(ok);

        // Malleated twin (r, n - s, flipped v) recovers to the same key via raw ecrecover...
        bytes32 sHigh = bytes32(SECP256K1_N - uint256(s));
        uint8 vFlipped = v == 27 ? 28 : 27;
        assertEq(ecrecover(digest, vFlipped, r, sHigh), signer);

        // ...but must be rejected by the verifier.
        (bool valid, address recovered) = verifier.verifyReceipt(
            FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, abi.encodePacked(r, sHigh, vFlipped)
        );
        assertFalse(valid);
        assertEq(recovered, address(0));
    }

    function test_MalformedSignaturesRejected() public view {
        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);

        // 64-byte (EIP-2098 compact) and over-long signatures are not accepted.
        bytes memory short = new bytes(64);
        bytes memory long = abi.encodePacked(sig, bytes1(0x00));
        for (uint256 i; i < 64; ++i) short[i] = sig[i];
        (bool v1,) = verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, short);
        (bool v2,) = verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, long);
        assertFalse(v1);
        assertFalse(v2);

        // v = 0/1 style is rejected.
        bytes memory badV = bytes.concat(sig);
        badV[64] = bytes1(uint8(sig[64]) - 27);
        (bool v3, address r3) =
            verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, badV);
        assertFalse(v3);
        assertEq(r3, address(0));

        // Empty signature.
        (bool v4,) = verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, "");
        assertFalse(v4);
    }

    function test_AnchorEmitsAndStores() public {
        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        bytes32 h = _receiptHash(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        address caller = makeAddr("anyone");

        vm.expectEmit(true, true, true, true, address(verifier));
        emit ReceiptAnchored(h, signer, caller);
        vm.prank(caller);
        bytes32 returned = verifier.anchor(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);

        assertEq(returned, h);
        assertTrue(verifier.anchored(h));
    }

    function test_DoubleAnchorReverts() public {
        bytes memory sig = _sign(signerPk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        bytes32 h = _receiptHash(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        verifier.anchor(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);

        vm.expectRevert(abi.encodeWithSelector(LeviumVerifier.AlreadyAnchored.selector, h));
        verifier.anchor(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);
    }

    function test_AnchorInvalidReverts() public {
        bytes memory sig = _sign(rogueePk, FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP);
        vm.expectRevert(LeviumVerifier.InvalidReceipt.selector);
        verifier.anchor(FINGERPRINT, INPUT_HASH, OUTPUT_HASH, BLOCK_NUMBER, TIMESTAMP, sig);
    }

    function testFuzz_OnlyTrustedSignerVerifies(uint256 pk, bytes32 outHash) public view {
        pk = bound(pk, 1, SECP256K1_N - 1);
        bytes memory sig = _sign(pk, FINGERPRINT, INPUT_HASH, outHash, BLOCK_NUMBER, TIMESTAMP);
        (bool valid, address recovered) =
            verifier.verifyReceipt(FINGERPRINT, INPUT_HASH, outHash, BLOCK_NUMBER, TIMESTAMP, sig);
        assertEq(recovered, vm.addr(pk));
        assertEq(valid, vm.addr(pk) == signer);
    }
}

contract LeviumRegistryTest is LeviumBase {
    function test_TreasuryConstant() public view {
        assertEq(registry.TREASURY(), 0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76);
    }

    function test_OnlyOwner() public {
        address stranger = makeAddr("stranger");
        vm.startPrank(stranger);
        vm.expectRevert(LeviumRegistry.NotOwner.selector);
        registry.setSigner(stranger, true);
        vm.expectRevert(LeviumRegistry.NotOwner.selector);
        registry.registerModel(keccak256("x"), keccak256("y"), "x");
        vm.expectRevert(LeviumRegistry.NotOwner.selector);
        registry.setModelActive(MODEL_ID, false);
        vm.expectRevert(LeviumRegistry.NotOwner.selector);
        registry.transferOwnership(stranger);
        vm.stopPrank();
    }

    function test_TwoStepOwnership() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        registry.transferOwnership(newOwner);
        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), newOwner);

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(LeviumRegistry.NotPendingOwner.selector);
        registry.acceptOwnership();

        vm.prank(newOwner);
        registry.acceptOwnership();
        assertEq(registry.owner(), newOwner);
        assertEq(registry.pendingOwner(), address(0));
    }

    function test_ModelRegistrationRules() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(LeviumRegistry.ModelAlreadyRegistered.selector, MODEL_ID));
        registry.registerModel(MODEL_ID, keccak256("other"), "dup");

        vm.expectRevert(abi.encodeWithSelector(LeviumRegistry.FingerprintInUse.selector, FINGERPRINT, MODEL_ID));
        registry.registerModel(keccak256("walletscan-v1"), FINGERPRINT, "walletscan-v1");

        vm.expectRevert(LeviumRegistry.ZeroValue.selector);
        registry.registerModel(keccak256("z"), bytes32(0), "z");
        vm.stopPrank();

        (bytes32 fp, string memory name, bool active) = registry.getModel(MODEL_ID);
        assertEq(fp, FINGERPRINT);
        assertEq(name, "rugscan-v1");
        assertTrue(active);
        assertTrue(registry.isActiveFingerprint(FINGERPRINT));
        assertFalse(registry.isActiveFingerprint(bytes32(0)));
    }
}

contract ReentrantWinner {
    LeviumJudgeEscrow internal escrow;
    uint256 internal matchId;
    bool public reentryBlocked;

    constructor(LeviumJudgeEscrow e) {
        escrow = e;
    }

    function create(address opponent, bytes32 fp, bytes32 inHash, uint64 deadline) external payable returns (uint256) {
        matchId = escrow.createMatch{value: msg.value}(opponent, fp, inHash, deadline);
        return matchId;
    }

    receive() external payable {
        // Try to re-enter to drain funds; must fail.
        try escrow.refund(matchId) {}
        catch {
            reentryBlocked = true;
        }
    }
}

contract LeviumJudgeEscrowTest is LeviumBase {
    LeviumJudgeEscrow internal escrow;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    bytes32 internal constant DISPUTE_HASH = keccak256('{"question":"who won the chess game #42?"}');
    uint256 internal constant STAKE = 1 ether;
    uint64 internal deadline;

    function setUp() public override {
        super.setUp();
        escrow = new LeviumJudgeEscrow(verifier);
        deadline = uint64(block.timestamp + 7 days);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _fundedMatch() internal returns (uint256 id) {
        vm.prank(alice);
        id = escrow.createMatch{value: STAKE}(bob, FINGERPRINT, DISPUTE_HASH, deadline);
        vm.prank(bob);
        escrow.join{value: STAKE}(id);
    }

    function _judgeSig(uint256 pk, uint256 id, address winner) internal view returns (bytes memory) {
        return _sign(pk, FINGERPRINT, DISPUTE_HASH, escrow.winnerCommitment(id, winner), BLOCK_NUMBER, TIMESTAMP);
    }

    function test_EscrowHappyPath() public {
        uint256 id = _fundedMatch();
        assertEq(address(escrow).balance, 2 * STAKE);

        bytes memory sig = _judgeSig(signerPk, id, bob);
        uint256 bobBefore = bob.balance;
        vm.prank(makeAddr("relayer"));
        escrow.resolve(id, bob, BLOCK_NUMBER, TIMESTAMP, sig);

        assertEq(bob.balance, bobBefore + 2 * STAKE);
        assertEq(address(escrow).balance, 0);
        (,,,, LeviumJudgeEscrow.Status status,,,,) = escrow.matches(id);
        assertEq(uint256(status), uint256(LeviumJudgeEscrow.Status.Resolved));

        // Cannot resolve twice.
        vm.expectRevert(
            abi.encodeWithSelector(LeviumJudgeEscrow.WrongStatus.selector, LeviumJudgeEscrow.Status.Resolved)
        );
        escrow.resolve(id, bob, BLOCK_NUMBER, TIMESTAMP, sig);
    }

    function test_EscrowRejectsReceiptForOtherWinner() public {
        uint256 id = _fundedMatch();
        bytes memory sigForBob = _judgeSig(signerPk, id, bob);
        vm.expectRevert(LeviumJudgeEscrow.InvalidReceipt.selector);
        escrow.resolve(id, alice, BLOCK_NUMBER, TIMESTAMP, sigForBob);
    }

    function test_EscrowRejectsUntrustedJudge() public {
        uint256 id = _fundedMatch();
        bytes memory sig = _judgeSig(rogueePk, id, alice);
        vm.expectRevert(LeviumJudgeEscrow.InvalidReceipt.selector);
        escrow.resolve(id, alice, BLOCK_NUMBER, TIMESTAMP, sig);
    }

    function test_EscrowRejectsNonPartyWinner() public {
        uint256 id = _fundedMatch();
        address mallory = makeAddr("mallory");
        bytes memory sig = _judgeSig(signerPk, id, mallory);
        vm.expectRevert(LeviumJudgeEscrow.InvalidWinner.selector);
        escrow.resolve(id, mallory, BLOCK_NUMBER, TIMESTAMP, sig);
    }

    function test_EscrowRefundAfterDeadline() public {
        uint256 id = _fundedMatch();
        vm.expectRevert(LeviumJudgeEscrow.DeadlineNotPassed.selector);
        vm.prank(alice);
        escrow.refund(id);

        vm.warp(deadline);
        uint256 a0 = alice.balance;
        uint256 b0 = bob.balance;
        vm.prank(alice);
        escrow.refund(id);
        vm.prank(bob);
        escrow.refund(id);
        assertEq(alice.balance, a0 + STAKE);
        assertEq(bob.balance, b0 + STAKE);
        assertEq(address(escrow).balance, 0);

        vm.prank(alice);
        vm.expectRevert(LeviumJudgeEscrow.AlreadyRefunded.selector);
        escrow.refund(id);

        // Late resolution is impossible.
        bytes memory sig = _judgeSig(signerPk, id, alice);
        vm.expectRevert(
            abi.encodeWithSelector(LeviumJudgeEscrow.WrongStatus.selector, LeviumJudgeEscrow.Status.Refunded)
        );
        escrow.resolve(id, alice, BLOCK_NUMBER, TIMESTAMP, sig);
    }

    function test_EscrowCancelUnjoined() public {
        vm.prank(alice);
        uint256 id = escrow.createMatch{value: STAKE}(bob, FINGERPRINT, DISPUTE_HASH, deadline);
        uint256 a0 = alice.balance;
        vm.prank(alice);
        escrow.cancel(id);
        assertEq(alice.balance, a0 + STAKE);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(LeviumJudgeEscrow.WrongStatus.selector, LeviumJudgeEscrow.Status.Cancelled)
        );
        escrow.join{value: STAKE}(id);
    }

    function test_EscrowJoinRequiresExactStakeAndParty() public {
        vm.prank(alice);
        uint256 id = escrow.createMatch{value: STAKE}(bob, FINGERPRINT, DISPUTE_HASH, deadline);
        vm.prank(bob);
        vm.expectRevert(LeviumJudgeEscrow.InvalidStake.selector);
        escrow.join{value: STAKE - 1}(id);

        address mallory = makeAddr("mallory");
        vm.deal(mallory, 1 ether);
        vm.prank(mallory);
        vm.expectRevert(LeviumJudgeEscrow.NotParty.selector);
        escrow.join{value: STAKE}(id);
    }

    function test_EscrowReentrancyBlocked() public {
        ReentrantWinner attacker = new ReentrantWinner(escrow);
        vm.deal(address(attacker), 0);
        uint256 id = attacker.create{value: STAKE}(bob, FINGERPRINT, DISPUTE_HASH, deadline);
        vm.prank(bob);
        escrow.join{value: STAKE}(id);

        bytes memory sig = _judgeSig(signerPk, id, address(attacker));
        escrow.resolve(id, address(attacker), BLOCK_NUMBER, TIMESTAMP, sig);

        assertTrue(attacker.reentryBlocked());
        assertEq(address(attacker).balance, 2 * STAKE);
        assertEq(address(escrow).balance, 0);
    }
}
