// npx hardhat run scripts/enable-admin-override.ts --network baseSepolia

import { ethers } from 'hardhat'
import { CampaignEventCollector, Campaign } from '../typechain-types'

async function main () {
  const [deployer] = await ethers.getSigners()
  console.log(`Using account: ${deployer.address}`)

  // Campaign parameters
  const campaignAddress = '0x1066d85d868754a9be9ece44b0db93dbd388d438'

  try {
    const campaign = (await ethers.getContractAt(
      'Campaign',
      campaignAddress
    )) as Campaign

    console.log(`Enabling Admin Overide`)

    await campaign.setAdminOverride(true)

    console.log(`Campaign admin override enabled: ${campaignAddress}`)
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
