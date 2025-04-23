// npx hardhat run scripts/authorize-campaign-factory.ts --network baseSepolia

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


  try {
   
    const campaignFactory = (await ethers.getContractAt(
      'CampaignContractFactory',
      deployedAddresses['baseMainnet'].CampaignContractFactory
    )) as CampaignContractFactory

    const campaignEventCollector = (await ethers.getContractAt(
      'CampaignEventCollector',
      deployedAddresses['baseMainnet'].CampaignEventCollector
    )) as CampaignEventCollector

    console.log(`Authorizing campaign factory...`)

    await campaignEventCollector.authorizeFactory(
      await campaignFactory.getAddress()
    )

    console.log(`Campaign factory authorized successfully!`)
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
