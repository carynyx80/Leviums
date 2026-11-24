// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ILeviumRegistry
/// @notice Read interface of the Levium model / attestation-signer registry.
interface ILeviumRegistry {
    function isTrustedSigner(address signer) external view returns (bool);

    function isActiveFingerprint(bytes32 fingerprint) external view returns (bool);
}
