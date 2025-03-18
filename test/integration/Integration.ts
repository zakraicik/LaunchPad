import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { Contract } from 'ethers'

import { time } from '@nomicfoundation/hardhat-network-helpers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import { PlatformAdmin } from '../../typechain-types'

import { ICampaign } from '../interfaces/ICampaign'

describe('Base Mainnet Integration Tests', function () {
  //Whales
  const ETH_WHALE_ADDRESS = '0xf977814e90da44bfa03b6295a0616a897441acec'

  // External contracts addresses
  const UNISWAP_QUOTER_ADDRESS = '0x3d4e44eb1374240ce5f1b871ab261cd16335b76a' //Uniswap Quoter V3
  const UNISWAP_ROUTER_ADDRESS = '0x6ff5693b99212da76ad316178a184ab56d299b43' //uniswap Router V3
  const AAVE_POOL_ADDRESS = '0xa238dd80c259a72e81d7e4664a9801593f98d1c5' //AAVE v3
  const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' //USDC on Base
  const DAI_ADDRESS = '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' //DAI on Base

  // Constants for testing
  const TOKEN_AMOUNT = ethers.parseUnits('1000', 18)
  const CAMPAIGN_GOAL = ethers.parseUnits('500', 18)
  const CAMPAIGN_DURATION = 30
  const CONTRIBUTION_AMOUNT = ethers.parseUnits('100', 18)
  const PLATFORM_YIELD_SHARE = 2000
  const GRACE_PERIOD = 7 // 7 days grace period

  let usdc: Contract
  let dai: Contract
  let uniswapRouter: Contract
  let uniswapQuoter: Contract
  let aavePool: Contract
  let platformAdmin: PlatformAdmin
  // Main fixture that deploys the entire platform and sets up test environment
  async function deployPlatformFixture () {
    // Impersonate the ETH whale

    const eth_whale = await ethers.getSigner(ETH_WHALE_ADDRESS)
    const deployer = (await ethers.getSigners())[0]

    const feeData = await ethers.provider.getFeeData()
    const maxFeePerGas = feeData.maxFeePerGas
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas

    //USDC ABI for testing
    const ERC20_ABI = [
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

    // Initialize contracts with signer using getContractAt
    usdc = await ethers.getContractAt(ERC20_ABI, USDC_ADDRESS)
    dai = await ethers.getContractAt(ERC20_ABI, DAI_ADDRESS)
    uniswapRouter = await ethers.getContractAt(
      UNISWAP_ROUTER_ABI,
      UNISWAP_ROUTER_ADDRESS
    )
    uniswapQuoter = await ethers.getContractAt(
      UNISWAP_QUOTER_ABI,
      UNISWAP_QUOTER_ADDRESS
    )
    aavePool = await ethers.getContractAt(AAVE_POOL_ABI, AAVE_POOL_ADDRESS)

    platformAdmin = await ethers.deployContract(
      'PlatformAdmin',
      [GRACE_PERIOD, deployer.address],
      {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: 3000000
      }
    )

    // await platformAdmin.waitForDeployment()

    return {
      usdc,
      dai,
      deployer,
      platformAdmin
    }

    // console.log('PlatformAdmin deployed at:', await platformAdmin.getAddress())

    // console.log(await platformAdmin.owner())
  }

  describe('Base Mainnet Fork Tests', function () {
    it('Deploy Launchpad', async function () {
      const { platformAdmin, deployer } = await loadFixture(
        deployPlatformFixture
      )

      expect(await platformAdmin.owner()).to.equal(deployer.address)
    })
  })

  // describe('Campaign Lifecycle', function () {
  //   it('Should create a campaign through factory and verify authorization', async function () {
  //     const { campaignContractFactory, creator, mockDAI, defiManager } =
  //       await loadFixture(deployPlatformFixture)

  //     // Define the OP code for campaign creation
  //     const OP_CAMPAIGN_CREATED = 1

  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     // Add proper null checking
  //     const receipt = await tx.wait()
  //     if (!receipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     // Now TypeScript knows receipt is not null
  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         // Updated to find the new consolidated event
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     // You should also check if event exists
  //     if (!event) {
  //       throw new Error('Failed to find FactoryOperation event')
  //     }

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) {
  //       throw new Error('Failed to parse event')
  //     }

  //     // Verify the operation type matches campaign creation
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

  //     // The campaign address is now at a different index in the event args
  //     const campaignAddress = parsedEvent.args[1]

  //     // Verify the creator matches
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Verify campaign was correctly added to factory records
  //     expect(await campaignContractFactory.deployedCampaigns(0)).to.equal(
  //       campaignAddress
  //     )
  //     expect(
  //       await campaignContractFactory.creatorToCampaigns(creator.address, 0)
  //     ).to.equal(campaignAddress)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Verify campaign parameters
  //     expect(await campaign.owner()).to.equal(creator.address)
  //     expect(await campaign.campaignToken()).to.equal(
  //       await mockDAI.getAddress()
  //     )
  //     expect(await campaign.campaignGoalAmount()).to.equal(CAMPAIGN_GOAL)
  //     expect(await campaign.campaignDuration()).to.equal(CAMPAIGN_DURATION)
  //     expect(await campaign.isCampaignActive()).to.be.true
  //   })

  //   it('Should allow multiple contributors to fund a campaign', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       contributor2,
  //       mockDAI
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP code
  //     const OP_CAMPAIGN_CREATED = 1

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()

  //     if (!receipt) {
  //       throw new Error('Transaction failed')
  //     }

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         // Updated to match the new event name
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event) {
  //       throw new Error('Event Failed')
  //     }

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)

  //     if (!parsedEvent) {
  //       throw new Error('Event Failed')
  //     }

  //     // Verify the operation type
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

  //     // The campaign address is now at index 1
  //     const campaignAddress = parsedEvent.args[1]

  //     // Verify the creator is correct
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Contributor 1 contributes
  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaignAddress, CONTRIBUTION_AMOUNT)

  //     // Watch for Contribution event
  //     const contributeTx1 = await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), CONTRIBUTION_AMOUNT)

  //     const contributeReceipt1 = await contributeTx1.wait()

  //     // Optionally, you could check for the Contribution event here
  //     // const contributionEvent1 = contributeReceipt1.logs.find(...)

  //     // Contributor 2 contributes
  //     await mockDAI
  //       .connect(contributor2)
  //       .approve(campaignAddress, CONTRIBUTION_AMOUNT)
  //     await campaign
  //       .connect(contributor2)
  //       .contribute(await mockDAI.getAddress(), CONTRIBUTION_AMOUNT)

  //     // Verify contributions
  //     expect(await campaign.contributions(contributor1.address)).to.equal(
  //       CONTRIBUTION_AMOUNT
  //     )
  //     expect(await campaign.contributions(contributor2.address)).to.equal(
  //       CONTRIBUTION_AMOUNT
  //     )
  //     expect(await campaign.totalAmountRaised()).to.equal(
  //       CONTRIBUTION_AMOUNT * 2n
  //     )
  //     expect(await mockDAI.balanceOf(campaignAddress)).to.equal(
  //       CONTRIBUTION_AMOUNT * 2n
  //     )
  //   })

  //   it('Should allow users to contribute in a non campaign token', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       mockDAI,
  //       mockUSDC,
  //       mockUniswapRouter
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1
  //     const OP_TOKEN_SWAPPED = 4

  //     // Create a campaign with DAI as the target token
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()
  //     if (!receipt) throw new Error('Transaction failed')

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })
  //     if (!event) throw new Error('Event failed')

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) throw new Error('parsedEvent failed')

  //     // Verify the operation type is campaign creation
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

  //     // Campaign address is now at index 1
  //     const campaignAddress = parsedEvent.args[1]

  //     // Verify the creator is correct
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Initial balances
  //     const initialDAIBalance = await mockDAI.balanceOf(campaignAddress)
  //     const initialUSDCBalance = await mockUSDC.balanceOf(contributor1.address)
  //     const initialContribution = await campaign.contributions(
  //       contributor1.address
  //     )
  //     const initialTotalRaised = await campaign.totalAmountRaised()

  //     // Fund the mock Uniswap router with DAI for the swap result
  //     // The mock router will give a 1:1 exchange rate (configured in the fixture)
  //     const contributionAmount = ethers.parseUnits('100', 18)
  //     await mockDAI.transfer(
  //       await mockUniswapRouter.getAddress(),
  //       contributionAmount
  //     )

  //     // Approve and contribute using USDC (not the campaign token)
  //     await mockUSDC
  //       .connect(contributor1)
  //       .approve(campaignAddress, contributionAmount)

  //     // This will swap USDC to DAI and track the contribution
  //     const contributeTx = await campaign
  //       .connect(contributor1)
  //       .contribute(await mockUSDC.getAddress(), contributionAmount)

  //     const contributeReceipt = await contributeTx.wait()

  //     // You can also verify the TokensSwapped event here
  //     const swapEvent = contributeReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'TokensSwapped'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (swapEvent) {
  //       const parsedSwapEvent = campaign.interface.parseLog(swapEvent)
  //       // Verify swap event parameters
  //       expect(parsedSwapEvent.args[0]).to.equal(await mockUSDC.getAddress()) // fromToken
  //       expect(parsedSwapEvent.args[1]).to.equal(await mockDAI.getAddress()) // toToken
  //       expect(parsedSwapEvent.args[2]).to.equal(contributionAmount) // amountIn
  //       expect(parsedSwapEvent.args[3]).to.equal(contributionAmount) // amountOut (1:1 exchange)
  //     }

  //     // Verify the contribution was tracked correctly
  //     expect(await campaign.contributions(contributor1.address)).to.equal(
  //       initialContribution + contributionAmount
  //     )

  //     // Verify total raised increased
  //     expect(await campaign.totalAmountRaised()).to.equal(
  //       initialTotalRaised + contributionAmount
  //     )

  //     // Verify the campaign has DAI (target token) balance, not USDC
  //     expect(await mockDAI.balanceOf(campaignAddress)).to.equal(
  //       initialDAIBalance + contributionAmount
  //     )

  //     // Contributor's USDC balance should have decreased
  //     expect(await mockUSDC.balanceOf(contributor1.address)).to.equal(
  //       initialUSDCBalance - contributionAmount
  //     )
  //   })

  //   it('Should track contributions correctly with a non-1:1 exchange rate', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       mockDAI,
  //       mockUSDC,
  //       mockUniswapRouter,
  //       mockUniswapQuoter
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1
  //     const OP_TOKEN_SWAPPED = 4

  //     // Create a campaign with DAI as the target token
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()
  //     if (!receipt) throw new Error('Transaction failed')

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event) throw new Error('Event failed')

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)

  //     if (!parsedEvent) throw new Error('parsedEvent failed')

  //     // Verify the operation type
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

  //     // Campaign address is now at index 1
  //     const campaignAddress = parsedEvent.args[1]

  //     // Verify the creator
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // You could set a different exchange rate for testing non-1:1 exchanges
  //     const exchangeRate = 1n

  //     await mockUniswapRouter.setCustomSwapRate(
  //       await mockUSDC.getAddress(),
  //       await mockDAI.getAddress(),
  //       exchangeRate
  //     )

  //     await mockUniswapQuoter.setCustomQuoteRate(
  //       await mockUSDC.getAddress(),
  //       await mockDAI.getAddress(),
  //       exchangeRate
  //     )

  //     // Initial balances
  //     const initialDAIBalance = await mockDAI.balanceOf(campaignAddress)
  //     const initialUSDCBalance = await mockUSDC.balanceOf(contributor1.address)
  //     const initialContribution = await campaign.contributions(
  //       contributor1.address
  //     )
  //     const initialTotalRaised = await campaign.totalAmountRaised()

  //     // Input amount and expected output amount
  //     const inputAmount = ethers.parseUnits('100', 18)
  //     const expectedOutputAmount = inputAmount * exchangeRate

  //     // Fund the mock Uniswap router with DAI for the swap result
  //     await mockDAI.transfer(
  //       await mockUniswapRouter.getAddress(),
  //       expectedOutputAmount
  //     )

  //     // Approve and contribute using USDC
  //     await mockUSDC.connect(contributor1).approve(campaignAddress, inputAmount)

  //     // This will swap USDC to DAI and track the contribution
  //     const contributeTx = await campaign
  //       .connect(contributor1)
  //       .contribute(await mockUSDC.getAddress(), inputAmount)

  //     const contributeReceipt = await contributeTx.wait()

  //     // Verify the TokensSwapped event was emitted with correct parameters
  //     const swapEvent = contributeReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'TokensSwapped'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (swapEvent) {
  //       const parsedSwapEvent = campaign.interface.parseLog(swapEvent)
  //       expect(parsedSwapEvent.args[0]).to.equal(await mockUSDC.getAddress()) // fromToken
  //       expect(parsedSwapEvent.args[1]).to.equal(await mockDAI.getAddress()) // toToken
  //       expect(parsedSwapEvent.args[2]).to.equal(inputAmount) // amountIn
  //       expect(parsedSwapEvent.args[3]).to.equal(expectedOutputAmount) // amountOut
  //     } else {
  //       throw new Error('TokensSwapped event not found')
  //     }

  //     // Verify the contribution was tracked correctly based on the DAI amount received
  //     expect(await campaign.contributions(contributor1.address)).to.equal(
  //       initialContribution + expectedOutputAmount
  //     )

  //     // Verify total raised increased by the DAI amount
  //     expect(await campaign.totalAmountRaised()).to.equal(
  //       initialTotalRaised + expectedOutputAmount
  //     )

  //     // Verify the campaign has received the correct DAI amount
  //     expect(await mockDAI.balanceOf(campaignAddress)).to.equal(
  //       initialDAIBalance + expectedOutputAmount
  //     )

  //     // Contributor's USDC balance should have decreased by the input amount
  //     expect(await mockUSDC.balanceOf(contributor1.address)).to.equal(
  //       initialUSDCBalance - inputAmount
  //     )
  //   })

  //   it('Should handle a successful campaign with fund claiming', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       contributor2,
  //       mockDAI
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

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
  //       throw new Error('parsedEvent failed')
  //     }

  //     // Verify the operation type
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

  //     // Campaign address is now at index 1
  //     const campaignAddress = parsedEvent.args[1]

  //     // Verify the creator
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Contributors fund the campaign to reach goal
  //     const halfGoal = CAMPAIGN_GOAL / 2n

  //     await mockDAI.connect(contributor1).approve(campaignAddress, halfGoal)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), halfGoal)

  //     await mockDAI.connect(contributor2).approve(campaignAddress, halfGoal)
  //     await campaign
  //       .connect(contributor2)
  //       .contribute(await mockDAI.getAddress(), halfGoal)

  //     // Verify campaign is successful
  //     expect(await campaign.isCampaignSuccessful()).to.be.true
  //     expect(await campaign.totalAmountRaised()).to.equal(CAMPAIGN_GOAL)

  //     // Fast forward time to after campaign end
  //     const campaignEndTime = await campaign.campaignEndTime()
  //     await time.increaseTo(campaignEndTime + 1n)

  //     // Verify campaign is no longer active
  //     expect(await campaign.isCampaignActive()).to.be.false

  //     // Creator claims funds
  //     const creatorBalanceBefore = await mockDAI.balanceOf(creator.address)
  //     const claimTx = await campaign.connect(creator).claimFunds()
  //     const claimReceipt = await claimTx.wait()

  //     // Verify the FundsClaimed event
  //     const fundsClaimedEvent = claimReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsClaimed'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (fundsClaimedEvent) {
  //       const parsedClaimEvent = campaign.interface.parseLog(fundsClaimedEvent)
  //       expect(parsedClaimEvent.args[0]).to.equal(creator.address) // owner
  //       expect(parsedClaimEvent.args[1]).to.equal(CAMPAIGN_GOAL) // amount
  //     } else {
  //       throw new Error('FundsClaimed event not found')
  //     }

  //     const creatorBalanceAfter = await mockDAI.balanceOf(creator.address)

  //     // Verify funds were claimed
  //     expect(await campaign.isClaimed()).to.be.true
  //     expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(CAMPAIGN_GOAL)
  //     expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
  //   })

  //   it('Should handle a failed campaign with refunds', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       contributor2,
  //       mockDAI
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP and ERR codes
  //     const OP_CAMPAIGN_CREATED = 1
  //     const ERR_GOAL_NOT_REACHED = 9

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()

  //     if (!receipt) {
  //       throw new Error('Receipt Failed')
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
  //       throw new Error('parsedEvent failed')
  //     }

  //     // Verify the operation type
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

  //     // Campaign address is now at index 1
  //     const campaignAddress = parsedEvent.args[1]

  //     // Verify the creator
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Contributors fund the campaign partially (not reaching goal)
  //     const partialAmount = CAMPAIGN_GOAL / 4n

  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaignAddress, partialAmount)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), partialAmount)

  //     await mockDAI
  //       .connect(contributor2)
  //       .approve(campaignAddress, partialAmount)
  //     await campaign
  //       .connect(contributor2)
  //       .contribute(await mockDAI.getAddress(), partialAmount)

  //     // Verify campaign is not successful
  //     expect(await campaign.isCampaignSuccessful()).to.be.false
  //     expect(await campaign.totalAmountRaised()).to.equal(partialAmount * 2n)

  //     // Fast forward time to after campaign end
  //     const campaignEndTime = await campaign.campaignEndTime()
  //     await time.increaseTo(campaignEndTime + 1n)

  //     // Verify campaign is no longer active
  //     expect(await campaign.isCampaignActive()).to.be.false

  //     // Creator should not be able to claim funds
  //     await expect(campaign.connect(creator).claimFunds())
  //       .to.be.revertedWithCustomError(campaign, 'CampaignError')
  //       .withArgs(ERR_GOAL_NOT_REACHED, ethers.ZeroAddress, partialAmount * 2n)

  //     // Contributors request refunds
  //     const contributor1BalanceBefore = await mockDAI.balanceOf(
  //       contributor1.address
  //     )
  //     const refundTx1 = await campaign.connect(contributor1).requestRefund()
  //     const refundReceipt1 = await refundTx1.wait()

  //     // Verify the RefundIssued event
  //     const refundEvent1 = refundReceipt1.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'RefundIssued'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (refundEvent1) {
  //       const parsedRefundEvent = campaign.interface.parseLog(refundEvent1)
  //       expect(parsedRefundEvent.args[0]).to.equal(contributor1.address) // contributor
  //       expect(parsedRefundEvent.args[1]).to.equal(partialAmount) // amount
  //     }

  //     const contributor1BalanceAfter = await mockDAI.balanceOf(
  //       contributor1.address
  //     )

  //     const contributor2BalanceBefore = await mockDAI.balanceOf(
  //       contributor2.address
  //     )
  //     await campaign.connect(contributor2).requestRefund()
  //     const contributor2BalanceAfter = await mockDAI.balanceOf(
  //       contributor2.address
  //     )

  //     // Verify refunds were issued
  //     expect(contributor1BalanceAfter - contributor1BalanceBefore).to.equal(
  //       partialAmount
  //     )
  //     expect(contributor2BalanceAfter - contributor2BalanceBefore).to.equal(
  //       partialAmount
  //     )
  //     expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
  //     expect(await campaign.contributions(contributor1.address)).to.equal(0)
  //     expect(await campaign.contributions(contributor2.address)).to.equal(0)
  //   })
  // })

  // describe('Defi Integration', function () {
  //   it('Should deposit campaign funds to yield protocol and harvest yield', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       mockDAI,
  //       mockDAIAToken,
  //       defiManager,
  //       platformTreasury
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1
  //     const OP_DEPOSIT = 1
  //     const OP_HARVEST = 2

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

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
  //       throw new Error('Parsed Event failed')
  //     }

  //     // Verify operation type and campaign address
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)
  //     const campaignAddress = parsedEvent.args[1]
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Contributor funds the campaign
  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaignAddress, CAMPAIGN_GOAL)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     // Check initial balances
  //     expect(await mockDAI.balanceOf(campaignAddress)).to.equal(CAMPAIGN_GOAL)
  //     expect(
  //       await campaign.getDepositedAmount(await mockDAI.getAddress())
  //     ).to.equal(0)

  //     // Deposit to yield protocol
  //     const depositTx = await campaign
  //       .connect(creator)
  //       .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     const depositReceipt = await depositTx.wait()

  //     // Verify the FundsOperation event for deposit
  //     const depositEvent = depositReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return parsed && parsed.name === 'FundsOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (depositEvent) {
  //       const parsedDepositEvent = campaign.interface.parseLog(depositEvent)
  //       expect(parsedDepositEvent.args[0]).to.equal(await mockDAI.getAddress()) // token
  //       expect(parsedDepositEvent.args[1]).to.equal(CAMPAIGN_GOAL) // amount
  //       expect(parsedDepositEvent.args[2]).to.equal(OP_DEPOSIT) // opType
  //       expect(parsedDepositEvent.args[4]).to.equal(creator.address) // initiator
  //     }

  //     // Verify deposit
  //     expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
  //     expect(
  //       await campaign.getDepositedAmount(await mockDAI.getAddress())
  //     ).to.equal(CAMPAIGN_GOAL)

  //     // Simulate yield generation - the yield is 5% of the deposit
  //     const yieldAmount = (CAMPAIGN_GOAL * 5n) / 100n

  //     // For our mock, we need to mint aTokens to simulate yield
  //     await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)

  //     // Creator harvests yield
  //     const treasuryBalanceBefore = await mockDAI.balanceOf(
  //       platformTreasury.address
  //     )
  //     const campaignBalanceBefore = await mockDAI.balanceOf(campaignAddress)

  //     // Transfer the yield amount to the defi manager so it can distribute it
  //     await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

  //     // Now harvest the yield
  //     const harvestTx = await campaign
  //       .connect(creator)
  //       .harvestYield(await mockDAI.getAddress())
  //     const harvestReceipt = await harvestTx.wait()

  //     // Verify the FundsOperation event for harvest
  //     const harvestEvent = harvestReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return (
  //           parsed &&
  //           parsed.name === 'FundsOperation' &&
  //           parsed.args[2] === OP_HARVEST
  //         ) // Check opType is OP_HARVEST
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (harvestEvent) {
  //       const parsedHarvestEvent = campaign.interface.parseLog(harvestEvent)
  //       expect(parsedHarvestEvent.args[0]).to.equal(await mockDAI.getAddress()) // token
  //       expect(parsedHarvestEvent.args[2]).to.equal(OP_HARVEST) // opType
  //       expect(parsedHarvestEvent.args[3]).to.not.equal(0) // yieldAmount
  //       expect(parsedHarvestEvent.args[4]).to.equal(creator.address) // initiator
  //     }

  //     // Calculate expected shares
  //     const platformShare = (yieldAmount * 20n) / 100n // 20% goes to platform
  //     const creatorShare = yieldAmount - platformShare // 80% goes to creator

  //     // Verify balances after yield harvest
  //     const treasuryBalanceAfter = await mockDAI.balanceOf(
  //       platformTreasury.address
  //     )
  //     const campaignBalanceAfter = await mockDAI.balanceOf(campaignAddress)

  //     expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
  //       creatorShare
  //     )
  //     expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
  //       platformShare
  //     )

  //     // Original deposit should still be in the yield protocol
  //     expect(
  //       await campaign.getDepositedAmount(await mockDAI.getAddress())
  //     ).to.equal(CAMPAIGN_GOAL)
  //   })

  //   it('Should withdraw funds from yield protocol', async function () {
  //     const { campaignContractFactory, creator, contributor1, mockDAI } =
  //       await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1
  //     const OP_DEPOSIT = 1
  //     const OP_WITHDRAW = 3
  //     const OP_WITHDRAW_ALL = 4

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

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
  //       throw new Error('parsedEvent failed')
  //     }

  //     // Verify operation type and campaign address
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)
  //     const campaignAddress = parsedEvent.args[1]
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Contributor funds the campaign
  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaignAddress, CAMPAIGN_GOAL)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     // Deposit to yield protocol
  //     await campaign
  //       .connect(creator)
  //       .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     // Verify deposit
  //     expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
  //     expect(
  //       await campaign.getDepositedAmount(await mockDAI.getAddress())
  //     ).to.equal(CAMPAIGN_GOAL)
  //   })

  //   it('Should change yield distribution parameters and verify effect', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       mockDAI,
  //       mockDAIAToken,
  //       defiManager,
  //       platformTreasury,
  //       yieldDistributor,
  //       owner
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1
  //     const OP_DEPOSIT = 1
  //     const OP_HARVEST = 2
  //     const OP_SHARE_UPDATED = 2 // from YieldDistributor

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

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
  //       throw new Error('parsedEvent failed')
  //     }

  //     // Verify operation type and campaign address
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)
  //     const campaignAddress = parsedEvent.args[1]
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Contributor funds the campaign
  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaignAddress, CAMPAIGN_GOAL)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     // Deposit to yield protocol
  //     await campaign
  //       .connect(creator)
  //       .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     // Simulate yield generation
  //     const yieldAmount = (CAMPAIGN_GOAL * 5n) / 100n
  //     await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
  //     await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

  //     // First harvest with default 20% platform share
  //     await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

  //     // Update the platform share to 30%
  //     const newPlatformShare = 3000 // 30%
  //     const updateTx = await yieldDistributor
  //       .connect(owner)
  //       .updatePlatformYieldShare(newPlatformShare)

  //     const updateReceipt = await updateTx.wait()

  //     // Verify the YieldDistributorOperation event
  //     const shareUpdateEvent = updateReceipt.logs.find(log => {
  //       try {
  //         const parsed = yieldDistributor.interface.parseLog(log)
  //         return (
  //           parsed &&
  //           parsed.name === 'YieldDistributorOperation' &&
  //           parsed.args[0] === OP_SHARE_UPDATED
  //         )
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (shareUpdateEvent) {
  //       const parsedShareEvent =
  //         yieldDistributor.interface.parseLog(shareUpdateEvent)
  //       expect(parsedShareEvent.args[0]).to.equal(OP_SHARE_UPDATED) // opType
  //       expect(parsedShareEvent.args[3]).to.equal(2000) // oldValue (default 20%)
  //       expect(parsedShareEvent.args[4]).to.equal(newPlatformShare) // newValue (30%)
  //     }

  //     // Verify the share was updated
  //     expect(await yieldDistributor.platformYieldShare()).to.equal(
  //       newPlatformShare
  //     )

  //     // Simulate more yield generation
  //     await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
  //     await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

  //     // Harvest again with new 30% platform share
  //     const campaignBalanceBefore = await mockDAI.balanceOf(campaignAddress)
  //     const treasuryBalanceBefore = await mockDAI.balanceOf(
  //       platformTreasury.address
  //     )

  //     const harvestTx = await campaign
  //       .connect(creator)
  //       .harvestYield(await mockDAI.getAddress())
  //     const harvestReceipt = await harvestTx.wait()

  //     // Verify the FundsOperation event for harvest
  //     const harvestEvent = harvestReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return (
  //           parsed &&
  //           parsed.name === 'FundsOperation' &&
  //           parsed.args[2] === OP_HARVEST
  //         )
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (harvestEvent) {
  //       const parsedHarvestEvent = campaign.interface.parseLog(harvestEvent)
  //       expect(parsedHarvestEvent.args[0]).to.equal(await mockDAI.getAddress()) // token
  //       expect(parsedHarvestEvent.args[2]).to.equal(OP_HARVEST) // opType
  //       expect(parsedHarvestEvent.args[3]).to.not.equal(0) // yieldAmount
  //       expect(parsedHarvestEvent.args[4]).to.equal(creator.address) // initiator
  //     }

  //     // Calculate expected shares with new rate
  //     const platformShare = (yieldAmount * 30n) / 100n // 30% goes to platform
  //     const creatorShare = yieldAmount - platformShare // 70% goes to creator

  //     // Verify balances after yield harvest
  //     const campaignBalanceAfter = await mockDAI.balanceOf(campaignAddress)
  //     const treasuryBalanceAfter = await mockDAI.balanceOf(
  //       platformTreasury.address
  //     )

  //     expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
  //       creatorShare
  //     )
  //     expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
  //       platformShare
  //     )
  //   })

  //   it('Should properly calculate weighted contributions and distribute yield to contributors', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       contributor2,
  //       mockDAI,
  //       mockDAIAToken,
  //       defiManager,
  //       platformTreasury
  //     } = await loadFixture(deployPlatformFixture)

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)
  //     const receipt = await tx.wait()
  //     if (!receipt) throw new Error('Transaction failed')

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })
  //     if (!event) throw new Error('Event failed')

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) throw new Error('parsedEvent failed')

  //     const campaignAddress = parsedEvent.args[1]
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // First contribution early in the campaign
  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaignAddress, CAMPAIGN_GOAL / 2n)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL / 2n)

  //     // Advance time by 1/4 of campaign duration
  //     await time.increase((CAMPAIGN_DURATION * 24 * 60 * 60) / 4)

  //     // Second contribution later in the campaign
  //     await mockDAI
  //       .connect(contributor2)
  //       .approve(campaignAddress, CAMPAIGN_GOAL / 2n)
  //     await campaign
  //       .connect(contributor2)
  //       .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL / 2n)

  //     // Deposit all funds to yield protocol
  //     await campaign
  //       .connect(creator)
  //       .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     // Generate yield - 10% of total deposit
  //     const yieldAmount = CAMPAIGN_GOAL / 10n

  //     const treasuryBalanceBefore = await mockDAI.balanceOf(
  //       platformTreasury.address
  //     )

  //     await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
  //     await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)
  //     await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

  //     const totalHarvestedYield = await campaign.totalHarvestedYield()

  //     // // Move past campaign end
  //     await time.increase(CAMPAIGN_DURATION * 24 * 60 * 60)

  //     // // Calculate weighted contributions
  //     await campaign.calculateWeightedContributions()

  //     const weightedContributions1 = await campaign.weightedContributions(
  //       contributor1.address
  //     )
  //     const weightedContributions2 = await campaign.weightedContributions(
  //       contributor2.address
  //     )

  //     // Get initial balances
  //     const contributor1BalanceBefore = await mockDAI.balanceOf(
  //       contributor1.address
  //     )
  //     const contributor2BalanceBefore = await mockDAI.balanceOf(
  //       contributor2.address
  //     )

  //     // // Contributors claim their yield
  //     await campaign.connect(contributor1).claimYield()
  //     await campaign.connect(contributor2).claimYield()

  //     // Calculate expected shares
  //     const platformShare = (yieldAmount * 2000n) / 10000n // 20% platform share
  //     const contributorsShare = yieldAmount - platformShare // 80% for contributors

  //     // Verify platform treasury received its share
  //     const treasuryBalanceAfter = await mockDAI.balanceOf(
  //       platformTreasury.address
  //     )

  //     expect(
  //       (await mockDAI.balanceOf(platformTreasury.address)) -
  //         treasuryBalanceBefore
  //     ).to.equal(platformShare)

  //     // Get actual yield received by contributors
  //     const contributor1YieldReceived =
  //       (await mockDAI.balanceOf(contributor1.address)) -
  //       contributor1BalanceBefore
  //     const contributor2YieldReceived =
  //       (await mockDAI.balanceOf(contributor2.address)) -
  //       contributor2BalanceBefore

  //     // Earlier contributor should receive more yield due to time weighting
  //     expect(contributor1YieldReceived).to.be.gt(contributor2YieldReceived)

  //     // Total distributed yield should match contributors' share (allowing for 1 wei rounding)
  //     const totalDistributed =
  //       contributor1YieldReceived + contributor2YieldReceived
  //     expect(totalDistributed).to.be.oneOf([
  //       contributorsShare,
  //       contributorsShare - 1n
  //     ])

  //     // Verify contributors cannot claim yield twice
  //     await expect(campaign.connect(contributor1).claimYield())
  //       .to.be.revertedWithCustomError(campaign, 'CampaignError')
  //       .withArgs(15, contributor1.address, 0)

  //     // Verify weighted contributions state
  //     expect(await campaign.weightedContributionsCalculated()).to.be.true
  //     expect(await campaign.totalWeightedContributions()).to.be.gt(0)

  //     // Verify the first contributor has higher weighted contribution due to earlier participation
  //     const contributor1Weight = await campaign.weightedContributions(
  //       contributor1.address
  //     )
  //     const contributor2Weight = await campaign.weightedContributions(
  //       contributor2.address
  //     )
  //     expect(contributor1Weight).to.be.gt(contributor2Weight)
  //   })

  //   it('Should handle operations at token support boundaries', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       mockDAI,
  //       tokenRegistry,
  //       owner
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1
  //     const OP_MIN_CONTRIBUTION_UPDATED = 5

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

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
  //       throw new Error('parsedEvent failed')
  //     }

  //     // Verify operation type and get campaign address
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)
  //     const campaignAddress = parsedEvent.args[1]
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Fund the campaign
  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaignAddress, CONTRIBUTION_AMOUNT)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), CONTRIBUTION_AMOUNT)

  //     // Increase minimum contribution amount
  //     const newMinContribution = 200 // Higher than initial setting
  //     const updateTx = await tokenRegistry
  //       .connect(owner)
  //       .updateTokenMinimumContribution(
  //         await mockDAI.getAddress(),
  //         newMinContribution
  //       )

  //     const updateReceipt = await updateTx.wait()

  //     // Verify the TokenRegistryOperation event
  //     const updateEvent = updateReceipt.logs.find(log => {
  //       try {
  //         const parsed = tokenRegistry.interface.parseLog(log)
  //         return (
  //           parsed &&
  //           parsed.name === 'TokenRegistryOperation' &&
  //           parsed.args[0] === OP_MIN_CONTRIBUTION_UPDATED
  //         )
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (updateEvent) {
  //       const parsedUpdateEvent = tokenRegistry.interface.parseLog(updateEvent)
  //       expect(parsedUpdateEvent.args[0]).to.equal(OP_MIN_CONTRIBUTION_UPDATED) // opType
  //       expect(parsedUpdateEvent.args[1]).to.equal(await mockDAI.getAddress()) // token
  //       // Here you could also check the value, which should be the converted minimum contribution amount
  //     }

  //     // Small contributions below the new minimum should still work with existing campaigns
  //     const smallAmount = ethers.parseUnits('10', 18)
  //     await mockDAI.connect(contributor1).approve(campaignAddress, smallAmount)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), smallAmount)

  //     // Create a second campaign with the same token
  //     const tx2 = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt2 = await tx2.wait()

  //     if (!receipt2) {
  //       throw new Error('receipt2 failed')
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
  //       throw new Error('event2 failed')
  //     }

  //     const parsedEvent2 = campaignContractFactory.interface.parseLog(event2)

  //     if (!parsedEvent2) {
  //       throw new Error('parsedEvent2 failed')
  //     }

  //     // Verify operation type and get campaign address for the second campaign
  //     expect(parsedEvent2.args[0]).to.equal(OP_CAMPAIGN_CREATED)
  //     const campaignAddress2 = parsedEvent2.args[1]
  //     expect(parsedEvent2.args[2]).to.equal(creator.address)

  //     // Get the second Campaign contract instance
  //     const campaign2 = Campaign.attach(
  //       campaignAddress2
  //     ) as unknown as ICampaign

  //     // For the new campaign, small contributions should still work
  //     // since the restriction is at factory level during campaign creation
  //     await mockDAI.connect(contributor1).approve(campaignAddress2, smallAmount)
  //     await campaign2
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), smallAmount)
  //   })
  // })

  // describe('Cross-contract Workflow Scenarios', function () {
  //   it('Should handle multiple campaigns by the same creator with different tokens', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       contributor2,
  //       mockDAI,
  //       mockUSDC
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1

  //     // Create a DAI campaign
  //     const tx1 = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt1 = await tx1.wait()
  //     if (!receipt1) throw new Error('Receipt1 failed')

  //     const event1 = receipt1.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event1) throw new Error('event1 failed')

  //     const parsedEvent1 = campaignContractFactory.interface.parseLog(event1)

  //     if (!parsedEvent1) throw new Error('parsedEvent1 failed')

  //     // Verify operation type and get campaign address
  //     expect(parsedEvent1.args[0]).to.equal(OP_CAMPAIGN_CREATED)
  //     const campaign1Address = parsedEvent1.args[1]
  //     expect(parsedEvent1.args[2]).to.equal(creator.address)

  //     // Create a USDC campaign
  //     const tx2 = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockUSDC.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt2 = await tx2.wait()
  //     if (!receipt2) throw new Error('receipt2 failed')

  //     const event2 = receipt2.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (!event2) throw new Error('event2 failed')

  //     const parsedEvent2 = campaignContractFactory.interface.parseLog(event2)
  //     if (!parsedEvent2) throw new Error('parsedEvent2 failed')

  //     // Verify operation type and get campaign address for the second campaign
  //     expect(parsedEvent2.args[0]).to.equal(OP_CAMPAIGN_CREATED)
  //     const campaign2Address = parsedEvent2.args[1]
  //     expect(parsedEvent2.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instances
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign1 = Campaign.attach(
  //       campaign1Address
  //     ) as unknown as ICampaign
  //     const campaign2 = Campaign.attach(
  //       campaign2Address
  //     ) as unknown as ICampaign

  //     // Verify both campaigns are owned by the creator
  //     expect(await campaign1.owner()).to.equal(creator.address)
  //     expect(await campaign2.owner()).to.equal(creator.address)

  //     // Fund the DAI campaign
  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaign1Address, CAMPAIGN_GOAL)
  //     await campaign1
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     // Fund the USDC campaign
  //     await mockUSDC
  //       .connect(contributor2)
  //       .approve(campaign2Address, CAMPAIGN_GOAL)
  //     await campaign2
  //       .connect(contributor2)
  //       .contribute(await mockUSDC.getAddress(), CAMPAIGN_GOAL)

  //     // Verify both campaigns are successful
  //     expect(await campaign1.isCampaignSuccessful()).to.be.true
  //     expect(await campaign2.isCampaignSuccessful()).to.be.true

  //     // Verify the campaigns are tracked correctly in the factory
  //     const creatorCampaigns =
  //       await campaignContractFactory.getCampaignsByCreator(creator.address)
  //     expect(creatorCampaigns).to.include(campaign1Address)
  //     expect(creatorCampaigns).to.include(campaign2Address)
  //     expect(creatorCampaigns.length).to.equal(2)
  //   })

  //   it('Should handle a campaign that updates treasury address during its lifecycle', async function () {
  //     const {
  //       campaignContractFactory,
  //       creator,
  //       contributor1,
  //       mockDAI,
  //       mockDAIAToken,
  //       defiManager,
  //       platformTreasury,
  //       yieldDistributor,
  //       owner
  //     } = await loadFixture(deployPlatformFixture)

  //     // Define relevant OP codes
  //     const OP_CAMPAIGN_CREATED = 1
  //     const OP_DEPOSIT = 1
  //     const OP_HARVEST = 2
  //     const OP_TREASURY_UPDATED = 1 // From YieldDistributor

  //     // Create a new campaign
  //     const tx = await campaignContractFactory
  //       .connect(creator)
  //       .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

  //     const receipt = await tx.wait()
  //     if (!receipt) throw new Error('Receipt failed')

  //     const event = receipt.logs.find(log => {
  //       try {
  //         const parsed = campaignContractFactory.interface.parseLog(log)
  //         return parsed && parsed.name === 'FactoryOperation'
  //       } catch {
  //         return false
  //       }
  //     })
  //     if (!event) throw new Error('event failed')

  //     const parsedEvent = campaignContractFactory.interface.parseLog(event)
  //     if (!parsedEvent) throw new Error('parsedEvent failed')

  //     // Verify operation type and get campaign address
  //     expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)
  //     const campaignAddress = parsedEvent.args[1]
  //     expect(parsedEvent.args[2]).to.equal(creator.address)

  //     // Get the Campaign contract instance
  //     const Campaign = await ethers.getContractFactory('Campaign')
  //     const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

  //     // Fund the campaign
  //     await mockDAI
  //       .connect(contributor1)
  //       .approve(campaignAddress, CAMPAIGN_GOAL)
  //     await campaign
  //       .connect(contributor1)
  //       .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     // Deposit to yield protocol
  //     const depositTx = await campaign
  //       .connect(creator)
  //       .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

  //     const depositReceipt = await depositTx.wait()

  //     // Verify the FundsOperation event for deposit
  //     const depositEvent = depositReceipt.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return (
  //           parsed &&
  //           parsed.name === 'FundsOperation' &&
  //           parsed.args[2] === OP_DEPOSIT
  //         )
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (depositEvent) {
  //       const parsedDepositEvent = campaign.interface.parseLog(depositEvent)
  //       expect(parsedDepositEvent.args[0]).to.equal(await mockDAI.getAddress()) // token
  //       expect(parsedDepositEvent.args[1]).to.equal(CAMPAIGN_GOAL) // amount
  //       expect(parsedDepositEvent.args[2]).to.equal(OP_DEPOSIT) // opType
  //       expect(parsedDepositEvent.args[4]).to.equal(creator.address) // initiator
  //     }

  //     // Generate first yield
  //     const yieldAmount = (CAMPAIGN_GOAL * 5n) / 100n
  //     await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
  //     await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

  //     // Harvest first yield with original treasury
  //     const treasuryBalanceBefore = await mockDAI.balanceOf(
  //       platformTreasury.address
  //     )

  //     const harvestTx1 = await campaign
  //       .connect(creator)
  //       .harvestYield(await mockDAI.getAddress())
  //     const harvestReceipt1 = await harvestTx1.wait()

  //     // Verify the FundsOperation event for first harvest
  //     const harvestEvent1 = harvestReceipt1.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return (
  //           parsed &&
  //           parsed.name === 'FundsOperation' &&
  //           parsed.args[2] === OP_HARVEST
  //         )
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (harvestEvent1) {
  //       const parsedHarvestEvent = campaign.interface.parseLog(harvestEvent1)
  //       expect(parsedHarvestEvent.args[0]).to.equal(await mockDAI.getAddress()) // token
  //       expect(parsedHarvestEvent.args[2]).to.equal(OP_HARVEST) // opType
  //       expect(parsedHarvestEvent.args[3]).to.not.equal(0) // yieldAmount
  //       expect(parsedHarvestEvent.args[4]).to.equal(creator.address) // initiator
  //     }

  //     const treasuryBalanceAfter = await mockDAI.balanceOf(
  //       platformTreasury.address
  //     )
  //     const platformShare = (yieldAmount * 20n) / 100n // 20% platform share

  //     expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
  //       platformShare
  //     )

  //     // Create a new treasury address
  //     const [, , , , , newTreasury] = await ethers.getSigners()

  //     // Update treasury address
  //     const updateTx = await yieldDistributor
  //       .connect(owner)
  //       .updatePlatformTreasury(newTreasury.address)

  //     const updateReceipt = await updateTx.wait()

  //     // Verify the YieldDistributorOperation event
  //     const treasuryUpdateEvent = updateReceipt.logs.find(log => {
  //       try {
  //         const parsed = yieldDistributor.interface.parseLog(log)
  //         return (
  //           parsed &&
  //           parsed.name === 'YieldDistributorOperation' &&
  //           parsed.args[0] === OP_TREASURY_UPDATED
  //         )
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (treasuryUpdateEvent) {
  //       const parsedUpdateEvent =
  //         yieldDistributor.interface.parseLog(treasuryUpdateEvent)
  //       expect(parsedUpdateEvent.args[0]).to.equal(OP_TREASURY_UPDATED) // opType
  //       expect(parsedUpdateEvent.args[1]).to.equal(platformTreasury.address) // oldTreasury
  //       expect(parsedUpdateEvent.args[2]).to.equal(newTreasury.address) // newTreasury
  //     }

  //     // Verify treasury was updated
  //     expect(await yieldDistributor.platformTreasury()).to.equal(
  //       newTreasury.address
  //     )

  //     // Generate second yield
  //     await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
  //     await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

  //     // Harvest second yield with new treasury
  //     const newTreasuryBalanceBefore = await mockDAI.balanceOf(
  //       newTreasury.address
  //     )

  //     const harvestTx2 = await campaign
  //       .connect(creator)
  //       .harvestYield(await mockDAI.getAddress())
  //     const harvestReceipt2 = await harvestTx2.wait()

  //     // Verify the FundsOperation event for second harvest
  //     const harvestEvent2 = harvestReceipt2.logs.find(log => {
  //       try {
  //         const parsed = campaign.interface.parseLog(log)
  //         return (
  //           parsed &&
  //           parsed.name === 'FundsOperation' &&
  //           parsed.args[2] === OP_HARVEST
  //         )
  //       } catch {
  //         return false
  //       }
  //     })

  //     if (harvestEvent2) {
  //       const parsedHarvestEvent = campaign.interface.parseLog(harvestEvent2)
  //       expect(parsedHarvestEvent.args[0]).to.equal(await mockDAI.getAddress()) // token
  //       expect(parsedHarvestEvent.args[2]).to.equal(OP_HARVEST) // opType
  //       expect(parsedHarvestEvent.args[3]).to.not.equal(0) // yieldAmount
  //       expect(parsedHarvestEvent.args[4]).to.equal(creator.address) // initiator
  //     }

  //     const newTreasuryBalanceAfter = await mockDAI.balanceOf(
  //       newTreasury.address
  //     )

  //     // Verify new treasury received the yield
  //     expect(newTreasuryBalanceAfter - newTreasuryBalanceBefore).to.equal(
  //       platformShare
  //     )

  //     // Original treasury balance should not have changed
  //     expect(await mockDAI.balanceOf(platformTreasury.address)).to.equal(
  //       treasuryBalanceAfter
  //     )
  //   })
  // })
})
