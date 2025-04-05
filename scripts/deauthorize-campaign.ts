// npx hardhat run scripts/deauthorize-campaign.ts --network baseSepolia

import { ethers } from 'hardhat'
import {
  CampaignEventCollector,
  CampaignContractFactory
} from '../typechain-types'

async function main () {
  const [deployer] = await ethers.getSigners()
  console.log(`Using account: ${deployer.address}`)

  // Load the deployed addresses
  const deployedAddresses = require('../deployed-addresses.json')

  // Campaign parameters
  const campaignAddress = '0x1066d85d868754a9be9ece44b0db93dbd388d438'

  try {
    const campaignFactory = (await ethers.getContractAt(
      'CampaignContractFactory',
      deployedAddresses.CampaignContractFactory
    )) as CampaignContractFactory

    // Connect to the CampaignContractFactory
    const camapaignEventCollector = (await ethers.getContractAt(
      'CampaignEventCollector',
      deployedAddresses.CampaignEventCollector
    )) as CampaignEventCollector

    console.log(`Deauthorize Campaign`)

    await camapaignEventCollector.deauthorizeCampaign(campaignAddress)

    console.log(`Campaign  deauthorized: ${campaignAddress}`)
  } catch (error) {
    console.error('Error deauthorizing campaign:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
