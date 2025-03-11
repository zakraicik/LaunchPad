import type { Signer } from 'ethers'

export interface IDefiManager {
  depositToYieldProtocol(token: string, amount: bigint): Promise<boolean>
  withdrawFromYieldProtocol(
    token: string,
    amount: bigint,
    recipient: string
  ): Promise<boolean>
  harvestYield(token: string, campaign: string): Promise<boolean>
  getDepositedAmount(token: string, campaign: string): Promise<bigint>
  connect(signer: Signer): IDefiManager
}
