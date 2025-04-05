// npx hardhat run scripts/update-treasury.ts --network baseSepolia
import { ethers } from 'hardhat'
import { PlatformAdmin, FeeManager } from '../typechain-types'

async function main () {
  const [deployer] = await ethers.getSigners()
  console.log(`Using account: ${deployer.address}`)

  // Load the deployed addresses
  const deployedAddresses = require('../deployed-addresses.json')

  // Connect to the PlatformAdmin contract
  const platformAdmin = (await ethers.getContractAt(
    'PlatformAdmin',
    deployedAddresses.PlatformAdmin
  )) as PlatformAdmin

  // Check if the deployer is a platform admin
  const isAdmin = await platformAdmin.isPlatformAdmin(deployer.address)
  console.log(`Is deployer a platform admin? ${isAdmin}`)

  if (!isAdmin) {
    console.error('Deployer is not a platform admin. Cannot proceed.')
    return
  }

  const feeManager = (await ethers.getContractAt(
    'FeeManager',
    deployedAddresses.FeeManager
  )) as FeeManager

  // New treasury address
  // Replace this with your new treasury address
  const newTreasuryAddress = '0xbf8e22884d8d91434bc162ff6514f61dbd6fa67a'

  try {
    // Get current treasury address
    const currentTreasury = await feeManager.platformTreasury()
    console.log(`Current treasury address: ${currentTreasury}`)

    // Validate new treasury address
    if (!ethers.isAddress(newTreasuryAddress)) {
      console.error('Invalid treasury address format')
      return
    }

    if (newTreasuryAddress.toLowerCase() === currentTreasury.toLowerCase()) {
      console.log(
        'New treasury address is the same as the current one. Nothing to update.'
      )
      return
    }

    // Update the treasury address
    console.log(`Setting new treasury address to: ${newTreasuryAddress}...`)

    const tx = await feeManager.updatePlatformTreasury(newTreasuryAddress)
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    await tx.wait()
    console.log('Treasury address updated successfully!')

    // Verify the new treasury address
    const updatedTreasury = await feeManager.platformTreasury()
    console.log(`Updated treasury address: ${updatedTreasury}`)

    if (updatedTreasury.toLowerCase() === newTreasuryAddress.toLowerCase()) {
      console.log('Treasury address update confirmed on-chain.')
    } else {
      console.error(
        'Treasury address did not update correctly. Please check the transaction.'
      )
    }
  } catch (error) {
    console.error('Error updating treasury address:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
