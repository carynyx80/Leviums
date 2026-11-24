// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ILeviumVerifier
/// @notice Interface of the Levium receipt verifier.
interface ILeviumVerifier {
    function computeReceiptHash(
        bytes32 modelFingerprint,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 blockNumber,
        uint256 timestamp
    ) external view returns (bytes32);

    function verifyReceipt(
        bytes32 modelFingerprint,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 blockNumber,
        uint256 timestamp,
        bytes calldata signature
    ) external view returns (bool valid, address signer);

    function anchor(
        bytes32 modelFingerprint,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 blockNumber,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (bytes32 receiptHash);

    function anchored(bytes32 receiptHash) external view returns (bool);
}
