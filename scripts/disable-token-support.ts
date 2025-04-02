// npx hardhat run scripts/disable-token-support.ts --network baseSepolia
import { ethers } from 'hardhat'
import { PlatformAdmin, TokenRegistry } from '../typechain-types'

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

  const tokenRegistry = (await ethers.getContractAt(
    'TokenRegistry',
    deployedAddresses.TokenRegistry
  )) as TokenRegistry

  const tokenAddress = '0x5deac602762362fe5f135fa5904351916053cf70'

  try {
    // Check if token is in the registry
    try {
      const isSupported = await tokenRegistry.isTokenSupported(tokenAddress)

      if (!isSupported) {
        console.log('Token support is already disabled. Nothing to do.')
        return
      } else {
        console.log(
          'Token is in registry and support is enabled. Disabling support...'
        )
      }
    } catch (error) {
      console.log(
        'Token is not in registry. Please add it first using add-token.ts script.'
      )
      return
    }

    // Disable token support
    const tx = await tokenRegistry.disableTokenSupport(tokenAddress)
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    await tx.wait()
    console.log('Token support disabled successfully!')

    // Verify the token is now disabled
    try {
      const isSupported = await tokenRegistry.isTokenSupported(tokenAddress)
      console.log(`Is token supported: ${isSupported} (should be false)`)
    } catch (error) {
      console.error(
        'Error checking token support status after disabling:',
        error
      )
    }
  } catch (error) {
    console.error('Error disabling token support:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
