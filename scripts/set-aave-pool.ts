// npx hardhat run scripts/set-aave-pool.ts --network baseSepolia

import { ethers } from 'hardhat'
import { DefiIntegrationManager } from '../typechain-types'
import { PlatformAdmin } from '../typechain-types'

async function main () {
  const [deployer] = await ethers.getSigners()
  console.log(`Using account: ${deployer.address}`)

  // Load the deployed addresses
  const deployedAddresses = require('../deployed-addresses.json')

  // Connect to the DefiIntegrationManager contract
  const defiManager = (await ethers.getContractAt(
    'DefiIntegrationManager',
    deployedAddresses.DefiIntegrationManager
  )) as DefiIntegrationManager

  // Connect to PlatformAdmin to verify permissions
  const platformAdmin = (await ethers.getContractAt(
    'PlatformAdmin',
    deployedAddresses.PlatformAdmin
  )) as PlatformAdmin

  // Check if the deployer is a platform admin
  const isDeployerAdmin = await platformAdmin.isPlatformAdmin(deployer.address)
  console.log(`Is deployer a platform admin? ${isDeployerAdmin}`)

  if (!isDeployerAdmin) {
    console.error(
      'Error: Deployer must be a platform admin to update token registry'
    )
    return
  }

  // Address of the new token registry
  const newAavePool = defiManager.aavePool()

  try {
    // Get current token registry address for comparison
    const currentAavePool = await defiManager.aavePool()
    console.log(`Current aave pool address: ${currentAavePool}`)

    // Set the new token registry
    const tx = await defiManager.setAavePool(newAavePool)
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    await tx.wait()
    console.log('Aave pool updated successfully!')

    // Verify the new token registry address
    const updatedAavePool = await defiManager.aavePool()
    console.log(`New Aave pool address: ${updatedAavePool}`)
  } catch (error) {
    console.error('Error updating aave pool:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
