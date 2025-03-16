import type { Signer } from 'ethers'

export interface ICampaign {
  // Base campaign methods
  owner(): Promise<string>
  campaignToken(): Promise<string>
  campaignId(): Promise<string> // Added campaignId
  campaignGoalAmount(): Promise<bigint>
  campaignDuration(): Promise<number>
  campaignStartTime(): Promise<bigint> // Added campaignStartTime
  campaignEndTime(): Promise<bigint>
  isCampaignActive(): Promise<boolean>
  isCampaignSuccessful(): Promise<boolean>
  isClaimed(): Promise<boolean>

  // Integration contracts
  defiManager(): Promise<string> // Added defiManager
  tokenRegistry(): Promise<string> // Added tokenRegistry

  // Contribution methods
  contributions(address: string): Promise<bigint>
  contributionTimestamps(address: string): Promise<bigint> // Added timestamps
  isContributor(address: string): Promise<boolean> // Added isContributor
  hasBeenRefunded(address: string): Promise<boolean> // Added hasBeenRefunded
  hasClaimedYield(address: string): Promise<boolean> // Added hasClaimedYield
  totalAmountRaised(): Promise<bigint>
  contribute(fromToken: string, amount: bigint): Promise<any>
  claimFunds(): Promise<any>
  requestRefund(): Promise<any>

  // Contributor enumeration
  firstContributor(): Promise<string> // Added firstContributor
  nextContributor(address: string): Promise<string> // Added nextContributor
  contributorsCount(): Promise<bigint> // Added contributorsCount

  // Yield and distribution methods
  totalHarvestedYield(): Promise<bigint> // Added totalHarvestedYield
  totalWeightedContributions(): Promise<bigint> // Added totalWeightedContributions
  weightedContributions(address: string): Promise<bigint> // Added weightedContributions
  weightedContributionsCalculated(): Promise<boolean> // Added weightedContributionsCalculated
  currentProcessingContributor(): Promise<string> // Added currentProcessingContributor
  calculateWeightedContributions(): Promise<any> // Added calculateWeightedContributions
  calculateWeightedContributionsBatch(
    batchSize: bigint
  ): Promise<[boolean, bigint]> // Added batch calculation
  resetWeightedContributionsCalculation(): Promise<any> // Added reset calculation
  calculateYieldShare(contributor: string): Promise<bigint> // Added calculateYieldShare
  claimYield(): Promise<any> // Added claimYield

  // DeFi integration methods
  getDepositedAmount(token: string): Promise<bigint>
  getCurrentYieldRate(token: string): Promise<bigint> // Added getCurrentYieldRate
  depositToYieldProtocol(token: string, amount: bigint): Promise<any>
  withdrawFromYieldProtocol(token: string, amount: bigint): Promise<any>
  withdrawAllFromYieldProtocol(token: string): Promise<any>
  harvestYield(token: string): Promise<any>

  // Admin operations
  withdrawFromYieldProtocolAdmin(token: string, amount: bigint): Promise<any> // Added admin methods
  withdrawAllFromYieldProtocolAdmin(token: string): Promise<any>
  harvestYieldAdmin(token: string): Promise<any>

  // Connection
  connect(signer: Signer): ICampaign
  interface: any
}
