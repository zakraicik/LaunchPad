// npx hardhat run scripts/get-aToken-balance.ts --network baseMainnet
import { ethers } from 'hardhat'
import { DefiIntegrationManager } from '../typechain-types'

// Simple ERC20 ABI with just the functions we need
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function main () {
  const [deployer] = await ethers.getSigners()
  console.log(`Using account: ${deployer.address}`)

  // Load the deployed addresses
  const deployedAddresses = require('../deployed-addresses.json')

  // Connect to the DefiIntegrationManager contract
  const defiIntegrationManager = (await ethers.getContractAt(
    'DefiIntegrationManager',
    deployedAddresses['baseMainnet'].DefiIntegrationManager
  )) as DefiIntegrationManager

  try {
    // Get the aave pool address and aToken address
    const aavePoolAddress = await defiIntegrationManager.aavePool()
    const aTokenAddress = await defiIntegrationManager.getATokenAddress(
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    )
    
    console.log(`aavePoolAddress: ${aavePoolAddress}`)
    console.log(`aTokenAddress: ${aTokenAddress}`)
    
    // Address to check balance for
    const addressToCheck = '0x5dd8f05dc609f38ef989de2651c93ff70bd27626'; // Replace with the address you want to check
    
    // Get the aToken contract instance
    const aTokenContract = new ethers.Contract(aTokenAddress, ERC20_ABI, deployer);
    
    // Get the token symbol
    const symbol = await aTokenContract.symbol();
    
    // Get the balance
    const balance = await aTokenContract.balanceOf(addressToCheck);
    
    // Get the decimals to format the balance properly
    const decimals = await aTokenContract.decimals();
    
    // Format the balance
    const formattedBalance = ethers.formatUnits(balance, decimals);
    
    console.log(`aToken (${symbol}) balance for ${addressToCheck}: ${formattedBalance}`);
    
  } catch (error) {
    console.log(`Error: ${error}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })