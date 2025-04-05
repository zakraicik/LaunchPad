//npx hardhat run scripts/make-contribution.ts --network baseSepolia
import { ethers } from 'hardhat'
import {
  IERC20Metadata,
  Campaign,
  IDefiIntegrationManager,
  ITokenRegistry
} from '../typechain-types'

async function main () {
  const [deployer] = await ethers.getSigners()
  console.log(`Using account: ${deployer.address}`)

  // Campaign parameters
  const campaignAddress = '0x6f390872385f0238d2c0d1e3a963c36f1d0f8ef4'
  const tokenAddress = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'
  const defiManagerAddress = '0x56b236dF8f47CC0Cf258C477d387Ec8bCfE5C170'

  try {
    const campaign = (await ethers.getContractAt(
      'Campaign',
      campaignAddress
    )) as Campaign

    const token = (await ethers.getContractAt(
      'IERC20Metadata',
      tokenAddress
    )) as IERC20Metadata

    const decimals = await token.decimals()
    const tokenSymbol = await token.symbol()
    console.log(`Token: ${tokenSymbol} (${tokenAddress})`)
    console.log(`Decimals: ${decimals}`)

    // Get campaign details
    console.log('\n--- Campaign Details ---')
    const campaignGoalAmount = await campaign.campaignGoalAmount()
    const totalAmountRaised = await campaign.totalAmountRaised()
    const campaignStartTime = await campaign.campaignStartTime()
    const campaignEndTime = await campaign.campaignEndTime()
    const isActive = await campaign.isCampaignActive()
    const isSuccessful = await campaign.isCampaignSuccessful()
    const adminOverride = await campaign.adminOverride()

    console.log(
      `Campaign Goal: ${ethers.formatUnits(
        campaignGoalAmount,
        decimals
      )} ${tokenSymbol}`
    )
    console.log(
      `Total Raised: ${ethers.formatUnits(
        totalAmountRaised,
        decimals
      )} ${tokenSymbol}`
    )
    console.log(
      `Start Time: ${new Date(
        Number(campaignStartTime) * 1000
      ).toLocaleString()}`
    )
    console.log(
      `End Time: ${new Date(Number(campaignEndTime) * 1000).toLocaleString()}`
    )
    console.log(`Campaign Active: ${isActive}`)
    console.log(`Campaign Successful: ${isSuccessful}`)
    console.log(`Admin Override: ${adminOverride}`)

    // Get token registry details
    const defiManager = (await ethers.getContractAt(
      'IDefiIntegrationManager',
      defiManagerAddress
    )) as IDefiIntegrationManager

    console.log('\n--- DeFi Manager Details ---')
    const tokenRegistryAddress = await defiManager.tokenRegistry()
    console.log(`Token Registry: ${tokenRegistryAddress}`)

    const tokenRegistry = (await ethers.getContractAt(
      'ITokenRegistry',
      tokenRegistryAddress
    )) as ITokenRegistry

    // Check token support
    let isTokenSupported = false
    try {
      isTokenSupported = await tokenRegistry.isTokenSupported(tokenAddress)
      console.log(`Is Token Supported: ${isTokenSupported}`)

      if (isTokenSupported) {
        // Get min contribution amount
        const minContribution = await tokenRegistry.getMinContributionAmount(
          tokenAddress
        )
        console.log(
          `Min Contribution: ${ethers.formatUnits(
            minContribution[0],
            decimals
          )} ${tokenSymbol}`
        )
      }
    } catch (error) {
      console.log('Error checking token support:', error)
    }

    // Check aToken address
    try {
      const aTokenAddress = await defiManager.getATokenAddress(tokenAddress)
      console.log(`aToken Address: ${aTokenAddress}`)
    } catch (error) {
      console.log('Error getting aToken address:', error)
    }

    // Check user balance
    const userBalance = await token.balanceOf(deployer.address)
    console.log(`\n--- User Details ---`)
    console.log(`User Address: ${deployer.address}`)
    console.log(
      `Token Balance: ${ethers.formatUnits(
        userBalance,
        decimals
      )} ${tokenSymbol}`
    )

    // Contribution amount (try a smaller amount)
    const contributionAmount = ethers.parseUnits('0.1', decimals)
    console.log(
      `Contribution Amount: ${ethers.formatUnits(
        contributionAmount,
        decimals
      )} ${tokenSymbol}`
    )

    // Check and update allowance
    const currentAllowance = await token.allowance(
      deployer.address,
      campaignAddress
    )
    console.log(
      `Current Allowance: ${ethers.formatUnits(
        currentAllowance,
        decimals
      )} ${tokenSymbol}`
    )

    if (currentAllowance < contributionAmount) {
      console.log(`Approving tokens...`)
      const approveTx = await token.approve(campaignAddress, contributionAmount)
      await approveTx.wait()
      console.log(`Approval successful: ${approveTx.hash}`)

      const newAllowance = await token.allowance(
        deployer.address,
        campaignAddress
      )
      console.log(
        `New Allowance: ${ethers.formatUnits(
          newAllowance,
          decimals
        )} ${tokenSymbol}`
      )
    }

    console.log('\n--- Attempting contribution ---')
    console.log('This may fail with limited error information...')

    try {
      const contributeTx = await campaign.contribute(contributionAmount)
      await contributeTx.wait()
      console.log(`Contribution successful! Hash: ${contributeTx.hash}`)
    } catch (error) {
      console.log('Contribution failed with error:')
      console.log(error)
    }
  } catch (error) {
    console.error('Script error:', error)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
