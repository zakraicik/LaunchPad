import type { Signer } from 'ethers'

export interface IYieldDistributor {
  getPlatformYieldShare(): Promise<number>
  updatePlatformYieldShare(newShare: number): Promise<any>
  distributeYield(token: string, amount: bigint, campaign: string): Promise<any>
  connect(signer: Signer): IYieldDistributor
}
