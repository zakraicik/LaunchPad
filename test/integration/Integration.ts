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
  const WBTC = '0x0555e30da8f98308edb960aa94c0db47230d2b9c' //Wrapped BTCC on base

  // Constants for testing

  const GRACE_PERIOD = 7 // 7 days grace period

  let usdc: IERC20Metadata
  let dai: IERC20Metadata
  let wbtc: IERC20Metadata

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
      contributor2,
      contributor3
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

    wbtc = (await ethers.getContractAt(
      IERC20ABI,
      WBTC
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
    await tokenRegistry.addToken(USDC_ADDRESS, 1)
    await tokenRegistry.addToken(DAI_ADDRESS, 1)

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
    await usdc
      .connect(usdc_whale)
      .transfer(contributor3.address, usdTransferAmount, {
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
    await dai
      .connect(dai_whale)
      .transfer(contributor3.address, daiTransferAmount, {
        gasLimit: 100000, // Adjust based on the complexity of the transfer
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
      })

    return {
      usdc,
      dai,
      wbtc,
      deployer,
      creator1,
      creator2,

      contributor1,
      contributor2,
      contributor3,
      platformTreasury,
      platformAdmin,
      tokenRegistry,
      yieldDistributor,
      defiIntegrationManager,
      campaignContractFactory
    }
  }

  describe('Campaign Creation', function () {
    const ERR_INVALID_ADDRESS = 1
    const ERR_TOKEN_NOT_SUPPORTED = 2
    const ERR_INVALID_GOAL = 3
    const ERR_INVALID_DURATION = 4
    const OP_CAMPAIGN_CREATED = 1

    it('Deploy supporting contracts and set initial state correctly', async function () {
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

    it('Should reject campaign with token that is not in token registry', async function () {
      const { creator1, wbtc, campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      const CAMPAIGN_GOAL = ethers.parseUnits('500', 18)
      const CAMPAIGN_DURATION = 60

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await wbtc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_TOKEN_NOT_SUPPORTED,
          ethers.getAddress(await wbtc.getAddress()),
          0
        )
    })

    it('Should reject campaign with token that is  in token registry but not supported', async function () {
      const { creator1, wbtc, campaignContractFactory, tokenRegistry } =
        await loadFixture(deployPlatformFixture)

      const CAMPAIGN_GOAL = ethers.parseUnits('500', 18)
      const CAMPAIGN_DURATION = 60

      const wbtcDecimals = await wbtc.decimals()
      await tokenRegistry.addToken(await wbtc.getAddress(), wbtcDecimals)

      await tokenRegistry.disableTokenSupport(await wbtc.getAddress())

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await wbtc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_TOKEN_NOT_SUPPORTED,
          ethers.getAddress(await wbtc.getAddress()),
          0
        )
    })

    it('Should reject campaign with zero goal amount', async function () {
      const { creator1, usdc, campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      const ZERO_GOAL = 0
      const CAMPAIGN_DURATION = 60

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), ZERO_GOAL, CAMPAIGN_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(ERR_INVALID_GOAL, ethers.ZeroAddress, 0)
    })

    it('Should allow creates to deploy a campaign(s)', async function () {
      const { usdc, campaignContractFactory, creator1 } = await loadFixture(
        deployPlatformFixture
      )

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

    it('Should reject campaign with zero goal amount', async function () {
      const { creator1, usdc, campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      const ZERO_GOAL = 0
      const CAMPAIGN_DURATION = 60

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), ZERO_GOAL, CAMPAIGN_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(ERR_INVALID_GOAL, ethers.ZeroAddress, 0)
    })

    it('Should reject campaign with zero duration', async function () {
      const { creator1, usdc, campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const ZERO_DURATION = 0

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, ZERO_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(ERR_INVALID_DURATION, ethers.ZeroAddress, 0)
    })

    it('Should reject campaign with excessive duration', async function () {
      const { creator1, usdc, campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const EXCESSIVE_DURATION = 366 // > 365 days

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, EXCESSIVE_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(ERR_INVALID_DURATION, ethers.ZeroAddress, EXCESSIVE_DURATION)
    })

    it('Should reject campaign with zero address for token', async function () {
      const { creator1, campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      const CAMPAIGN_GOAL = ethers.parseUnits('500', 18)
      const CAMPAIGN_DURATION = 60

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(ethers.ZeroAddress, CAMPAIGN_GOAL, CAMPAIGN_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })
  })
  describe('Campaign Contribution', function () {
    const ERR_CAMPAIGN_NOT_ACTIVE = 6
    const ERR_GOAL_REACHED = 8
    const ERR_INVALID_AMOUNT = 5
    const ERR_CAMPAIGN_STILL_ACTIVE = 7
    const ERR_CALCULATION_IN_PROGRESS = 17
    const ERR_CALCULATION_COMPLETE = 16

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

      if (!contributeReceipt1) {
        throw new Error('Transaction failed')
      }

      const contributionEvent = contributeReceipt1.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent) {
        throw new Error('Event failed')
      }

      const parsedContributionEvent =
        campaign.interface.parseLog(contributionEvent)

      if (!parsedContributionEvent) {
        throw new Error('Event failed')
      }

      expect(parsedContributionEvent.args.contributor).to.equal(
        contributor1.address
      )
      expect(parsedContributionEvent.args.amount).to.equal(contributionAmount)

      expect(await campaign.firstContributor()).to.equal(contributor1.address)
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(1)

      const contributionAmount2 = ethers.parseUnits('200', usdcDecimals)

      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      const contributeTx2 = await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount2)

      if (!contributeTx2) {
        throw new Error('Transaction failed')
      }

      const contributeReceipt2 = await contributeTx2.wait()

      if (!contributeReceipt2) {
        throw new Error('Transaction failed')
      }

      const contributionEvent2 = contributeReceipt2.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent2) {
        throw new Error('Event failed')
      }

      const parsedContributionEvent2 =
        campaign.interface.parseLog(contributionEvent2)

      if (!parsedContributionEvent2) {
        throw new Error('Event failed')
      }

      expect(parsedContributionEvent2.args.contributor).to.equal(
        contributor2.address
      )
      expect(parsedContributionEvent2.args.amount).to.equal(contributionAmount2)

      expect(await campaign.contributions(contributor1.address)).to.equal(
        contributionAmount
      )
      expect(await campaign.contributions(contributor2.address)).to.equal(
        contributionAmount2
      )

      expect(await campaign.totalAmountRaised()).to.equal(
        contributionAmount + contributionAmount2
      )

      expect(await usdc.balanceOf(campaignAddress)).to.equal(
        contributionAmount + contributionAmount2
      )

      // After the second contribution
      expect(await campaign.firstContributor()).to.equal(contributor2.address)
      expect(await campaign.nextContributor(contributor2.address)).to.equal(
        contributor1.address
      )
      expect(await campaign.isContributor(contributor2.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(2)

      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount2)

      const contributeTx3 = await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount2)

      if (!contributeTx3) {
        throw new Error('Transaction failed')
      }

      const contributeReceipt3 = await contributeTx3.wait()

      if (!contributeReceipt3) {
        throw new Error('Transaction failed')
      }

      const contributionEvent3 = contributeReceipt3.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent3) {
        throw new Error('Event failed')
      }

      const parsedContributionEvent3 =
        campaign.interface.parseLog(contributionEvent3)

      if (!parsedContributionEvent3) {
        throw new Error('Event failed')
      }
      expect(await campaign.contributions(contributor1.address)).to.equal(
        contributionAmount + contributionAmount2
      )

      expect(await campaign.firstContributor()).to.equal(contributor2.address)
      expect(await campaign.nextContributor(contributor2.address)).to.equal(
        contributor1.address
      )
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.isContributor(contributor2.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(2)
    })

    it('Should not allow contributions after campaign is end date has passed', async function () {
      const { creator1, contributor1, usdc, campaignContractFactory } =
        await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60 // 60 days

      // Create a campaign
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

      // Fast forward time to after campaign end date
      const campaignDuration = await campaign.campaignDuration()
      await time.increase((Number(campaignDuration) + 1) * 24 * 60 * 60)

      // Verify campaign is no longer active
      expect(await campaign.isCampaignActive()).to.be.false

      // Attempt to contribute after campaign has ended
      const contributionAmount = ethers.parseUnits('100', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      // Contribution should be rejected
      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_CAMPAIGN_NOT_ACTIVE, ethers.ZeroAddress, 0)
    })

    it('Should not allow contributions after campaign goal is reached', async function () {
      const {
        creator1,
        contributor1,
        contributor2,
        usdc,
        campaignContractFactory
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60 // 60 days

      // Create a campaign
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

      // First contribution - exactly the goal amount
      const contributionAmount = ethers.parseUnits('500', usdcDecimals) // Using parseUnits here
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)
      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount)

      // Verify goal has been reached
      expect(await campaign.totalAmountRaised()).to.equal(CAMPAIGN_GOAL)
      expect(await campaign.isCampaignSuccessful()).to.be.true

      // Try to contribute after goal has been reached
      const secondContributionAmount = ethers.parseUnits('50', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, secondContributionAmount)

      // This contribution should be rejected
      await expect(
        campaign
          .connect(contributor2)
          .contribute(await usdc.getAddress(), secondContributionAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_GOAL_REACHED, ethers.ZeroAddress, CAMPAIGN_GOAL)
    })

    it('Should not allow contributions below the minimum contribution amount', async function () {
      const {
        creator1,
        contributor1,
        usdc,
        tokenRegistry,
        campaignContractFactory
      } = await loadFixture(deployPlatformFixture)

      const ERR_INVALID_AMOUNT = 5

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60 // 60 days

      // Create a campaign
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

      const [minAmountRaw, decimals] =
        await tokenRegistry.getMinContributionAmount(await usdc.getAddress())
      const minAmountInToken = ethers.formatUnits(minAmountRaw, decimals)

      const halfMinAmount = Number(minAmountInToken) / 2
      // Try to contribute less than minimum amount (0.5 USDC)
      const belowMinAmount = ethers.parseUnits(
        halfMinAmount.toString(),
        usdcDecimals
      )
      await usdc.connect(contributor1).approve(campaignAddress, belowMinAmount)

      // This contribution should be rejected
      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), belowMinAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_INVALID_AMOUNT, ethers.ZeroAddress, belowMinAmount)
    })

    it('Should allow contributions at the minimum contribution amount', async function () {
      const {
        creator1,
        contributor1,
        usdc,
        tokenRegistry,
        campaignContractFactory
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60 // 60 days

      // Create a campaign
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

      // Get exact minimum contribution amount
      const [minAmountRaw, decimals] =
        await tokenRegistry.getMinContributionAmount(await usdc.getAddress())

      // Approve and contribute the exact minimum amount
      await usdc.connect(contributor1).approve(campaignAddress, minAmountRaw)

      // This contribution should succeed
      const contributeTx = await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), minAmountRaw)

      const contributeReceipt = await contributeTx.wait()

      if (!contributeReceipt) {
        throw new Error('Transaction failed')
      }

      // Verify the Contribution event was emitted
      const contributionEvent = contributeReceipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent) {
        throw new Error('Event failed')
      }

      const parsedContributionEvent =
        campaign.interface.parseLog(contributionEvent)

      if (!parsedContributionEvent) {
        throw new Error('Event failed')
      }

      // Verify contribution details
      expect(parsedContributionEvent.args.contributor).to.equal(
        contributor1.address
      )
      expect(parsedContributionEvent.args.amount).to.equal(minAmountRaw)
      expect(await campaign.contributions(contributor1.address)).to.equal(
        minAmountRaw
      )
      expect(await campaign.totalAmountRaised()).to.equal(minAmountRaw)
    })

    it('Should allow very large contributions which end the campaign', async function () {
      const { creator1, contributor1, usdc, campaignContractFactory } =
        await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60 // 60 days

      // Create a campaign
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

      // Make a contribution larger than the goal (600 USDC > 500 USDC goal)
      const largeAmount = ethers.parseUnits('500000', usdcDecimals)
      await usdc.connect(contributor1).approve(campaignAddress, largeAmount)

      // This contribution should succeed
      const contributeTx = await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), largeAmount)

      const contributeReceipt = await contributeTx.wait()

      if (!contributeReceipt) {
        throw new Error('Transaction failed')
      }

      // Verify the Contribution event was emitted with correct amount
      const contributionEvent = contributeReceipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent) {
        throw new Error('Event failed')
      }

      const parsedContributionEvent =
        campaign.interface.parseLog(contributionEvent)

      if (!parsedContributionEvent) {
        throw new Error('Event failed')
      }

      // Verify contribution details
      expect(parsedContributionEvent.args.contributor).to.equal(
        contributor1.address
      )
      expect(parsedContributionEvent.args.amount).to.equal(largeAmount)

      // Verify campaign state
      expect(await campaign.contributions(contributor1.address)).to.equal(
        largeAmount
      )
      expect(await campaign.totalAmountRaised()).to.equal(largeAmount)
      expect(await campaign.isCampaignSuccessful()).to.be.true

      // Try to make another contribution (should be rejected)
      const ERR_GOAL_REACHED = 8
      const additionalAmount = ethers.parseUnits('10', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, additionalAmount)

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), additionalAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_GOAL_REACHED, ethers.ZeroAddress, largeAmount)
    })

    it('Should calculate weighted contributions correctly for all contributors', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2,
        contributor3
      } = await loadFixture(deployPlatformFixture)

      // Define expected weight multipliers based on CampaignLibrary
      const expectedWeight1Multiplier = 15000 // 1.5x weight for early contributor (first 25%)
      const expectedWeight2Multiplier = 12500 // 1.25x weight for mid-early contributor (25%-50%)
      const expectedWeight3Multiplier = 11000 // 1.1x weight for mid-late contributor (50%-75%)
      const expectedWeight4Multiplier = 10000 // 1.0x weight for late contributor (75%-100%)

      const usdcDecimals = await usdc.decimals()

      // Use a shorter campaign duration for testing
      const CAMPAIGN_DURATION = 30 // 30 days
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)

      // Create a campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })
      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      const contributionAmount = ethers.parseUnits('100', usdcDecimals)

      // First contribution from contributor1 (very early in the campaign)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)
      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount) //Contributor 1 locks in 1.5x yield
      const latestBlock1 = await ethers.provider.getBlock('latest')
      if (!latestBlock1) throw new Error('Latest block not found')

      // Advance time by 1/4 of campaign duration
      await time.increase((CAMPAIGN_DURATION * 24 * 60 * 60) / 4)

      // First contribution from contributor2 (at ~25% of campaign duration)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount)
      await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount) //Contributor 2 locks in 1.25x yield
      const latestBlock2 = await ethers.provider.getBlock('latest')
      if (!latestBlock2) throw new Error('Latest block not found')

      // Advance time to 50% of campaign duration
      await time.increase((CAMPAIGN_DURATION * 24 * 60 * 60) / 4)

      // Second contribution from contributor1 (at ~50% of campaign duration)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)
      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount) //100 * 1.1 = 110
      const latestBlock3 = await ethers.provider.getBlock('latest')
      if (!latestBlock3) throw new Error('Latest block not found')

      // Advance time to 75% of campaign duration
      await time.increase((CAMPAIGN_DURATION * 24 * 60 * 60) / 4)

      // Second contribution from contributor2 (at ~75% of campaign duration)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount)
      await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount)

      await usdc
        .connect(contributor3)
        .approve(campaignAddress, contributionAmount)
      await campaign
        .connect(contributor3)
        .contribute(await usdc.getAddress(), contributionAmount)

      const latestBlock4 = await ethers.provider.getBlock('latest')
      if (!latestBlock4) throw new Error('Latest block not found')

      // Verify campaign is still active
      expect(await campaign.isCampaignActive()).to.be.true

      // Attempting to calculate weighted contributions while campaign is active should fail
      await expect(campaign.calculateWeightedContributions())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)

      // Move past campaign end
      await time.increase(CAMPAIGN_DURATION * 24 * 60 * 60)

      // Verify campaign is no longer active
      expect(await campaign.isCampaignActive()).to.be.false

      // Calculate weighted contributions
      const weightedTx = await campaign.calculateWeightedContributions() //150 + 125 + 150 + 125 = 550
      const weightedReceipt = await weightedTx.wait()
      if (!weightedReceipt) throw new Error('Transaction failed')

      // Find the YieldSharesCalculationUpdate event
      const yieldSharesEvent = weightedReceipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'YieldSharesCalculationUpdate'
        } catch {
          return false
        }
      })
      if (!yieldSharesEvent)
        throw new Error('YieldSharesCalculationUpdate event not emitted')

      const parsedYieldEvent = campaign.interface.parseLog(yieldSharesEvent)
      if (!parsedYieldEvent) throw new Error('Event failed')

      expect(parsedYieldEvent.args.processedCount).to.equal(3)
      expect(parsedYieldEvent.args.isComplete).to.be.true
      expect(parsedYieldEvent.args.totalProcessed).to.equal(3)

      // Get weighted contributions for both contributors
      const weight1 = await campaign.weightedContributions(contributor1.address)
      const weight2 = await campaign.weightedContributions(contributor2.address)
      const weight3 = await campaign.weightedContributions(contributor3.address)

      // Calculate expected weights - each contributor made two contributions at different times
      const expectedWeight1 =
        (BigInt(2) *
          BigInt(contributionAmount) *
          BigInt(expectedWeight1Multiplier)) /
        BigInt(10000)

      const expectedWeight2 =
        (BigInt(2) *
          BigInt(contributionAmount) *
          BigInt(expectedWeight2Multiplier)) /
        BigInt(10000)

      const expectedWeight3 =
        (BigInt(contributionAmount) * BigInt(expectedWeight4Multiplier)) /
        BigInt(10000)

      // Check that each contributor's calculated weight matches our expected calculation
      expect(weight1).to.equal(expectedWeight1)
      expect(weight2).to.equal(expectedWeight2)
      expect(weight3).to.equal(expectedWeight3)

      // Verify that early contributor has higher weight since their first contribution was earlier
      expect(weight1).to.be.gt(weight2).to.be.gt(weight3)

      // Check total weighted contributions
      const totalWeighted = await campaign.totalWeightedContributions()
      expect(totalWeighted).to.equal(weight1 + weight2 + weight3)

      // Verify calculation is marked as complete
      expect(await campaign.weightedContributionsCalculated()).to.be.true

      // Attempting to calculate again should fail
      await expect(campaign.calculateWeightedContributions())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_CALCULATION_COMPLETE, ethers.ZeroAddress, 0)
    })
  })
})
