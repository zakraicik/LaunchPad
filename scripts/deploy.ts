import { ethers } from 'hardhat'
import { writeFileSync } from 'fs'

const AAVE_POOL_ADDRESS = '0x6ae43d3271ff6888e7fc43fd7321a503ff738951' // AAVE v3 on base sepolia
const USDC_ADDRESS = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238' //On base sepolia
const platformTreasuryAddress = '0xbf8e22884d8d91434bc162ff6514f61dbd6fa67a'

async function main () {
  console.log('Deploying contracts to Base Sepolia...')

  // Get deployer account
  const [deployer] = await ethers.getSigners()

  console.log(`Deploying with account: ${deployer.address}`)

  const deployedAddresses: Record<string, string> = {}

  //Deploy platform admin contract
  const PlatformAdmin = await ethers.getContractFactory('PlatformAdmin')
  const platformAdmin = await PlatformAdmin.deploy(deployer.address)
  await platformAdmin.waitForDeployment()

  const platformAdminAddress = await platformAdmin.getAddress()
  deployedAddresses['PlatformAdmin'] = platformAdminAddress
  console.log(`PlatformAdmin deployed to: ${platformAdminAddress}`)

  const TokenRegistry = await ethers.getContractFactory('TokenRegistry')
  const tokenRegistry = await TokenRegistry.deploy(
    deployer.address,
    platformAdminAddress
  )

  await tokenRegistry.waitForDeployment()
  const tokenRegistryAddress = await tokenRegistry.getAddress()
  deployedAddresses['TokenRegistry'] = tokenRegistryAddress
  console.log(`TokenRegistry deployed to: ${tokenRegistryAddress}`)

  const FeeManager = await ethers.getContractFactory('FeeManager')
  const feeManager = await FeeManager.deploy(
    platformTreasuryAddress,
    platformAdminAddress,
    deployer.address
  )

  await feeManager.waitForDeployment()
  const feeManagerAddress = await feeManager.getAddress()
  deployedAddresses['FeeManager'] = feeManagerAddress
  console.log(`FeeManager deployed to: ${feeManagerAddress}`)

  const DefiIntegrationManager = await ethers.getContractFactory(
    'DefiIntegrationManager'
  )
  const defiIntegrationManager = await DefiIntegrationManager.deploy(
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

  const CampaignContractFactory = await ethers.getContractFactory(
    'CampaignContractFactory'
  )
  const campaignContractFactory = await CampaignContractFactory.deploy(
    defiIntegrationManagerAddress,
    platformAdminAddress,
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
