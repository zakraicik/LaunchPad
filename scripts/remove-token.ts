//npx hardhat run scripts/remove-token.ts --network baseMainnet
import { ethers } from "hardhat";
import { PlatformAdmin, TokenRegistry } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);

  // Load the deployed addresses
  const deployedAddresses = require("../deployed-addresses.json");

  // Connect to the contracts
  const platformAdmin = (await ethers.getContractAt(
    "PlatformAdmin",
    deployedAddresses["baseMainnet"].PlatformAdmin
  )) as PlatformAdmin;

  const tokenRegistry = (await ethers.getContractAt(
    "TokenRegistry",
    deployedAddresses["baseMainnet"].TokenRegistry
  )) as TokenRegistry;

  const tokenAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  try {
    // Check if token is in the registry
    try {
      const isSupported = await tokenRegistry.isTokenSupported(tokenAddress);
      console.log(`Token is in registry. Supported status: ${isSupported}`);
    } catch (error) {
      console.log("Token is not in registry, nothing to remove.");
      return;
    }

    console.log("Removing token from registry...");
    let tx = await tokenRegistry.removeToken(tokenAddress);
    await tx.wait();
    console.log("Token removed successfully!");

    // Verify the token is no longer in the registry
    try {
      await tokenRegistry.isTokenSupported(tokenAddress);
      console.log("Error: Token is still in registry.");
    } catch (error) {
      console.log("Success: Token is no longer in registry.");
    }
  } catch (error) {
    console.error("Error removing token:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
