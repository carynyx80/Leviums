// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LeviumRegistry} from "../src/LeviumRegistry.sol";
import {LeviumVerifier} from "../src/LeviumVerifier.sol";

/// @notice Deploys LeviumRegistry + LeviumVerifier to BNB Smart Chain mainnet (chainId 56)
///         and registers the backend attestation signer.
///
/// Env:
///   PRIVATE_KEY     deployer key (becomes registry owner)
///   SIGNER_ADDRESS  backend node attestation key address to trust
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url bsc --broadcast --verify
contract Deploy is Script {
    uint256 internal constant BSC_MAINNET = 56;

    function run() external returns (LeviumRegistry registry, LeviumVerifier verifier) {
        require(block.chainid == BSC_MAINNET, "Deploy: BNB Smart Chain mainnet (56) only");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address signer = vm.envAddress("SIGNER_ADDRESS");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        registry = new LeviumRegistry(deployer);
        verifier = new LeviumVerifier(registry);
        registry.setSigner(signer, true);
        vm.stopBroadcast();

        console2.log("Deployer / owner:", deployer);
        console2.log("LeviumRegistry:  ", address(registry));
        console2.log("LeviumVerifier:  ", address(verifier));
        console2.log("Trusted signer:  ", signer);
    }
}
