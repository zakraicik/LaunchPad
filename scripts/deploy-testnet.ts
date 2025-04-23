//npx hardhat run scripts/deploy.ts --network baseSepolia

import { ethers } from 'hardhat'
import { writeFileSync } from 'fs'

const AAVE_POOL_ADDRESS = '0x6ae43d3271ff6888e7fc43fd7321a503ff738951' 
const PLATFORM_TREASURY_ADDRESS = '0xbf8e22884d8d91434bc162ff6514f61dbd6fa67a'

async function main () {
  console.log('Deploying contracts to Base Sepolia...')

  // Get deployer account
  const [deployer] = await ethers.getSigners()

  console.log(`Deploying with account: ${deployer.address}`)

  const deployedAddresses: Record<string, string> = {}

  // Deploy PlatformAdmin contract
  const platformAdminFactory = await ethers.getContractFactory('PlatformAdmin')
  const platformAdmin = await platformAdminFactory.deploy(deployer.address)
  await platformAdmin.waitForDeployment()

  const platformAdminAddress = await platformAdmin.getAddress()
  deployedAddresses['PlatformAdmin'] = platformAdminAddress
  console.log(`PlatformAdmin deployed to: ${platformAdminAddress}`)

  const tokenRegistryFactory = await ethers.getContractFactory('TokenRegistry')
  const tokenRegistry = await tokenRegistryFactory.deploy(
    deployer.address,
    platformAdminAddress
  )

  await tokenRegistry.waitForDeployment()
  const tokenRegistryAddress = await tokenRegistry.getAddress()
  deployedAddresses['TokenRegistry'] = tokenRegistryAddress
  console.log(`TokenRegistry deployed to: ${tokenRegistryAddress}`)

  const feeManagerFactory = await ethers.getContractFactory('FeeManager')
  const feeManager = await feeManagerFactory.deploy(
    PLATFORM_TREASURY_ADDRESS,
    platformAdminAddress,
    deployer.address
  )

  await feeManager.waitForDeployment()
  const feeManagerAddress = await feeManager.getAddress()
  deployedAddresses['FeeManager'] = feeManagerAddress
  console.log(`FeeManager deployed to: ${feeManagerAddress}`)

  const defiIntegrationManagerFactory = await ethers.getContractFactory(
    'DefiIntegrationManager'
  )
  const defiIntegrationManager = await defiIntegrationManagerFactory.deploy(
    AAVE_POOL_ADDRESS,
    tokenRegistryAddress,
    feeManagerAddress,
    platformAdminAddress,
    deployer.address
  )
  await defiIntegrationManager.waitForDeployment()
  const defiIntegrationManagerAddress =
    await defiIntegrationManager.getAddress()
  deployedAddresses['DefiIntegrationManager'] = defiIntegrationManagerAddress
  console.log(
    `DefiIntegrationManager deployed to: ${defiIntegrationManagerAddress}`
  )

  const campaignEventCollectorFactory = await ethers.getContractFactory(
    'CampaignEventCollector'
  )

  const campaignEventCollector = await campaignEventCollectorFactory.deploy(
    platformAdminAddress,
    deployer.address
  )
  await campaignEventCollector.waitForDeployment()

  const campaignEventCollectorAddress =
    await campaignEventCollector.getAddress()
  deployedAddresses['CampaignEventCollector'] = campaignEventCollectorAddress
  console.log(
    `CampaignEventCollector deployed to: ${campaignEventCollectorAddress}`
  )

  const campaignContractFactoryFactory = await ethers.getContractFactory(
    'CampaignContractFactory'
  )
  const campaignContractFactory = await campaignContractFactoryFactory.deploy(
    defiIntegrationManagerAddress,
    platformAdminAddress,
    campaignEventCollectorAddress,
    deployer.address
  )
  await campaignContractFactory.waitForDeployment()
  const campaignContractFactoryAddress =
    await campaignContractFactory.getAddress()
  deployedAddresses['CampaignContractFactory'] = campaignContractFactoryAddress
  console.log(
    `CampaignContractFactory deployed to: ${campaignContractFactoryAddress}`
  )

  // Save deployed addresses to a file
  console.log('Saving deployed addresses...')
  writeFileSync(
    'deployed-addresses.json',
    JSON.stringify(deployedAddresses, null, 2)
  )
  console.log('Deployment complete! Addresses saved to deployed-addresses.json')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
