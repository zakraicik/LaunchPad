import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { Contract, Log } from 'ethers'

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
      campaignContractFactory,
      IERC20ABI
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
    })

    describe('Successful Campaign Completion', function () {})

    describe('Unuccessful Campaign Completion', function () {})
  })
  describe('Campaign Contribution', function () {
    const OP_DEPOSIT = 1

    it('Should allow contributions in the campaign token', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2,
        defiIntegrationManager,
        IERC20ABI
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

      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(1)

      const aaveDepositEvent = contributeReceipt1.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'FundsOperation'
        } catch {
          return false
        }
      })

      if (!aaveDepositEvent) throw new Error('Event failed')

      const parsedAaveDepositEvent =
        campaign.interface.parseLog(aaveDepositEvent)
      if (!parsedAaveDepositEvent) throw new Error('Event failed')

      expect(parsedAaveDepositEvent.args[0]).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(parsedAaveDepositEvent.args[1]).to.equal(contributionAmount)
      expect(parsedAaveDepositEvent.args[2]).to.equal(OP_DEPOSIT)
      expect(parsedAaveDepositEvent.args[3]).to.equal(contributor1.address)

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken: IERC20Metadata

      aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      expect(await aToken.balanceOf(campaignAddress)).to.be.closeTo(
        contributionAmount,
        10
      )

      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          campaignAddress
        )
      ).to.equal(contributionAmount)
    })
  })

  // describe('Yield Generation', function () {
  //   it('Should enable campaign creator to deposit yield into campaign', async function () {
  //     const OP_DEPOSIT = 1

  //     const {
  //       usdc,
  //       campaignContractFactory,
  //       creator1,
  //       contributor1,
  //       IERC20ABI
  //     } = await loadFixture(deployPlatformFixture)

  //     const usdcDecimals = await usdc.decimals()
  //     const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
  //     const CAMPAIGN_DURATION = 60

  //     const defiIntegrationManagerAddress =
  //       await defiIntegrationManager.getAddress()

  //     //Campaign 1
  //     const tx = await campaignContractFactory
  //       .connect(creator1)
  //       .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()

  //     if (!receipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event) {
  //       throw new Error('Event failed')
  //     }

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) {
  //       throw new Error('Event failed')
  //     }

  //     const campaignAddress = parsedEvent.args[1]

  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

  //     const contributionAmount = ethers.parseUnits('100', usdcDecimals)

  //     await usdc
  //       .connect(contributor1)
  //       .approve(campaignAddress, contributionAmount)

  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await usdc.getAddress(), contributionAmount)

  //     const depositTx = await campaign
  //       .connect(creator1)
  //       .depositToYieldProtocol(await usdc.getAddress())

  //     const depositReceipt = await depositTx.wait()

  //     if (!depositReceipt) throw new Error('Transaction failed')

  //     const depositEvent: any = depositReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!depositEvent) {
  //       throw new Error('FundsOperation event not found')
  //     }

  //     expect(depositEvent.args[0]).to.equal(
  //       ethers.getAddress(await usdc.getAddress())
  //     )
  //     expect(depositEvent.args[1]).to.equal(contributionAmount)
  //     expect(depositEvent.args[2]).to.equal(OP_DEPOSIT)
  //     expect(depositEvent.args[3]).to.equal(0)
  //     expect(depositEvent.args[4]).to.equal(
  //       ethers.getAddress(await campaign.owner())
  //     )

  //     const { inContract, inYield, total } =
  //       await campaign.getAvailableBalance()

  //     expect(inContract).to.equal(0)
  //     expect(inYield).to.equal(contributionAmount)
  //     expect(total).to.equal(contributionAmount)

  //     expect(
  //       await campaign.getDepositedAmount(await usdc.getAddress())
  //     ).to.equal(inYield)

  //     const aTokenAddress = await defiIntegrationManager.getATokenAddress(
  //       await usdc.getAddress()
  //     )

  //     let aToken: IERC20Metadata

  //     aToken = (await ethers.getContractAt(
  //       IERC20ABI,
  //       aTokenAddress
  //     )) as unknown as IERC20Metadata

  //     const atokenBalance = await aToken.balanceOf(campaignAddress)

  //     expect(
  //       await defiIntegrationManager.yieldBaseline(
  //         campaignAddress,
  //         await usdc.getAddress()
  //       )
  //     ).to.equal(inYield)

  //     //Campaign 2

  //     const tx2 = await campaignContractFactory
  //       .connect(creator1)
  //       .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt2 = await tx2.wait()

  //     if (!receipt2) {
  //       throw new Error('Transaction failed')
  //     }

  //     const event2 = receipt2.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event2) {
  //       throw new Error('Event failed')
  //     }

  //     const parsedEvent2 = campaignContractFactory.interface.parseLog(event2)
  //     if (!parsedEvent2) {
  //       throw new Error('Event failed')
  //     }

  //     const campaignAddress2 = parsedEvent2.args[1]

  //     const Campaign2 = await ethers.getContractFactory('Campaign')
  //     const campaign2 = Campaign2.attach(
  //       campaignAddress2
  //     ) as unknown as Campaign

  //     const contributionAmount2 = ethers.parseUnits('200', usdcDecimals)

  //     await usdc
  //       .connect(contributor1)
  //       .approve(campaignAddress2, contributionAmount2)

  //     await campaign2
  //       .connect(contributor1)
  //       .contribute(await usdc.getAddress(), contributionAmount2)

  //     await campaign2
  //       .connect(creator1)
  //       .depositToYieldProtocol(await usdc.getAddress())

  //     expect(await aToken.balanceOf(campaignAddress2)).to.equal(
  //       contributionAmount2
  //     )

  //     expect(
  //       await campaign2.getDepositedAmount(await usdc.getAddress())
  //     ).to.equal(contributionAmount2)

  //     expect(
  //       await defiIntegrationManager.yieldBaseline(
  //         campaignAddress2,
  //         await usdc.getAddress()
  //       )
  //     ).to.equal(contributionAmount2)
  //   })

  //   it('Should allow owner to harvest yield', async function () {
  //     const OP_HARVEST = 2

  //     const {
  //       usdc,
  //       campaignContractFactory,
  //       creator1,
  //       IERC20ABI,
  //       contributor1,
  //       platformTreasury
  //     } = await loadFixture(deployPlatformFixture)

  //     const usdcDecimals = await usdc.decimals()
  //     const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
  //     const CAMPAIGN_DURATION = 120

  //     const defiManagaerAddress = await defiIntegrationManager.getAddress()

  //     const tx = await campaignContractFactory
  //       .connect(creator1)
  //       .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()

  //     if (!receipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event) {
  //       throw new Error('Event failed')
  //     }

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) {
  //       throw new Error('Event failed')
  //     }

  //     const campaignAddress = parsedEvent.args[1]

  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

  //     const contributionAmount = ethers.parseUnits('100', usdcDecimals)

  //     await usdc
  //       .connect(contributor1)
  //       .approve(campaignAddress, contributionAmount)

  //     const contributeTx1 = await campaign
  //       .connect(contributor1)
  //       .contribute(await usdc.getAddress(), contributionAmount)

  //     await campaign
  //       .connect(creator1)
  //       .depositToYieldProtocol(await usdc.getAddress())

  //     await network.provider.send('evm_increaseTime', [60 * 60 * 24 * 120]) // 30 days
  //     await network.provider.send('evm_mine')

  //     const aTokenAddress = await defiIntegrationManager.getATokenAddress(
  //       await usdc.getAddress()
  //     )

  //     let aToken: IERC20Metadata

  //     aToken = (await ethers.getContractAt(
  //       IERC20ABI,
  //       aTokenAddress
  //     )) as unknown as IERC20Metadata

  //     const aTokenBalance = await aToken.balanceOf(campaignAddress)
  //     const initialATokenBalance = await defiIntegrationManager.yieldBaseline(
  //       campaignAddress,
  //       await usdc.getAddress()
  //     )

  //     const platformShare = await yieldDistributor.platformYieldShare()

  //     const totalYield = aTokenBalance - initialATokenBalance

  //     const expectedPlatformYield =
  //       (totalYield * BigInt(platformShare)) / 10000n

  //     const expectedCreatorYield = totalYield - expectedPlatformYield

  //     const harvestTx = await campaign
  //       .connect(creator1)
  //       .harvestYield(await usdc.getAddress())

  //     const harvestReceipt = await harvestTx.wait()

  //     if (!harvestReceipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     const harvestEvent: any = harvestReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!harvestEvent) {
  //       throw new Error('Event failed')
  //     }
  //     expect(harvestEvent.args[0]).to.equal(
  //       ethers.getAddress(await usdc.getAddress())
  //     )
  //     expect(harvestEvent.args[1]).to.equal(0)
  //     expect(harvestEvent.args[2]).to.equal(OP_HARVEST)
  //     expect(harvestEvent.args[3]).to.be.closeTo(expectedCreatorYield, 10)
  //     expect(harvestEvent.args[4]).to.equal(creator1.address)
  //     expect(await usdc.balanceOf(campaignAddress)).to.be.closeTo(
  //       expectedCreatorYield,
  //       10
  //     ) //Principal still invested in yield protocol

  //     const aTokenBalanceAfterHarvest = await aToken.balanceOf(campaignAddress)

  //     expect(
  //       await defiIntegrationManager.yieldBaseline(
  //         campaignAddress,
  //         await usdc.getAddress()
  //       )
  //     ).to.equal(aTokenBalanceAfterHarvest)

  //     expect(await usdc.balanceOf(platformTreasury)).to.be.closeTo(
  //       expectedPlatformYield,
  //       10
  //     )

  //     const { inContract, inYield, total } =
  //       await campaign.getAvailableBalance()

  //     expect(inContract).to.be.closeTo(expectedCreatorYield, 10)
  //     expect(inYield).to.be.closeTo(contributionAmount, 10)
  //     expect(total).to.be.closeTo(contributionAmount + expectedCreatorYield, 10)
  //     expect(await campaign.totalHarvestedYield()).to.be.closeTo(
  //       expectedCreatorYield,
  //       10
  //     )
  //   })

  //   it('Should allow owner to harvest yield multiple times during campaign', async function () {
  //     const OP_HARVEST = 2

  //     const {
  //       usdc,
  //       campaignContractFactory,
  //       creator1,
  //       IERC20ABI,
  //       contributor1,
  //       platformTreasury
  //     } = await loadFixture(deployPlatformFixture)

  //     const usdcDecimals = await usdc.decimals()
  //     const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
  //     const CAMPAIGN_DURATION = 120

  //     const defiManagaerAddress = await defiIntegrationManager.getAddress()

  //     // Deploy the campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator1)
  //       .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()

  //     if (!receipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event) {
  //       throw new Error('Event failed')
  //     }

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) {
  //       throw new Error('Event failed')
  //     }

  //     const campaignAddress = parsedEvent.args[1]

  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

  //     // Contribute to the campaign
  //     const contributionAmount = ethers.parseUnits('100', usdcDecimals)

  //     await usdc
  //       .connect(contributor1)
  //       .approve(campaignAddress, contributionAmount)

  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await usdc.getAddress(), contributionAmount)

  //     // Deposit to yield protocol
  //     await campaign
  //       .connect(creator1)
  //       .depositToYieldProtocol(await usdc.getAddress())

  //     // Get aToken for later balance checks
  //     const aTokenAddress = await defiIntegrationManager.getATokenAddress(
  //       await usdc.getAddress()
  //     )

  //     const aToken = (await ethers.getContractAt(
  //       IERC20ABI,
  //       aTokenAddress
  //     )) as unknown as IERC20Metadata

  //     // Record initial deposit
  //     const initialATokenBalance = await defiIntegrationManager.yieldBaseline(
  //       campaignAddress,
  //       await usdc.getAddress()
  //     )

  //     // Get platform yield share for calculations
  //     const platformShare = await yieldDistributor.platformYieldShare()

  //     // Track cumulative values
  //     let cumulativeCreatorYield = 0n
  //     let cumulativePlatformYield = 0n

  //     // First harvest after 30 days
  //     await network.provider.send('evm_increaseTime', [60 * 60 * 24 * 30])
  //     await network.provider.send('evm_mine')

  //     // Get current aToken balance before first harvest
  //     const aTokenBalanceBeforeHarvest1 = await aToken.balanceOf(
  //       campaignAddress
  //     )
  //     const totalYield1 = aTokenBalanceBeforeHarvest1 - initialATokenBalance

  //     const expectedPlatformYield1 =
  //       (totalYield1 * BigInt(platformShare)) / 10000n
  //     const expectedCreatorYield1 = totalYield1 - expectedPlatformYield1

  //     // First harvest
  //     const harvestTx1 = await campaign
  //       .connect(creator1)
  //       .harvestYield(await usdc.getAddress())

  //     const harvestReceipt1 = await harvestTx1.wait()

  //     if (!harvestReceipt1) {
  //       throw new Error('Transaction failed')
  //     }

  //     const harvestEvent1: any = harvestReceipt1.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!harvestEvent1) {
  //       throw new Error('Event failed')
  //     }

  //     // Verify first harvest
  //     expect(harvestEvent1.args[0]).to.equal(
  //       ethers.getAddress(await usdc.getAddress())
  //     )
  //     expect(harvestEvent1.args[1]).to.equal(0)
  //     expect(harvestEvent1.args[2]).to.equal(OP_HARVEST)
  //     expect(harvestEvent1.args[3]).to.be.closeTo(expectedCreatorYield1, 10)
  //     expect(harvestEvent1.args[4]).to.equal(creator1.address)

  //     // Track cumulative yields
  //     cumulativeCreatorYield += expectedCreatorYield1
  //     cumulativePlatformYield += expectedPlatformYield1

  //     // Update deposit tracker after first harvest
  //     const aTokenBalanceAfterHarvest1 = await aToken.balanceOf(campaignAddress)

  //     // Second harvest after another 30 days
  //     await network.provider.send('evm_increaseTime', [60 * 60 * 24 * 30])
  //     await network.provider.send('evm_mine')

  //     // Get current aToken balance before second harvest
  //     const aTokenBalanceBeforeHarvest2 = await aToken.balanceOf(
  //       campaignAddress
  //     )
  //     const totalYield2 =
  //       aTokenBalanceBeforeHarvest2 - aTokenBalanceAfterHarvest1

  //     const expectedPlatformYield2 =
  //       (totalYield2 * BigInt(platformShare)) / 10000n
  //     const expectedCreatorYield2 = totalYield2 - expectedPlatformYield2

  //     // Second harvest
  //     const harvestTx2 = await campaign
  //       .connect(creator1)
  //       .harvestYield(await usdc.getAddress())

  //     const harvestReceipt2 = await harvestTx2.wait()

  //     if (!harvestReceipt2) {
  //       throw new Error('Transaction failed')
  //     }

  //     const harvestEvent2: any = harvestReceipt2.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!harvestEvent2) {
  //       throw new Error('Event failed')
  //     }

  //     // Verify second harvest
  //     expect(harvestEvent2.args[0]).to.equal(
  //       ethers.getAddress(await usdc.getAddress())
  //     )
  //     expect(harvestEvent2.args[1]).to.equal(0)
  //     expect(harvestEvent2.args[2]).to.equal(OP_HARVEST)
  //     expect(harvestEvent2.args[3]).to.be.closeTo(expectedCreatorYield2, 10)
  //     expect(harvestEvent2.args[4]).to.equal(creator1.address)

  //     // Track cumulative yields
  //     cumulativeCreatorYield += expectedCreatorYield2
  //     cumulativePlatformYield += expectedPlatformYield2

  //     // Update deposit tracker after second harvest
  //     const aTokenBalanceAfterHarvest2 = await aToken.balanceOf(campaignAddress)

  //     // Third harvest after another 30 days
  //     await network.provider.send('evm_increaseTime', [60 * 60 * 24 * 30])
  //     await network.provider.send('evm_mine')

  //     // Get current aToken balance before third harvest
  //     const aTokenBalanceBeforeHarvest3 = await aToken.balanceOf(
  //       campaignAddress
  //     )
  //     const totalYield3 =
  //       aTokenBalanceBeforeHarvest3 - aTokenBalanceAfterHarvest2

  //     const expectedPlatformYield3 =
  //       (totalYield3 * BigInt(platformShare)) / 10000n
  //     const expectedCreatorYield3 = totalYield3 - expectedPlatformYield3

  //     // Third harvest
  //     const harvestTx3 = await campaign
  //       .connect(creator1)
  //       .harvestYield(await usdc.getAddress())

  //     const harvestReceipt3 = await harvestTx3.wait()

  //     if (!harvestReceipt3) {
  //       throw new Error('Transaction failed')
  //     }

  //     const harvestEvent3: any = harvestReceipt3.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!harvestEvent3) {
  //       throw new Error('Event failed')
  //     }

  //     // Verify third harvest
  //     expect(harvestEvent3.args[0]).to.equal(
  //       ethers.getAddress(await usdc.getAddress())
  //     )
  //     expect(harvestEvent3.args[1]).to.equal(0)
  //     expect(harvestEvent3.args[2]).to.equal(OP_HARVEST)
  //     expect(harvestEvent3.args[3]).to.be.closeTo(expectedCreatorYield3, 10)
  //     expect(harvestEvent3.args[4]).to.equal(creator1.address)

  //     // Track cumulative yields
  //     cumulativeCreatorYield += expectedCreatorYield3
  //     cumulativePlatformYield += expectedPlatformYield3

  //     // Final balance checks
  //     // Verify the creator's balance in the contract
  //     expect(await usdc.balanceOf(campaignAddress)).to.be.closeTo(
  //       cumulativeCreatorYield,
  //       30
  //     )

  //     // Verify platform treasury received correct share
  //     expect(await usdc.balanceOf(platformTreasury)).to.be.closeTo(
  //       cumulativePlatformYield,
  //       30
  //     )

  //     // Verify total harvested yield is tracked correctly
  //     expect(await campaign.totalHarvestedYield()).to.be.closeTo(
  //       cumulativeCreatorYield,
  //       30
  //     )

  //     // Check available balances
  //     const { inContract, inYield, total } =
  //       await campaign.getAvailableBalance()

  //     expect(inContract).to.be.closeTo(cumulativeCreatorYield, 30)
  //     expect(inYield).to.be.closeTo(contributionAmount, 10)
  //     expect(total).to.be.closeTo(
  //       contributionAmount + cumulativeCreatorYield,
  //       30
  //     )
  //   })

  //   it('Should correctly harvest yield from multiple campaigns simultaneously', async function () {
  //     const OP_HARVEST = 2

  //     const {
  //       usdc,
  //       campaignContractFactory,
  //       creator1,
  //       creator2,
  //       IERC20ABI,
  //       contributor1,
  //       contributor2,
  //       platformTreasury
  //     } = await loadFixture(deployPlatformFixture)

  //     const usdcDecimals = await usdc.decimals()
  //     const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
  //     const CAMPAIGN_DURATION = 120

  //     // Deploy first campaign
  //     const tx1 = await campaignContractFactory
  //       .connect(creator1)
  //       .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt1 = await tx1.wait()
  //     if (!receipt1) {
  //       throw new Error('Transaction failed for first campaign')
  //     }

  //     const event1 = receipt1.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event1) {
  //       throw new Error('Event failed for first campaign')
  //     }

  //     const parsedEvent1 = campaignContractFactory.interface.parseLog(event1)
  //     if (!parsedEvent1) {
  //       throw new Error('Event parsing failed for first campaign')
  //     }

  //     const campaignAddress1 = parsedEvent1.args[1]

  //     // Deploy second campaign
  //     const tx2 = await campaignContractFactory
  //       .connect(creator2)
  //       .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt2 = await tx2.wait()
  //     if (!receipt2) {
  //       throw new Error('Transaction failed for second campaign')
  //     }

  //     const event2 = receipt2.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event2) {
  //       throw new Error('Event failed for second campaign')
  //     }

  //     const parsedEvent2 = campaignContractFactory.interface.parseLog(event2)
  //     if (!parsedEvent2) {
  //       throw new Error('Event parsing failed for second campaign')
  //     }

  //     const campaignAddress2 = parsedEvent2.args[1]

  //     // Attach to both campaigns
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign1 = Campaign.attach(campaignAddress1) as unknown as Campaign
  //     const campaign2 = Campaign.attach(campaignAddress2) as unknown as Campaign

  //     // Different contribution amounts for easy distinction
  //     const contributionAmount1 = ethers.parseUnits('100', usdcDecimals)
  //     const contributionAmount2 = ethers.parseUnits('200', usdcDecimals)

  //     // Contribute to first campaign
  //     await usdc
  //       .connect(contributor1)
  //       .approve(campaignAddress1, contributionAmount1)

  //     await campaign1
  //       .connect(contributor1)
  //       .contribute(await usdc.getAddress(), contributionAmount1)

  //     // Contribute to second campaign
  //     await usdc
  //       .connect(contributor2)
  //       .approve(campaignAddress2, contributionAmount2)

  //     await campaign2
  //       .connect(contributor2)
  //       .contribute(await usdc.getAddress(), contributionAmount2)

  //     // Deposit both campaigns to yield protocol
  //     await campaign1
  //       .connect(creator1)
  //       .depositToYieldProtocol(await usdc.getAddress())

  //     await campaign2
  //       .connect(creator2)
  //       .depositToYieldProtocol(await usdc.getAddress())

  //     // Get aToken for later balance checks
  //     const aTokenAddress = await defiIntegrationManager.getATokenAddress(
  //       await usdc.getAddress()
  //     )

  //     const aToken = (await ethers.getContractAt(
  //       IERC20ABI,
  //       aTokenAddress
  //     )) as unknown as IERC20Metadata

  //     // Record initial deposits
  //     const initialATokenBalance1 = await defiIntegrationManager.yieldBaseline(
  //       campaignAddress1,
  //       await usdc.getAddress()
  //     )

  //     const initialATokenBalance2 = await defiIntegrationManager.yieldBaseline(
  //       campaignAddress2,
  //       await usdc.getAddress()
  //     )

  //     // Get platform yield share for calculations
  //     const platformShare = await yieldDistributor.platformYieldShare()

  //     // Advance time to generate yield
  //     await network.provider.send('evm_increaseTime', [60 * 60 * 24 * 60]) // 60 days
  //     await network.provider.send('evm_mine')

  //     // Get current aToken balances before harvests
  //     const aTokenBalanceBeforeHarvest1 = await aToken.balanceOf(
  //       campaignAddress1
  //     )
  //     const aTokenBalanceBeforeHarvest2 = await aToken.balanceOf(
  //       campaignAddress2
  //     )

  //     const totalYield1 = aTokenBalanceBeforeHarvest1 - initialATokenBalance1
  //     const totalYield2 = aTokenBalanceBeforeHarvest2 - initialATokenBalance2

  //     const expectedPlatformYield1 =
  //       (totalYield1 * BigInt(platformShare)) / 10000n
  //     const expectedCreatorYield1 = totalYield1 - expectedPlatformYield1

  //     const expectedPlatformYield2 =
  //       (totalYield2 * BigInt(platformShare)) / 10000n
  //     const expectedCreatorYield2 = totalYield2 - expectedPlatformYield2

  //     // Record initial platform treasury balance
  //     const initialPlatformTreasuryBalance = await usdc.balanceOf(
  //       platformTreasury
  //     )

  //     // Harvest from first campaign
  //     const harvestTx1 = await campaign1
  //       .connect(creator1)
  //       .harvestYield(await usdc.getAddress())

  //     const harvestReceipt1 = await harvestTx1.wait()
  //     if (!harvestReceipt1) {
  //       throw new Error('Harvest transaction failed for first campaign')
  //     }

  //     const harvestEvent1: any = harvestReceipt1.logs.find(log => {
  //       try {
  //         const parsed = campaign1.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!harvestEvent1) {
  //       throw new Error('Harvest event failed for first campaign')
  //     }

  //     // Harvest from second campaign
  //     const harvestTx2 = await campaign2
  //       .connect(creator2)
  //       .harvestYield(await usdc.getAddress())

  //     const harvestReceipt2 = await harvestTx2.wait()
  //     if (!harvestReceipt2) {
  //       throw new Error('Harvest transaction failed for second campaign')
  //     }

  //     const harvestEvent2: any = harvestReceipt2.logs.find(log => {
  //       try {
  //         const parsed = campaign2.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!harvestEvent2) {
  //       throw new Error('Harvest event failed for second campaign')
  //     }

  //     // Verify first campaign harvest event
  //     expect(harvestEvent1.args[0]).to.equal(
  //       ethers.getAddress(await usdc.getAddress())
  //     )
  //     expect(harvestEvent1.args[1]).to.equal(0)
  //     expect(harvestEvent1.args[2]).to.equal(OP_HARVEST)
  //     expect(harvestEvent1.args[3]).to.be.closeTo(expectedCreatorYield1, 10)
  //     expect(harvestEvent1.args[4]).to.equal(creator1.address)

  //     // Verify second campaign harvest event
  //     expect(harvestEvent2.args[0]).to.equal(
  //       ethers.getAddress(await usdc.getAddress())
  //     )
  //     expect(harvestEvent2.args[1]).to.equal(0)
  //     expect(harvestEvent2.args[2]).to.equal(OP_HARVEST)
  //     expect(harvestEvent2.args[3]).to.be.closeTo(expectedCreatorYield2, 10)
  //     expect(harvestEvent2.args[4]).to.equal(creator2.address)

  //     // Verify first campaign state after harvest
  //     expect(await usdc.balanceOf(campaignAddress1)).to.be.closeTo(
  //       expectedCreatorYield1,
  //       10
  //     )

  //     // Verify second campaign state after harvest
  //     expect(await usdc.balanceOf(campaignAddress2)).to.be.closeTo(
  //       expectedCreatorYield2,
  //       10
  //     )

  //     // Verify platform treasury received correct total from both campaigns
  //     const platformTreasuryBalance = await usdc.balanceOf(platformTreasury)
  //     const platformYieldReceived =
  //       platformTreasuryBalance - initialPlatformTreasuryBalance
  //     expect(platformYieldReceived).to.be.closeTo(
  //       expectedPlatformYield1 + expectedPlatformYield2,
  //       20
  //     )

  //     // Verify first campaign tracking is correct
  //     const availableBalance1 = await campaign1.getAvailableBalance()
  //     expect(availableBalance1.inContract).to.be.closeTo(
  //       expectedCreatorYield1,
  //       10
  //     )
  //     expect(availableBalance1.inYield).to.be.closeTo(contributionAmount1, 10)
  //     expect(availableBalance1.total).to.be.closeTo(
  //       contributionAmount1 + expectedCreatorYield1,
  //       10
  //     )
  //     expect(await campaign1.totalHarvestedYield()).to.be.closeTo(
  //       expectedCreatorYield1,
  //       10
  //     )

  //     // Verify second campaign tracking is correct
  //     const availableBalance2 = await campaign2.getAvailableBalance()
  //     expect(availableBalance2.inContract).to.be.closeTo(
  //       expectedCreatorYield2,
  //       10
  //     )
  //     expect(availableBalance2.inYield).to.be.closeTo(contributionAmount2, 10)
  //     expect(availableBalance2.total).to.be.closeTo(
  //       contributionAmount2 + expectedCreatorYield2,
  //       10
  //     )
  //     expect(await campaign2.totalHarvestedYield()).to.be.closeTo(
  //       expectedCreatorYield2,
  //       10
  //     )

  //     // Verify aToken balances after harvest are tracked correctly
  //     const aTokenBalanceAfterHarvest1 = await aToken.balanceOf(
  //       campaignAddress1
  //     )
  //     const aTokenBalanceAfterHarvest2 = await aToken.balanceOf(
  //       campaignAddress2
  //     )

  //     expect(
  //       await defiIntegrationManager.yieldBaseline(
  //         campaignAddress1,
  //         await usdc.getAddress()
  //       )
  //     ).to.equal(aTokenBalanceAfterHarvest1)

  //     expect(
  //       await defiIntegrationManager.yieldBaseline(
  //         campaignAddress2,
  //         await usdc.getAddress()
  //       )
  //     ).to.equal(aTokenBalanceAfterHarvest2)
  //   })

  //   it('Should allow owner to withdraw funds from yield protocol', async function () {
  //     const OP_WITHDRAW = 3

  //     const {
  //       usdc,
  //       campaignContractFactory,
  //       creator1,
  //       contributor1,
  //       IERC20ABI
  //     } = await loadFixture(deployPlatformFixture)

  //     const usdcDecimals = await usdc.decimals()
  //     const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
  //     const CAMPAIGN_DURATION = 60

  //     const defiIntegrationManagerAddress =
  //       await defiIntegrationManager.getAddress()

  //     //Campaign 1
  //     const tx = await campaignContractFactory
  //       .connect(creator1)
  //       .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()

  //     if (!receipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event) {
  //       throw new Error('Event failed')
  //     }

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) {
  //       throw new Error('Event failed')
  //     }

  //     const campaignAddress = parsedEvent.args[1]

  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

  //     const contributionAmount = ethers.parseUnits('100', usdcDecimals)

  //     await usdc
  //       .connect(contributor1)
  //       .approve(campaignAddress, contributionAmount)

  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await usdc.getAddress(), contributionAmount)

  //     await campaign
  //       .connect(creator1)
  //       .depositToYieldProtocol(await usdc.getAddress())

  //     const initialPrincipalBalance =
  //       await defiIntegrationManager.getDepositedPrincipalAmount(
  //         campaignAddress,
  //         await usdc.getAddress()
  //       )

  //     const withdrawTx = await campaign
  //       .connect(creator1)
  //       .withdrawFromYieldProtocol(await usdc.getAddress())

  //     const withdrawReceipt = await withdrawTx.wait()

  //     if (!withdrawReceipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     const withdrawEvent: any = withdrawReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!withdrawEvent) {
  //       throw new Error('Withdraw event failed')
  //     }

  //     expect(withdrawEvent.args[0]).to.equal(
  //       ethers.getAddress(await usdc.getAddress())
  //     )
  //     expect(withdrawEvent.args[1]).to.equal(initialPrincipalBalance)
  //     expect(withdrawEvent.args[2]).to.equal(OP_WITHDRAW)
  //     expect(withdrawEvent.args[3]).to.equal(0)
  //     expect(withdrawEvent.args[4]).to.equal(
  //       ethers.getAddress(creator1.address)
  //     )

  //     const finalPrincipalBalance =
  //       await defiIntegrationManager.getDepositedPrincipalAmount(
  //         campaignAddress,
  //         await usdc.getAddress()
  //       )
  //     expect(finalPrincipalBalance).to.equal(0)
  //   })

  //   it('Should allow owner to correctly withdraw principal after yield has been generated', async function () {
  //     const OP_WITHDRAW = 3

  //     const {
  //       usdc,
  //       campaignContractFactory,
  //       creator1,
  //       contributor1,
  //       IERC20ABI
  //     } = await loadFixture(deployPlatformFixture)

  //     const usdcDecimals = await usdc.decimals()
  //     const CAMPAIGN_GOAL = ethers.parseUnits('25000', usdcDecimals)
  //     const CAMPAIGN_DURATION = 60

  //     const defiIntegrationManagerAddress =
  //       await defiIntegrationManager.getAddress()

  //     //Campaign 1
  //     const tx = await campaignContractFactory
  //       .connect(creator1)
  //       .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()

  //     if (!receipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event) {
  //       throw new Error('Event failed')
  //     }

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) {
  //       throw new Error('Event failed')
  //     }

  //     const campaignAddress = parsedEvent.args[1]

  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

  //     const contributionAmount = ethers.parseUnits('100', usdcDecimals)

  //     await usdc
  //       .connect(contributor1)
  //       .approve(campaignAddress, contributionAmount)

  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await usdc.getAddress(), contributionAmount)

  //     await campaign
  //       .connect(creator1)
  //       .depositToYieldProtocol(await usdc.getAddress())

  //     await network.provider.send('evm_increaseTime', [60 * 60 * 24 * 20]) // 30 days
  //     await network.provider.send('evm_mine')

  //     const aTokenAddress = await defiIntegrationManager.getATokenAddress(
  //       await usdc.getAddress()
  //     )

  //     let aToken: IERC20Metadata

  //     aToken = (await ethers.getContractAt(
  //       IERC20ABI,
  //       aTokenAddress
  //     )) as unknown as IERC20Metadata

  //     const initialaTokenBalance = await aToken.balanceOf(campaignAddress)
  //     const initialPrincipalBalance =
  //       await defiIntegrationManager.getDepositedPrincipalAmount(
  //         campaignAddress,
  //         await usdc.getAddress()
  //       )

  //     await campaign
  //       .connect(creator1)
  //       .withdrawFromYieldProtocol(await usdc.getAddress())
  //   })
  // })
})
