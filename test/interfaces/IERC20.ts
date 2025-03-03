import type { Signer } from 'ethers'

export interface IERC20 {
  balanceOf(account: string): Promise<bigint>
  transfer(recipient: string, amount: bigint): Promise<boolean>
  approve(spender: string, amount: bigint): Promise<boolean>
  transferFrom(
    sender: string,
    recipient: string,
    amount: bigint
  ): Promise<boolean>
  mint(to: string, amount: bigint): Promise<any> // For mock tokens
  getAddress(): Promise<string>
  connect(signer: Signer): IERC20
}
