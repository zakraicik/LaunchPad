// npx hardhat run scripts/update-fee-share.ts --network baseSepolia
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

  // New fee share in basis points (e.g., 250 = 2.5%)
  // Note: This is just an example value, adjust as needed
  const newFeeShareBasisPoints = 250

  try {
    // Get current fee share
    const currentFeeShare = await feeManager.platformFeeShare()
    console.log(
      `Current platform fee share: ${currentFeeShare} basis points (${
        Number(currentFeeShare) / 100
      }%)`
    )

    // Update the fee share
    console.log(
      `Setting new platform fee share to ${newFeeShareBasisPoints} basis points (${
        newFeeShareBasisPoints / 100
      }%)...`
    )

    const tx = await feeManager.updatePlatformFeeShare(newFeeShareBasisPoints)
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    await tx.wait()
    console.log('Platform fee share updated successfully!')

    // Verify the new fee share
    const updatedFeeShare = await feeManager.platformFeeShare()
    console.log(
      `Updated platform fee share: ${updatedFeeShare} basis points (${
        Number(updatedFeeShare) / 100
      }%)`
    )

    if (updatedFeeShare.toString() === newFeeShareBasisPoints.toString()) {
      console.log('Fee share update confirmed on-chain.')
    } else {
      console.error(
        'Fee share did not update correctly. Please check the transaction.'
      )
    }
  } catch (error) {
    console.error('Error updating platform fee share:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
