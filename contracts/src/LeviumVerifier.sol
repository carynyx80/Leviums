// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILeviumRegistry} from "./interfaces/ILeviumRegistry.sol";
import {ILeviumVerifier} from "./interfaces/ILeviumVerifier.sol";

/// @title LeviumVerifier
/// @notice Verifies Levium "attested" receipts and lets anyone anchor a valid receipt on-chain.
/// @dev Receipt format (SPEC.md):
///        receiptHash = keccak256(abi.encode(bytes32 modelFingerprint, bytes32 inputHash,
///                                           bytes32 outputHash, uint256 chainId,
///                                           uint256 blockNumber, uint256 timestamp))
///        signature   = EIP-191 personal_sign over the 32 raw bytes of receiptHash.
///      chainId is always taken from block.chainid, so a receipt signed for chain 56 only
///      verifies on chain 56.
contract LeviumVerifier is ILeviumVerifier {
    /// @dev secp256k1n / 2. Signatures with s above this value are rejected (EIP-2).
    uint256 private constant _HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    ILeviumRegistry public immutable registry;

    /// @notice receiptHash => anchored via this contract.
    mapping(bytes32 => bool) public anchored;

    event ReceiptAnchored(bytes32 indexed receiptHash, address indexed signer, address indexed anchoredBy);

    error ZeroAddress();
    error InvalidReceipt();
    error AlreadyAnchored(bytes32 receiptHash);

    constructor(ILeviumRegistry registry_) {
        if (address(registry_) == address(0)) revert ZeroAddress();
        registry = registry_;
    }

    /// @inheritdoc ILeviumVerifier
    function computeReceiptHash(
        bytes32 modelFingerprint,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 blockNumber,
        uint256 timestamp
    ) public view returns (bytes32) {
        return keccak256(abi.encode(modelFingerprint, inputHash, outputHash, block.chainid, blockNumber, timestamp));
    }

    /// @notice Verifies a receipt.
    /// @return valid  True iff the signature is well-formed, non-malleable, recovers to a trusted
    ///                signer and the model fingerprint is registered and active.
    /// @return signer The recovered signer (address(0) if the signature is malformed). It is
    ///                returned even when `valid` is false so callers can diagnose failures.
    function verifyReceipt(
        bytes32 modelFingerprint,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 blockNumber,
        uint256 timestamp,
        bytes calldata signature
    ) public view returns (bool valid, address signer) {
        bytes32 receiptHash = computeReceiptHash(modelFingerprint, inputHash, outputHash, blockNumber, timestamp);
        (valid, signer) = _verify(receiptHash, modelFingerprint, signature);
    }

    /// @notice Verifies a receipt and records it as anchored. Reverts if invalid or already anchored.
    function anchor(
        bytes32 modelFingerprint,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 blockNumber,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (bytes32 receiptHash) {
        receiptHash = computeReceiptHash(modelFingerprint, inputHash, outputHash, blockNumber, timestamp);
        if (anchored[receiptHash]) revert AlreadyAnchored(receiptHash);
        (bool valid, address signer) = _verify(receiptHash, modelFingerprint, signature);
        if (!valid) revert InvalidReceipt();
        anchored[receiptHash] = true;
        emit ReceiptAnchored(receiptHash, signer, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _verify(bytes32 receiptHash, bytes32 modelFingerprint, bytes calldata signature)
        internal
        view
        returns (bool valid, address signer)
    {
        signer = _recover(_toEthSignedMessageHash(receiptHash), signature);
        if (signer == address(0)) return (false, address(0));
        valid = registry.isTrustedSigner(signer) && registry.isActiveFingerprint(modelFingerprint);
    }

    /// @dev EIP-191 version 0x45: "\x19Ethereum Signed Message:\n32" ++ hash.
    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32 digest) {
        /// @solidity memory-safe-assembly
        assembly {
            mstore(0x00, "\x19Ethereum Signed Message:\n32")
            mstore(0x1c, hash)
            digest := keccak256(0x00, 0x3c)
        }
    }

    /// @dev Strict ecrecover: 65-byte r||s||v only, v in {27,28}, s in the lower half order.
    ///      Returns address(0) on any failure instead of reverting.
    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        /// @solidity memory-safe-assembly
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        if (uint256(s) > _HALF_N) return address(0);
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
