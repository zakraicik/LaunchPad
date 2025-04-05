//npx hardhat run scripts/add-token.ts --network baseSepolia
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

  const tokenRegistry = (await ethers.getContractAt(
    'TokenRegistry',
    deployedAddresses.TokenRegistry
  )) as TokenRegistry

  const usdcAddress = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'
  const minimumContributionInWholeTokens = 1

  try {
    // Check if token is already registered
    try {
      const isAlreadySupported = await tokenRegistry.isTokenSupported(
        usdcAddress
      )
      console.log(
        `Token is already in registry. Supported status: ${isAlreadySupported}`
      )
      return
    } catch (error) {
      // If this errors out, the token is not in the registry yet
      console.log('Token is not in registry yet, proceeding to add it...')
    }

    // Add the token to the registry
    const tx = await tokenRegistry.addToken(
      usdcAddress,
      minimumContributionInWholeTokens
    )
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    await tx.wait()
    console.log('Token added successfully!')

    // Verify the token is now supported
    const isSupported = await tokenRegistry.isTokenSupported(usdcAddress)
    console.log(`Is token supported: ${isSupported}`)
  } catch (error) {
    console.error('Error adding token:', error)
  }
}
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
