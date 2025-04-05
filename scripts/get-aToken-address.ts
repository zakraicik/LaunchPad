// npx hardhat run scripts/get-aToken-address.ts --network baseSepolia
import { ethers } from 'hardhat'
import { DefiIntegrationManager } from '../typechain-types'

async function main () {
  const [deployer] = await ethers.getSigners()
  console.log(`Using account: ${deployer.address}`)

  // Load the deployed addresses
  const deployedAddresses = require('../deployed-addresses.json')

  // Connect to the PlatformAdmin contract
  const defiIntegrationManager = (await ethers.getContractAt(
    'DefiIntegrationManager',
    deployedAddresses.DefiIntegrationManager
  )) as DefiIntegrationManager

  try {
    const aavePoolAddress = await defiIntegrationManager.aavePool()
    const aTokenAddress = await defiIntegrationManager.getATokenAddress(
      '0x036cbd53842c5426634e7929541ec2318f3dcf7e'
    )

    console.log(`aavePoolAddress: ${aavePoolAddress}`)
    console.log(`aTokenAddress: ${aTokenAddress}`)
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
