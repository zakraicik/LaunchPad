// npx hardhat run scripts/get-aToken-address.ts --network baseMainnet
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
    deployedAddresses['baseMainnet'].DefiIntegrationManager
  )) as DefiIntegrationManager

  try {
    const aavePoolAddress = await defiIntegrationManager.aavePool()
    const aTokenAddress = await defiIntegrationManager.getATokenAddress(
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
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
