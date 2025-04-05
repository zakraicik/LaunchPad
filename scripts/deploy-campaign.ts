// npx hardhat run scripts/deploy-campaign.ts --network baseSepolia

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
  const tokenAddress = '0x036cbd53842c5426634e7929541ec2318f3dcf7e' //USDC
  const fundingGoal = 2
  const durationDays = 1

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

    // console.log(`Authorizing campaign factory...`)

    // await campaignEventCollector.authorizeFactory(
    //   await campaignFactory.getAddress()
    // )

    console.log(`Deploying campaign...`)

    // Deploy a new campaign
    const tx = await campaignFactory.deploy(
      await token.getAddress(),
      formattedFundingGoal,
      durationDays
    )
    console.log(`Transaction hash: ${tx.hash}`)

    // Wait for the transaction to be mined
    const receipt = await tx.wait()

    if (!receipt) {
      throw new Error('Transaction failed')
    }

    // Find the FactoryOperation event to get the deployed campaign address
    const event = receipt.logs.find(log => {
      try {
        const parsed = campaignFactory.interface.parseLog(log)
        return parsed && parsed.name === 'FactoryOperation'
      } catch {
        return false
      }
    })

    if (!event) {
      throw new Error('FactoryOperation event not found')
    }

    const parsedEvent = campaignFactory.interface.parseLog(event)
    if (!parsedEvent) {
      throw new Error('Failed to parse event')
    }

    const campaignAddress = parsedEvent.args[1]
    console.log(`Campaign deployed successfully at: ${campaignAddress}`)

    // Connect to the deployed campaign
    const campaign = (await ethers.getContractAt(
      'Campaign',
      campaignAddress
    )) as Campaign

    // Retrieve and display campaign details for verification

    console.log(`\nCampaign Details Verification:`)
    console.log(`- Creator: ${await campaign.owner()}`)
    console.log(`- Token: ${await campaign.campaignToken()}`)
    console.log(
      `- Funding Goal: ${ethers.formatUnits(
        await campaign.campaignGoalAmount(),
        decimals
      )} tokens`
    )
    console.log(
      `- End Time: ${new Date(
        Number(await campaign.campaignEndTime()) * 1000
      ).toLocaleString()}`
    )
    console.log(`- Status: ${Number(await campaign.campaignStatus())}`)
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
