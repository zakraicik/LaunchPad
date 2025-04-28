// scripts/verify-contracts.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Starting contract verification on Base Mainnet...");
  
  // Load deployed addresses
  const addressFilePath = 'deployed-addresses.json';
  if (!fs.existsSync(addressFilePath)) {
    console.error("Deployed addresses file not found. Run deployment script first.");
    return;
  }
  
  const deployedAddresses = JSON.parse(fs.readFileSync(addressFilePath, 'utf8'));
  const NETWORK_NAME = 'baseMainnet';
  
  if (!deployedAddresses[NETWORK_NAME]) {
    console.error(`No deployed contracts found for ${NETWORK_NAME}`);
    return;
  }
  
  const addresses = deployedAddresses[NETWORK_NAME];
  
  // Constants from deployment
  const AAVE_POOL_ADDRESS = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5';
  const PLATFORM_TREASURY_ADDRESS = '0x8A36d0369Af1fdd14CeAd56a3b623fb2dbdC05a4';
  
  // Get deployer account for constructor args
  const [deployer] = await hre.ethers.getSigners();
  
  // Verify PlatformAdmin
  if (addresses.PlatformAdmin) {
    try {
      console.log(`Verifying PlatformAdmin at ${addresses.PlatformAdmin}...`);
      await hre.run("verify:verify", {
        address: addresses.PlatformAdmin,
        constructorArguments: [deployer.address],
      });
      console.log("PlatformAdmin verified successfully");
    } catch (error: any) {
      console.error("Error verifying PlatformAdmin:", error.message);
    }
  }
  
  // Verify TokenRegistry
  if (addresses.TokenRegistry) {
    try {
      console.log(`Verifying TokenRegistry at ${addresses.TokenRegistry}...`);
      await hre.run("verify:verify", {
        address: addresses.TokenRegistry,
        constructorArguments: [deployer.address, addresses.PlatformAdmin],
      });
      console.log("TokenRegistry verified successfully");
    } catch (error: any) {
      console.error("Error verifying TokenRegistry:", error.message);
    }
  }
  
  // Verify FeeManager
  if (addresses.FeeManager) {
    try {
      console.log(`Verifying FeeManager at ${addresses.FeeManager}...`);
      await hre.run("verify:verify", {
        address: addresses.FeeManager,
        constructorArguments: [
          PLATFORM_TREASURY_ADDRESS,
          addresses.PlatformAdmin,
          deployer.address
        ],
      });
      console.log("FeeManager verified successfully");
    } catch (error: any) {
      console.error("Error verifying FeeManager:", error.message);
    }
  }
  
  // Verify DefiIntegrationManager
  if (addresses.DefiIntegrationManager) {
    try {
      console.log(`Verifying DefiIntegrationManager at ${addresses.DefiIntegrationManager}...`);
      await hre.run("verify:verify", {
        address: addresses.DefiIntegrationManager,
        constructorArguments: [
          AAVE_POOL_ADDRESS,
          addresses.TokenRegistry,
          addresses.FeeManager,
          addresses.PlatformAdmin,
          deployer.address
        ],
      });
      console.log("DefiIntegrationManager verified successfully");
    } catch (error: any) {
      console.error("Error verifying DefiIntegrationManager:", error.message);
    }
  }
  
  // Verify CampaignEventCollector
  if (addresses.CampaignEventCollector) {
    try {
      console.log(`Verifying CampaignEventCollector at ${addresses.CampaignEventCollector}...`);
      await hre.run("verify:verify", {
        address: addresses.CampaignEventCollector,
        constructorArguments: [addresses.PlatformAdmin, deployer.address],
      });
      console.log("CampaignEventCollector verified successfully");
    } catch (error: any) {
      console.error("Error verifying CampaignEventCollector:", error.message);
    }
  }
  
  // Verify CampaignContractFactory
  if (addresses.CampaignContractFactory) {
    try {
      console.log(`Verifying CampaignContractFactory at ${addresses.CampaignContractFactory}...`);
      await hre.run("verify:verify", {
        address: addresses.CampaignContractFactory,
        constructorArguments: [
          addresses.DefiIntegrationManager,
          addresses.PlatformAdmin,
          addresses.CampaignEventCollector,
          deployer.address
        ],
      });
      console.log("CampaignContractFactory verified successfully");
    } catch (error: any) {
      console.error("Error verifying CampaignContractFactory:", error.message);
    }
  }
  
  console.log("Contract verification process completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });