// npx hardhat run scripts/remove-platform-admin.ts --network baseSepolia
import { ethers } from 'hardhat'
import { PlatformAdmin } from '../typechain-types'

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
  const isDeployerAdmin = await platformAdmin.isPlatformAdmin(deployer.address)
  console.log(`Is deployer a platform admin? ${isDeployerAdmin}`)

  if (!isDeployerAdmin) {
    console.error('Error: Deployer must be a platform admin to remove admins')
    return
  }

  // Address of the admin to remove
  const adminToRemove = '0x4de20fcbe8f5c9a029cb014d27e40a1b72e8d7f9'

  // Prevent removing yourself accidentally
  if (adminToRemove.toLowerCase() === deployer.address.toLowerCase()) {
    console.error(
      'Warning: You are attempting to remove yourself as an admin. Operation aborted.'
    )
    return
  }

  try {
    // Check if the address is currently an admin
    const isAdmin = await platformAdmin.isPlatformAdmin(adminToRemove)

    if (!isAdmin) {
      console.log(`Address ${adminToRemove} is not a platform admin`)
      return
    }

    console.log(`Removing ${adminToRemove} from platform admins...`)

    // Remove the platform admin
    const tx = await platformAdmin.removePlatformAdmin(adminToRemove)
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    await tx.wait()
    console.log('Platform admin removed successfully!')

    // Verify the address is no longer an admin
    const isStillAdmin = await platformAdmin.isPlatformAdmin(adminToRemove)
    console.log(`Is address still a platform admin? ${isStillAdmin}`)
  } catch (error) {
    console.error('Error removing platform admin:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
