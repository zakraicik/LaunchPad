import type { Signer } from 'ethers'

export interface ICampaign {
  owner(): Promise<string>
  campaignToken(): Promise<string>
  campaignGoalAmount(): Promise<bigint>
  campaignDuration(): Promise<number>
  isCampaignActive(): Promise<boolean>
  campaignEndTime(): Promise<bigint>

  contributions(address: string): Promise<bigint>
  totalAmountRaised(): Promise<bigint>
  contribute(amount: bigint): Promise<any>
  isCampaignSuccessful(): Promise<boolean>
  claimFunds(): Promise<any>
  isClaimed(): Promise<boolean>
  requestRefund(): Promise<any>

  connect(signer: Signer): ICampaign
  interface: any
}
