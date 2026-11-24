// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILeviumVerifier} from "./interfaces/ILeviumVerifier.sol";

/// @title LeviumJudgeEscrow
/// @notice Example consumer of Levium receipts: a two-party BNB wager settled by an AI judge.
///
/// Flow:
///   1. Party A calls `createMatch(opponent, modelFingerprint, inputHash, deadline)` and deposits the stake.
///      `modelFingerprint` pins the judge model; `inputHash` commits to the dispute the judge is asked about.
///   2. Party B calls `join(matchId)` depositing the same stake.
///   3. Before `deadline`, anyone calls `resolve(...)` with a Levium receipt for exactly that model and
///      input whose output hash commits to the winner:
///          outputHash == winnerCommitment(matchId, winner)
///                     == keccak256(abi.encode(address(this), block.chainid, matchId, winner))
///      The receipt must verify against the LeviumVerifier (trusted signer, active model).
///      The whole pot is sent to the winner.
///   4. If A's match is never joined, A can `cancel` it. If a funded match is not resolved before
///      `deadline`, each party can `refund` their own stake.
///
/// @dev The winner-commitment convention is specific to this example: the judge model's output must be
///      the canonical commitment above (computed off-chain by the model and signed in the receipt).
///      Reentrancy: every state change happens before the external call (CEI) and all
///      value-moving functions additionally use a `nonReentrant` guard.
contract LeviumJudgeEscrow {
    enum Status {
        None,
        Open, // created, waiting for opponent
        Funded, // both stakes deposited
        Resolved, // pot paid to winner
        Cancelled, // creator withdrew before opponent joined
        Refunded // deadline passed; stakes returned (or being returned)
    }

    struct Match {
        address partyA;
        address partyB;
        uint96 stake;
        uint64 deadline;
        Status status;
        bool refundedA;
        bool refundedB;
        bytes32 modelFingerprint;
        bytes32 inputHash;
    }

    ILeviumVerifier public immutable verifier;

    uint256 public matchCount;
    mapping(uint256 => Match) public matches;

    uint256 private _lock = 1;

    event MatchCreated(
        uint256 indexed matchId,
        address indexed partyA,
        address indexed partyB,
        uint256 stake,
        bytes32 modelFingerprint,
        bytes32 inputHash,
        uint64 deadline
    );
    event MatchJoined(uint256 indexed matchId, address indexed partyB);
    event MatchResolved(uint256 indexed matchId, address indexed winner, uint256 payout, address signer);
    event MatchCancelled(uint256 indexed matchId);
    event StakeRefunded(uint256 indexed matchId, address indexed party, uint256 amount);

    error ZeroAddress();
    error InvalidOpponent();
    error InvalidStake();
    error InvalidDeadline();
    error ZeroValue();
    error WrongStatus(Status current);
    error NotParty();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error InvalidWinner();
    error WrongOutput();
    error InvalidReceipt();
    error AlreadyRefunded();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(ILeviumVerifier verifier_) {
        if (address(verifier_) == address(0)) revert ZeroAddress();
        verifier = verifier_;
    }

    /// @notice The outputHash a judge receipt must carry to declare `winner` of `matchId`.
    function winnerCommitment(uint256 matchId, address winner) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, matchId, winner));
    }

    function createMatch(address opponent, bytes32 modelFingerprint, bytes32 inputHash, uint64 deadline)
        external
        payable
        returns (uint256 matchId)
    {
        if (opponent == address(0)) revert ZeroAddress();
        if (opponent == msg.sender) revert InvalidOpponent();
        if (msg.value == 0 || msg.value > type(uint96).max) revert InvalidStake();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (modelFingerprint == bytes32(0) || inputHash == bytes32(0)) revert ZeroValue();

        matchId = ++matchCount;
        matches[matchId] = Match({
            partyA: msg.sender,
            partyB: opponent,
            stake: uint96(msg.value),
            deadline: deadline,
            status: Status.Open,
            refundedA: false,
            refundedB: false,
            modelFingerprint: modelFingerprint,
            inputHash: inputHash
        });

        emit MatchCreated(matchId, msg.sender, opponent, msg.value, modelFingerprint, inputHash, deadline);
    }

    function join(uint256 matchId) external payable {
        Match storage m = matches[matchId];
        if (m.status != Status.Open) revert WrongStatus(m.status);
        if (msg.sender != m.partyB) revert NotParty();
        if (block.timestamp >= m.deadline) revert DeadlinePassed();
        if (msg.value != m.stake) revert InvalidStake();

        m.status = Status.Funded;
        emit MatchJoined(matchId, msg.sender);
    }

    /// @notice Creator withdraws an unjoined match.
    function cancel(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != Status.Open) revert WrongStatus(m.status);
        if (msg.sender != m.partyA) revert NotParty();

        // Effects
        m.status = Status.Cancelled;
        m.refundedA = true;
        uint256 amount = m.stake;
        emit MatchCancelled(matchId);
        emit StakeRefunded(matchId, m.partyA, amount);

        // Interaction
        _send(m.partyA, amount);
    }

    /// @notice Settles a funded match with a Levium receipt. Callable by anyone.
    function resolve(
        uint256 matchId,
        address winner,
        uint256 blockNumber,
        uint256 timestamp,
        bytes calldata signature
    ) external nonReentrant {
        Match storage m = matches[matchId];
        // Checks
        if (m.status != Status.Funded) revert WrongStatus(m.status);
        if (block.timestamp >= m.deadline) revert DeadlinePassed();
        if (winner != m.partyA && winner != m.partyB) revert InvalidWinner();

        bytes32 outputHash = winnerCommitment(matchId, winner);
        (bool valid, address signer) =
            verifier.verifyReceipt(m.modelFingerprint, m.inputHash, outputHash, blockNumber, timestamp, signature);
        if (!valid) revert InvalidReceipt();

        // Effects
        m.status = Status.Resolved;
        uint256 payout = uint256(m.stake) * 2;
        emit MatchResolved(matchId, winner, payout, signer);

        // Interaction
        _send(winner, payout);
    }

    /// @notice After the deadline, each party of an unresolved funded match reclaims their own stake.
    function refund(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status != Status.Funded && m.status != Status.Refunded) revert WrongStatus(m.status);
        if (block.timestamp < m.deadline) revert DeadlineNotPassed();

        // Effects
        if (msg.sender == m.partyA) {
            if (m.refundedA) revert AlreadyRefunded();
            m.refundedA = true;
        } else if (msg.sender == m.partyB) {
            if (m.refundedB) revert AlreadyRefunded();
            m.refundedB = true;
        } else {
            revert NotParty();
        }
        m.status = Status.Refunded;
        uint256 amount = m.stake;
        emit StakeRefunded(matchId, msg.sender, amount);

        // Interaction
        _send(msg.sender, amount);
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
