import { ethers, network } from 'hardhat'
import { Contract } from 'ethers'

import {
  PlatformAdmin,
  TokenRegistry,
  YieldDistributor,
  DefiIntegrationManager,
  CampaignContractFactory,
  Campaign,
  IERC20Metadata
} from '../typechain-types'

const USDC_WHALE_ADDRESS = '0x0b0a5886664376f59c351ba3f598c8a8b4d0a6f3'
const WBTC_WHALE_ADDRESS = '0x48cce57c4d2dbb31eaf79575abf482bbb8dc071d'

// External contracts addresses
const AAVE_POOL_ADDRESS = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5' //AAVE v3
const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' //USDC on Base
const WBTC = '0x0555e30da8f98308edb960aa94c0db47230d2b9c' //Wrapped BTC on base

// Constants for testing

const GRACE_PERIOD = 7 // 7 days grace period
const GAS_LIMIT = 5000000

let usdc: IERC20Metadata
let wbtc: IERC20Metadata

let aavePool: Contract
let platformAdmin: PlatformAdmin
let tokenRegistry: TokenRegistry
let yieldDistributor: YieldDistributor
let defiIntegrationManager: DefiIntegrationManager
let campaignContractFactory: CampaignContractFactory

export async function deployPlatformFixture () {
  // Impersonate the ETH whale

  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [USDC_WHALE_ADDRESS]
  })

  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [WBTC_WHALE_ADDRESS]
  })

  const usdc_whale = await ethers.getSigner(USDC_WHALE_ADDRESS)
  const wbtc_whale = await ethers.getSigner(WBTC_WHALE_ADDRESS)

  const [
    deployer,
    platformTreasury,
    platformTreasury2,
    creator1,
    creator2,
    contributor1,
    contributor2,
    contributor3,
    otherAdmin
  ] = await ethers.getSigners() //All accounts are prefunded with 10,000 ETH

  const feeData = await ethers.provider.getFeeData()
  const maxFeePerGas = feeData.maxFeePerGas
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas

  //USDC ABI for testing
  const IERC20ABI = [
    'function totalSupply() external view returns (uint256)',
    'function decimals() external view returns (uint8)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)'
  ]

  // Aave Pool ABI for testing
  const AAVE_POOL_ABI = [
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
    'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
    'function getReserveData(address asset) external view returns (tuple(uint256 unbacked, uint256 accruedToTreasury, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp))'
  ]

  // Initialize contracts with signer using getContractAt to fund contributor accounts

  usdc = (await ethers.getContractAt(
    IERC20ABI,
    USDC_ADDRESS
  )) as unknown as IERC20Metadata

  wbtc = (await ethers.getContractAt(
    IERC20ABI,
    WBTC
  )) as unknown as IERC20Metadata

  // Send ETH to whales
  await deployer.sendTransaction({
    to: USDC_WHALE_ADDRESS,
    value: ethers.parseEther('5.0'),
    gasLimit: GAS_LIMIT,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas
  })

  await deployer.sendTransaction({
    to: WBTC_WHALE_ADDRESS,
    value: ethers.parseEther('5.0'),
    gasLimit: GAS_LIMIT,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas
  })

  aavePool = await ethers.getContractAt(AAVE_POOL_ABI, AAVE_POOL_ADDRESS)

  //Deploy PlatformAdmin
  platformAdmin = await ethers.deployContract(
    'PlatformAdmin',
    [GRACE_PERIOD, deployer.address],
    {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: GAS_LIMIT
    }
  )

  await platformAdmin.waitForDeployment()

  //Deploy TokenRegistry
  tokenRegistry = await ethers.deployContract(
    'TokenRegistry',
    [deployer.address, await platformAdmin.getAddress()],
    {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: GAS_LIMIT
    }
  )

  await tokenRegistry.waitForDeployment()

  //Add tokens to TokenRegistry
  await tokenRegistry.addToken(USDC_ADDRESS, 1)

  yieldDistributor = await ethers.deployContract(
    'YieldDistributor',
    [
      platformTreasury.address,
      await platformAdmin.getAddress(),
      deployer.address
    ],
    {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: GAS_LIMIT
    }
  )

  await yieldDistributor.waitForDeployment()

  defiIntegrationManager = await ethers.deployContract(
    'DefiIntegrationManager',
    [
      AAVE_POOL_ADDRESS,
      await tokenRegistry.getAddress(),
      await yieldDistributor.getAddress(),
      await platformAdmin.getAddress(),
      deployer.address
    ],
    {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: GAS_LIMIT
    }
  )

  await defiIntegrationManager.waitForDeployment()

  campaignContractFactory = await ethers.deployContract(
    'CampaignContractFactory',
    [
      await defiIntegrationManager.getAddress(),
      await platformAdmin.getAddress(),
      deployer.address
    ],
    {
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: GAS_LIMIT
    }
  )

  await campaignContractFactory.waitForDeployment()

  //Fund Contributors
  const usdcDecimals = await usdc.decimals()
  const usdTransferAmount = ethers.parseUnits('1000000', usdcDecimals)

  const wbtcDecimals = await wbtc.decimals()
  const wbtcTransferAmount = ethers.parseUnits('.01', wbtcDecimals)

  await usdc
    .connect(usdc_whale)
    .transfer(contributor1.address, usdTransferAmount, {
      gasLimit: GAS_LIMIT, // Adjust based on the complexity of the transfer
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    })
  await usdc
    .connect(usdc_whale)
    .transfer(contributor2.address, usdTransferAmount, {
      gasLimit: GAS_LIMIT, // Adjust based on the complexity of the transfer
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    })
  await usdc
    .connect(usdc_whale)
    .transfer(contributor3.address, usdTransferAmount, {
      gasLimit: GAS_LIMIT, // Adjust based on the complexity of the transfer
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    })

  await wbtc
    .connect(wbtc_whale)
    .transfer(contributor1.address, wbtcTransferAmount, {
      gasLimit: GAS_LIMIT, // Adjust based on the complexity of the transfer
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    })

  const tx = await campaignContractFactory
    .connect(creator1)
    .deploy(
      await usdc.getAddress(),
      ethers.parseUnits('1000', usdcDecimals),
      30
    )

  const receipt = await tx.wait()

  if (!receipt) {
    throw new Error('Transaction failed')
  }

  const event = receipt.logs.find(log => {
    try {
      const parsed = campaignContractFactory.interface.parseLog(log)
      return parsed && parsed.name === 'FactoryOperation'
    } catch {
      return false
    }
  })

  if (!event) {
    throw new Error('Event failed')
  }

  const parsedEvent = campaignContractFactory.interface.parseLog(event)
  if (!parsedEvent) {
    throw new Error('Event failed')
  }

  const campaignAddress = parsedEvent.args[1]

  const Campaign = await ethers.getContractFactory('Campaign')
  const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

  return {
    usdc,
    wbtc,
    deployer,
    creator1,
    creator2,
    contributor1,
    contributor2,
    contributor3,
    platformTreasury,
    platformTreasury2,
    platformAdmin,
    tokenRegistry,
    yieldDistributor,
    defiIntegrationManager,
    campaignContractFactory,
    IERC20ABI,
    AAVE_POOL_ADDRESS,
    GRACE_PERIOD,
    otherAdmin,
    aavePool,
    campaign
  }
}
