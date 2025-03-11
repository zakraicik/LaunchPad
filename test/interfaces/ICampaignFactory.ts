import type { Signer } from 'ethers'

export interface ICampaignFactory {
  deploy(token: string, goal: bigint, duration: number): Promise<any>
  getCampaignCount(): Promise<number>
  getCampaignAddress(index: number): Promise<string>
  connect(signer: Signer): ICampaignFactory
  interface: any
}
