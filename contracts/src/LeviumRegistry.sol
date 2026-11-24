// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILeviumRegistry} from "./interfaces/ILeviumRegistry.sol";

/// @title LeviumRegistry
/// @notice Owner-managed registry of Levium AI models and trusted attestation signers.
/// @dev A model is identified by a bytes32 id (e.g. keccak256("rugscan-v1")) and pinned to a
///      bytes32 fingerprint (sha256 of the model source/config, see SPEC.md). Each fingerprint can
///      belong to at most one model id, so deactivating a model id deactivates its fingerprint.
///      A new model version must be registered under a new id. Ownership uses a two-step transfer.
contract LeviumRegistry is ILeviumRegistry {
    /// @notice Levium company / treasury wallet on BNB Smart Chain mainnet.
    address public constant TREASURY = 0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76;

    struct Model {
        bytes32 fingerprint;
        string name;
        bool active;
    }

    address public owner;
    address public pendingOwner;

    /// @notice model id => model record. A zero fingerprint means "not registered".
    mapping(bytes32 => Model) private _models;
    /// @notice fingerprint => model id that owns it (zero if unused).
    mapping(bytes32 => bytes32) public modelIdOfFingerprint;
    /// @notice attestation signer => trusted.
    mapping(address => bool) public isTrustedSigner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ModelRegistered(bytes32 indexed modelId, bytes32 indexed fingerprint, string name);
    event ModelStatusChanged(bytes32 indexed modelId, bytes32 indexed fingerprint, bool active);
    event ModelNameChanged(bytes32 indexed modelId, string name);
    event SignerStatusChanged(address indexed signer, bool trusted);

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();
    error ZeroValue();
    error ModelAlreadyRegistered(bytes32 modelId);
    error ModelNotRegistered(bytes32 modelId);
    error FingerprintInUse(bytes32 fingerprint, bytes32 modelId);
    error EmptyName();
    error NoChange();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    // ---------------------------------------------------------------------
    // Ownership (two-step)
    // ---------------------------------------------------------------------

    /// @notice Starts an ownership transfer. Pass address(0) to cancel a pending transfer.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Completes an ownership transfer. Must be called by the pending owner.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previous = owner;
        owner = msg.sender;
        delete pendingOwner;
        emit OwnershipTransferred(previous, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Models
    // ---------------------------------------------------------------------

    /// @notice Registers a new, active model.
    function registerModel(bytes32 modelId, bytes32 fingerprint, string calldata name) external onlyOwner {
        if (modelId == bytes32(0) || fingerprint == bytes32(0)) revert ZeroValue();
        if (bytes(name).length == 0) revert EmptyName();
        if (_models[modelId].fingerprint != bytes32(0)) revert ModelAlreadyRegistered(modelId);
        bytes32 existing = modelIdOfFingerprint[fingerprint];
        if (existing != bytes32(0)) revert FingerprintInUse(fingerprint, existing);

        _models[modelId] = Model({fingerprint: fingerprint, name: name, active: true});
        modelIdOfFingerprint[fingerprint] = modelId;

        emit ModelRegistered(modelId, fingerprint, name);
        emit ModelStatusChanged(modelId, fingerprint, true);
    }

    /// @notice Activates or deactivates a registered model.
    function setModelActive(bytes32 modelId, bool active) external onlyOwner {
        Model storage m = _models[modelId];
        if (m.fingerprint == bytes32(0)) revert ModelNotRegistered(modelId);
        if (m.active == active) revert NoChange();
        m.active = active;
        emit ModelStatusChanged(modelId, m.fingerprint, active);
    }

    /// @notice Updates the human-readable name of a registered model.
    function setModelName(bytes32 modelId, string calldata name) external onlyOwner {
        Model storage m = _models[modelId];
        if (m.fingerprint == bytes32(0)) revert ModelNotRegistered(modelId);
        if (bytes(name).length == 0) revert EmptyName();
        m.name = name;
        emit ModelNameChanged(modelId, name);
    }

    function getModel(bytes32 modelId) external view returns (bytes32 fingerprint, string memory name, bool active) {
        Model storage m = _models[modelId];
        return (m.fingerprint, m.name, m.active);
    }

    /// @inheritdoc ILeviumRegistry
    function isActiveFingerprint(bytes32 fingerprint) external view returns (bool) {
        if (fingerprint == bytes32(0)) return false;
        bytes32 modelId = modelIdOfFingerprint[fingerprint];
        if (modelId == bytes32(0)) return false;
        return _models[modelId].active;
    }

    // ---------------------------------------------------------------------
    // Signers
    // ---------------------------------------------------------------------

    /// @notice Adds or removes a trusted attestation signer.
    function setSigner(address signer, bool trusted) external onlyOwner {
        if (signer == address(0)) revert ZeroAddress();
        if (isTrustedSigner[signer] == trusted) revert NoChange();
        isTrustedSigner[signer] = trusted;
        emit SignerStatusChanged(signer, trusted);
    }
}
