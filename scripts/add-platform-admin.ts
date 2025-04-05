// npx hardhat run scripts/add-platform-admin.ts --network baseSepolia
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
    console.error('Error: Deployer must be a platform admin to add new admins')
    return
  }

  // Address of the new admin to add
  const newAdminAddress = '0x4de20fcbe8f5c9a029cb014d27e40a1b72e8d7f9'

  try {
    // Check if the address is already an admin
    const isAlreadyAdmin = await platformAdmin.isPlatformAdmin(newAdminAddress)

    if (isAlreadyAdmin) {
      console.log(`Address ${newAdminAddress} is already a platform admin`)
      return
    }

    console.log(`Adding ${newAdminAddress} as a platform admin...`)

    // Add the new platform admin
    const tx = await platformAdmin.addPlatformAdmin(newAdminAddress)
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    await tx.wait()
    console.log('Platform admin added successfully!')

    // Verify the address is now an admin
    const isAdmin = await platformAdmin.isPlatformAdmin(newAdminAddress)
    console.log(`Is address now a platform admin? ${isAdmin}`)
  } catch (error) {
    console.error('Error adding platform admin:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
