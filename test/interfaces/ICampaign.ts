import type { Signer } from 'ethers'

export interface ICampaign {
  // Base campaign methods
  owner(): Promise<string>
  campaignToken(): Promise<string>
  campaignGoalAmount(): Promise<bigint>
  campaignDuration(): Promise<number>
  campaignEndTime(): Promise<bigint>
  isCampaignActive(): Promise<boolean>
  isCampaignSuccessful(): Promise<boolean>
  isClaimed(): Promise<boolean>

  // Contribution methods
  contributions(address: string): Promise<bigint>
  totalAmountRaised(): Promise<bigint>
  contribute(fromToken: string, amount: bigint): Promise<any>
  claimFunds(): Promise<any>
  requestRefund(): Promise<any>

  // DeFi integration methods
  getDepositedAmount(token: string): Promise<bigint>
  depositToYieldProtocol(token: string, amount: bigint): Promise<any>
  withdrawFromYieldProtocol(token: string, amount: bigint): Promise<any>
  withdrawAllFromYieldProtocol(token: string): Promise<any>
  harvestYield(token: string): Promise<any>
  swapTokens(fromToken: string, amount: bigint, toToken: string): Promise<any>

  connect(signer: Signer): ICampaign
  interface: any
}
