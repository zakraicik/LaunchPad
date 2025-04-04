// npx hardhat run scripts/deauthorize-campaign-factory.ts --network baseSepolia

import { ethers } from 'hardhat'
import {
  CampaignEventCollector,
  CampaignContractFactory,
  IERC20Metadata,
  Campaign
} from '../typechain-types'

async function main () {
  const [deployer] = await ethers.getSigners()
  console.log(`Using account: ${deployer.address}`)

  // Load the deployed addresses
  const deployedAddresses = require('../deployed-addresses.json')

  // Campaign parameters
  const tokenAddress = '0x0f2559677a6cf88b48bbfadde1757d4f302c8e23'
  const fundingGoal = 1000
  const durationDays = 30

  try {
    // Connect to the token contract
    const token = (await ethers.getContractAt(
      'IERC20Metadata',
      tokenAddress
    )) as IERC20Metadata

    // Get token decimals for proper amount formatting
    const decimals = await token.decimals()
    const formattedFundingGoal = ethers.parseUnits(
      fundingGoal.toString(),
      decimals
    )

    console.log(`Campaign Details:`)
    console.log(`- Token: ${tokenAddress}`)
    console.log(
      `- Funding Goal: ${fundingGoal} tokens (${formattedFundingGoal} wei)`
    )
    console.log(`- Duration: ${durationDays} days`)

    // Connect to the CampaignContractFactory
    const campaignFactory = (await ethers.getContractAt(
      'CampaignContractFactory',
      deployedAddresses.CampaignContractFactory
    )) as CampaignContractFactory

    const campaignEventCollector = (await ethers.getContractAt(
      'CampaignEventCollector',
      deployedAddresses.CampaignEventCollector
    )) as CampaignEventCollector

    console.log(`Authorizing campaign factory...`)

    await campaignEventCollector.deauthorizeFactory(
      await campaignFactory.getAddress()
    )

    console.log(
      `Campaign factory deauthorized: ${await campaignFactory.getAddress()}`
    )
  } catch (error) {
    console.error('Error deploying campaign:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
