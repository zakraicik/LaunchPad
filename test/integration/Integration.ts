import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { Contract } from 'ethers'

import { time } from '@nomicfoundation/hardhat-network-helpers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import {
  PlatformAdmin,
  TokenRegistry,
  YieldDistributor,
  DefiIntegrationManager,
  CampaignContractFactory,
  Campaign,
  IERC20Metadata
} from '../../typechain-types'

describe('Base Mainnet Integration Tests', function () {
  //Whales
  const USDC_WHALE_ADDRESS = '0x0b0a5886664376f59c351ba3f598c8a8b4d0a6f3'
  const DAI_WHALE_ADDRESS = '0x0772f014009162efb833ef34d3ea3f243fc735ba'

  // External contracts addresses
  const UNISWAP_QUOTER_ADDRESS = '0x3d4e44eb1374240ce5f1b871ab261cd16335b76a' //Uniswap Quoter V3
  const UNISWAP_ROUTER_ADDRESS = '0x6ff5693b99212da76ad316178a184ab56d299b43' //uniswap Router V3
  const AAVE_POOL_ADDRESS = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5' //AAVE v3
  const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' //USDC on Base
  const DAI_ADDRESS = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' //DAI on Base

  // Constants for testing

  const GRACE_PERIOD = 7 // 7 days grace period

  let usdc: IERC20Metadata
  let dai: IERC20Metadata

  let uniswapRouter: Contract
  let uniswapQuoter: Contract
  let aavePool: Contract
  let platformAdmin: PlatformAdmin
  let tokenRegistry: TokenRegistry
  let yieldDistributor: YieldDistributor
  let defiIntegrationManager: DefiIntegrationManager
  let campaignContractFactory: CampaignContractFactory
  let campaign: Campaign

  // Main fixture that deploys the entire platform and sets up test environment
  async function deployPlatformFixture () {
    // Impersonate the ETH whale

    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [USDC_WHALE_ADDRESS]
    })

    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [DAI_WHALE_ADDRESS]
    })

    const usdc_whale = await ethers.getSigner(USDC_WHALE_ADDRESS)

    const dai_whale = await ethers.getSigner(DAI_WHALE_ADDRESS)

    const [
      deployer,
      platformTreasury,
      creator1,
      creator2,
      contributor1,
      contributor2
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

    // Uniswap Router ABI for testing
    const UNISWAP_ROUTER_ABI = [
      'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
      'function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
      'function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amounts)'
    ]

    // Uniswap Quoter ABI for testing
    const UNISWAP_QUOTER_ABI = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
      'function quoteExactInput(bytes memory path, uint256 amountIn) external returns (uint256 amountOut)'
    ]

    // Aave Pool ABI for testing
    const AAVE_POOL_ABI = [
      'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
      'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
      'function getReserveData(address asset) external view returns (tuple(uint256 unbacked, uint256 accruedToTreasury, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp))'
    ]

    // Initialize contracts with signer using getContractAt to fund contributor accounts
    dai = (await ethers.getContractAt(
      IERC20ABI,
      DAI_ADDRESS
    )) as unknown as IERC20Metadata

    usdc = (await ethers.getContractAt(
      IERC20ABI,
      USDC_ADDRESS
    )) as unknown as IERC20Metadata

    // Send ETH to whales
    await deployer.sendTransaction({
      to: USDC_WHALE_ADDRESS,
      value: ethers.parseEther('5.0'),
      gasLimit: 21000,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    })

    await deployer.sendTransaction({
      to: DAI_WHALE_ADDRESS,
      value: ethers.parseEther('5.0'),
      gasLimit: 21000,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    })

    uniswapRouter = await ethers.getContractAt(
      UNISWAP_ROUTER_ABI,
      UNISWAP_ROUTER_ADDRESS
    )
    uniswapQuoter = await ethers.getContractAt(
      UNISWAP_QUOTER_ABI,
      UNISWAP_QUOTER_ADDRESS
    )
    aavePool = await ethers.getContractAt(AAVE_POOL_ABI, AAVE_POOL_ADDRESS)

    //Deploy PlatformAdmin
    platformAdmin = await ethers.deployContract(
      'PlatformAdmin',
      [GRACE_PERIOD, deployer.address],
      {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: 3000000
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
        gasLimit: 3000000
      }
    )

    await tokenRegistry.waitForDeployment()

    //Add tokens to TokenRegistry
    await tokenRegistry.addToken(USDC_ADDRESS, await usdc.decimals())
    await tokenRegistry.addToken(DAI_ADDRESS, await dai.decimals())

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
        gasLimit: 3000000
      }
    )

    await yieldDistributor.waitForDeployment()

    defiIntegrationManager = await ethers.deployContract(
      'DefiIntegrationManager',
      [
        AAVE_POOL_ADDRESS,
        UNISWAP_ROUTER_ADDRESS,
        UNISWAP_QUOTER_ADDRESS,
        await tokenRegistry.getAddress(),
        await yieldDistributor.getAddress(),
        await platformAdmin.getAddress(),
        deployer.address
      ],
      {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: 3000000
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
        gasLimit: 5000000
      }
    )

    await campaignContractFactory.waitForDeployment()

    //Fund Contributors
    const usdcDecimals = await usdc.decimals()
    const usdTransferAmount = ethers.parseUnits('1000000', usdcDecimals)

    const daiDecimals = await dai.decimals()
    const daiTransferAmount = ethers.parseUnits('100000', daiDecimals)

    await usdc
      .connect(usdc_whale)
      .transfer(contributor1.address, usdTransferAmount, {
        gasLimit: 100000, // Adjust based on the complexity of the transfer
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
      })
    await usdc
      .connect(usdc_whale)
      .transfer(contributor2.address, usdTransferAmount, {
        gasLimit: 100000, // Adjust based on the complexity of the transfer
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
      })

    await dai
      .connect(dai_whale)
      .transfer(contributor1.address, daiTransferAmount, {
        gasLimit: 100000, // Adjust based on the complexity of the transfer
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
      })
    await dai
      .connect(dai_whale)
      .transfer(contributor2.address, daiTransferAmount, {
        gasLimit: 100000, // Adjust based on the complexity of the transfer
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
      })

    return {
      usdc,
      dai,
      deployer,
      creator1,
      creator2,
      contributor1,
      contributor2,
      platformTreasury,
      platformAdmin,
      tokenRegistry,
      yieldDistributor,
      defiIntegrationManager,
      campaignContractFactory
    }
  }

  describe('Base Mainnet Fork Tests', function () {
    it('Deployment & Initial State', async function () {
      const {
        deployer,
        platformTreasury,
        platformAdmin,
        tokenRegistry,
        yieldDistributor,
        defiIntegrationManager,
        campaignContractFactory
      } = await loadFixture(deployPlatformFixture)

      //PlatformAdmin
      expect(await platformAdmin.owner()).to.equal(deployer.address)
      expect(await platformAdmin.gracePeriod()).to.equal(GRACE_PERIOD)

      //TokenRegistry
      expect(await tokenRegistry.owner()).to.equal(deployer.address)
      expect(await tokenRegistry.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )

      //YieldDistributor
      expect(await yieldDistributor.owner()).to.equal(deployer.address)
      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )
      expect(await yieldDistributor.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )

      //DefiIntegrationManager
      expect(await defiIntegrationManager.owner()).to.equal(deployer.address)
      expect(await defiIntegrationManager.aavePool()).to.equal(
        ethers.getAddress(AAVE_POOL_ADDRESS)
      )
      expect(await defiIntegrationManager.uniswapRouter()).to.equal(
        ethers.getAddress(UNISWAP_ROUTER_ADDRESS)
      )
      expect(await defiIntegrationManager.uniswapQuoter()).to.equal(
        ethers.getAddress(UNISWAP_QUOTER_ADDRESS)
      )
      expect(await defiIntegrationManager.tokenRegistry()).to.equal(
        ethers.getAddress(await tokenRegistry.getAddress())
      )
      expect(await defiIntegrationManager.yieldDistributor()).to.equal(
        ethers.getAddress(await yieldDistributor.getAddress())
      )

      expect(await defiIntegrationManager.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )

      //CampaignContractFactory
      expect(await campaignContractFactory.owner()).to.equal(deployer.address)
      expect(await campaignContractFactory.defiManager()).to.equal(
        await defiIntegrationManager.getAddress()
      )
      expect(await campaignContractFactory.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )
    })

    describe('Campaign Operations', function () {
      it('Should allow creates to deploy a campaign(s)', async function () {
        const { usdc, campaignContractFactory, creator1 } = await loadFixture(
          deployPlatformFixture
        )

        const usdcDecimals = await usdc.decimals()

        const OP_CAMPAIGN_CREATED = 1
        const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
        const CAMPAIGN_DURATION = 60

        const tx = await campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

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

        expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

        const campaignAddress = parsedEvent.args[1]

        expect(parsedEvent.args[2]).to.equal(creator1.address)
        expect(await campaignContractFactory.deployedCampaigns(0)).to.equal(
          campaignAddress
        )
        expect(
          await campaignContractFactory.creatorToCampaigns(creator1.address, 0)
        ).to.equal(campaignAddress)

        const Campaign = await ethers.getContractFactory('Campaign')
        const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

        expect(await campaign.owner()).to.equal(creator1.address)
        expect(await campaign.campaignToken()).to.equal(
          ethers.getAddress(await usdc.getAddress())
        )
        expect(await campaign.campaignGoalAmount()).to.equal(CAMPAIGN_GOAL)
        expect(await campaign.campaignDuration()).to.equal(CAMPAIGN_DURATION)
        expect(await campaign.isCampaignActive()).to.be.true
      })

      it('Should allow multiple contributors to fund a campaign in target token', async function () {
        const {
          usdc,
          campaignContractFactory,
          creator1,
          contributor1,
          contributor2
        } = await loadFixture(deployPlatformFixture)

        const usdcDecimals = await usdc.decimals()
        const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
        const CAMPAIGN_DURATION = 60

        const tx = await campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

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

        const contributionAmount = ethers.parseUnits('100', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(campaignAddress, contributionAmount)

        const contributeTx1 = await campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)

        if (!contributeTx1) {
          throw new Error('Transaction failed')
        }

        const contributeReceipt1 = await contributeTx1.wait()
      })
    })
  })
})
