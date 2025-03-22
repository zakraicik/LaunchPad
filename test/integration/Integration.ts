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
      params: [WBTC_WHALE_ADDRESS]
    })

    const usdc_whale = await ethers.getSigner(USDC_WHALE_ADDRESS)
    const wbtc_whale = await ethers.getSigner(WBTC_WHALE_ADDRESS)

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
      platformAdmin,
      tokenRegistry,
      yieldDistributor,
      defiIntegrationManager,
      campaignContractFactory
    }
  }

  describe('Campaign Mechanics', function () {
    const ERR_INVALID_ADDRESS = 1
    const ERR_TOKEN_NOT_SUPPORTED = 2
    const ERR_INVALID_GOAL = 3
    const ERR_INVALID_DURATION = 4
    const OP_CAMPAIGN_CREATED = 1

    describe('Campaign Creation', function () {
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
          .to.be.revertedWithCustomError(
            campaignContractFactory,
            'FactoryError'
          )
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
          .to.be.revertedWithCustomError(
            campaignContractFactory,
            'FactoryError'
          )
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
          .to.be.revertedWithCustomError(
            campaignContractFactory,
            'FactoryError'
          )
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
          .to.be.revertedWithCustomError(
            campaignContractFactory,
            'FactoryError'
          )
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
          .to.be.revertedWithCustomError(
            campaignContractFactory,
            'FactoryError'
          )
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
          .to.be.revertedWithCustomError(
            campaignContractFactory,
            'FactoryError'
          )
          .withArgs(
            ERR_INVALID_DURATION,
            ethers.ZeroAddress,
            EXCESSIVE_DURATION
          )
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
          .to.be.revertedWithCustomError(
            campaignContractFactory,
            'FactoryError'
          )
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
      })
    })

    describe('Successful Campaign Completion', function () {})

    describe('Unuccessful Campaign Completion', function () {})
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

      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      const contributeTx1 = await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount)

      if (!contributeTx1) throw new Error('Transaction failed')

      const contributeReceipt1 = await contributeTx1.wait()
      if (!contributeReceipt1) throw new Error('Transaction failed')

      const contributionEvent = contributeReceipt1.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent) throw new Error('Event failed')

      const parsedContributionEvent =
        campaign.interface.parseLog(contributionEvent)
      if (!parsedContributionEvent) throw new Error('Event failed')

      expect(parsedContributionEvent.args.contributor).to.equal(
        contributor1.address
      )
      expect(parsedContributionEvent.args.amount).to.equal(contributionAmount)

      // Keep these checks
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(1)

      const contributionAmount2 = ethers.parseUnits('200', usdcDecimals)

      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      const contributeTx2 = await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount2)

      if (!contributeTx2) throw new Error('Transaction failed')

      const contributeReceipt2 = await contributeTx2.wait()
      if (!contributeReceipt2) throw new Error('Transaction failed')

      const contributionEvent2 = contributeReceipt2.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent2) throw new Error('Event failed')

      const parsedContributionEvent2 =
        campaign.interface.parseLog(contributionEvent2)
      if (!parsedContributionEvent2) throw new Error('Event failed')

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

      // Keep these checks, remove linked list checks
      expect(await campaign.isContributor(contributor2.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(2)

      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount2)

      const contributeTx3 = await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount2)

      if (!contributeTx3) throw new Error('Transaction failed')

      const contributeReceipt3 = await contributeTx3.wait()
      if (!contributeReceipt3) throw new Error('Transaction failed')

      const contributionEvent3 = contributeReceipt3.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent3) throw new Error('Event failed')

      const parsedContributionEvent3 =
        campaign.interface.parseLog(contributionEvent3)
      if (!parsedContributionEvent3) throw new Error('Event failed')

      expect(await campaign.contributions(contributor1.address)).to.equal(
        contributionAmount + contributionAmount2
      )

      // Keep these checks, remove linked list checks
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.isContributor(contributor2.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(2)
    })

    it('Should not allow contributions in non-target token', async function () {
      const {
        wbtc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2
      } = await loadFixture(deployPlatformFixture)

      const wbtcDecimals = await wbtc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', wbtcDecimals)
      const CAMPAIGN_DURATION = 60
      const ERR_NOT_TARGET_TOKEN = 15

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

      const contributionAmount = ethers.parseUnits('100', wbtcDecimals)

      await wbtc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await wbtc.getAddress(), contributionAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_NOT_TARGET_TOKEN,
          ethers.getAddress(await wbtc.getAddress()),
          0
        )
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

    it('Should allow a contribution that exceeds the goal', async function () {
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
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event not found')
      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event parsing failed')

      const campaignAddress = parsedEvent.args[1]
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // First contribution: 400 USDC (below goal)
      const firstContribution = ethers.parseUnits('400', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, firstContribution)
      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), firstContribution)

      // Verify campaign state after first contribution
      expect(await campaign.totalAmountRaised()).to.equal(firstContribution)
      expect(await campaign.isCampaignSuccessful()).to.be.false

      // Second contribution: 150 USDC (exceeds goal by 50 USDC)
      const secondContribution = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, secondContribution)

      // This contribution should be accepted even though it exceeds the goal
      const contributeTx = await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), secondContribution)

      const contributeReceipt = await contributeTx.wait()
      if (!contributeReceipt) throw new Error('Transaction failed')

      // Find and verify the Contribution event
      const contributionEvent = contributeReceipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent) throw new Error('Contribution event not found')
      const parsedContributionEvent =
        campaign.interface.parseLog(contributionEvent)
      if (!parsedContributionEvent) throw new Error('Event parsing failed')

      // Verify contribution was processed correctly
      expect(parsedContributionEvent.args.contributor).to.equal(
        contributor2.address
      )
      expect(parsedContributionEvent.args.amount).to.equal(secondContribution)

      // Verify campaign state after the goal-exceeding contribution
      const expectedTotal = firstContribution + secondContribution
      expect(await campaign.totalAmountRaised()).to.equal(expectedTotal)
      expect(await campaign.isCampaignSuccessful()).to.be.true

      // Additional contribution should now be rejected since goal is reached
      const thirdContribution = ethers.parseUnits('10', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, thirdContribution)

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), thirdContribution)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_GOAL_REACHED, ethers.ZeroAddress, expectedTotal)
    })
  })

  describe('Yield Generation', function () {
    it('Should enable campaign creator to deposit yield into campaign', async function () {
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
    })
  })
})
