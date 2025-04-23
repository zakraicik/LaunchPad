//npx hardhat run scripts/deploy-mainnet.ts --network baseMainnet

import { ethers } from 'hardhat'
import { writeFileSync,existsSync,readFileSync } from 'fs'

const AAVE_POOL_ADDRESS = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' 
const PLATFORM_TREASURY_ADDRESS = '0x8A36d0369Af1fdd14CeAd56a3b623fb2dbdC05a4'
const NETWORK_NAME = 'baseMainnet'

async function main () {
  console.log('Deploying contracts to Base Mainnet...')

  // Get deployer account
  const [deployer] = await ethers.getSigners()

  console.log(`Deploying with account: ${deployer.address}`)

  const deployedAddresses: Record<string, Record<string, string>> = {}
  const addressFilePath = 'deployed-addresses.json'
  if (existsSync(addressFilePath)) {
    try {
      const existingData = JSON.parse(readFileSync(addressFilePath, 'utf8'))
      Object.assign(deployedAddresses, existingData)

    } catch (error) {
      console.log('No valid existing addresses file found, creating new one')
    }
  }

  if (!deployedAddresses[NETWORK_NAME]) {
    deployedAddresses[NETWORK_NAME] = {}
  }

  const platformAdminFactory = await ethers.getContractFactory('PlatformAdmin')
  const platformAdmin = await platformAdminFactory.deploy(deployer.address)
  await platformAdmin.waitForDeployment()

  const platformAdminAddress = await platformAdmin.getAddress()
  deployedAddresses[NETWORK_NAME]['PlatformAdmin'] = platformAdminAddress
  console.log(`PlatformAdmin deployed to: ${platformAdminAddress}`)

  const tokenRegistryFactory = await ethers.getContractFactory('TokenRegistry')
  const tokenRegistry = await tokenRegistryFactory.deploy(
    deployer.address,
    platformAdminAddress
  )

  await tokenRegistry.waitForDeployment()
  const tokenRegistryAddress = await tokenRegistry.getAddress()
  deployedAddresses[NETWORK_NAME]['TokenRegistry'] = tokenRegistryAddress
  console.log(`TokenRegistry deployed to: ${tokenRegistryAddress}`)

  const feeManagerFactory = await ethers.getContractFactory('FeeManager')
  const feeManager = await feeManagerFactory.deploy(
    PLATFORM_TREASURY_ADDRESS,
    platformAdminAddress,
    deployer.address
  )

  await feeManager.waitForDeployment()
  const feeManagerAddress = await feeManager.getAddress()
  deployedAddresses[NETWORK_NAME]['FeeManager'] = feeManagerAddress
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
  deployedAddresses[NETWORK_NAME]['DefiIntegrationManager'] = defiIntegrationManagerAddress
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
  deployedAddresses[NETWORK_NAME]['CampaignEventCollector'] = campaignEventCollectorAddress
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
  deployedAddresses[NETWORK_NAME]['CampaignContractFactory'] = campaignContractFactoryAddress
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
