// npx hardhat run scripts/change-minimum-contribution.ts --network baseSepolia
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
  const newMinimumContributionInWholeTokens = 2 // Update to desired amount (in whole tokens)

  try {
    // Check if token is in the registry
    try {
      await tokenRegistry.isTokenSupported(tokenAddress)
      console.log('Token is in registry. Proceeding...')
    } catch (error) {
      console.log(
        'Token is not in registry. Please add it first using add-token.ts script.'
      )
      return
    }

    // Get current minimum contribution
    try {
      const [currentMin, decimals] =
        await tokenRegistry.getMinContributionAmount(tokenAddress)
      console.log(
        `Current minimum contribution: ${ethers.formatUnits(
          currentMin,
          decimals
        )} tokens (${currentMin} in smallest unit)`
      )
      console.log(`Token decimals: ${decimals}`)
    } catch (error) {
      console.error('Error getting current minimum contribution:', error)
    }

    // Update minimum contribution
    console.log(
      `Setting new minimum contribution to ${newMinimumContributionInWholeTokens} whole tokens...`
    )
    const tx = await tokenRegistry.updateTokenMinimumContribution(
      tokenAddress,
      newMinimumContributionInWholeTokens
    )
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    await tx.wait()
    console.log('Minimum contribution updated successfully!')

    // Verify the new minimum contribution
    const [newMin, decimals] = await tokenRegistry.getMinContributionAmount(
      tokenAddress
    )
    console.log(
      `New minimum contribution: ${ethers.formatUnits(
        newMin,
        decimals
      )} tokens (${newMin} in smallest unit)`
    )
  } catch (error) {
    console.error('Error updating minimum contribution:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
