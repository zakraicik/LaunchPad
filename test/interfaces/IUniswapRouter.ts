import type { Signer } from 'ethers'

export interface IUniswapRouter {
  swapExactTokensForTokens(
    amountIn: bigint,
    amountOutMin: bigint,
    path: string[],
    to: string,
    deadline: bigint
  ): Promise<bigint[]>
  connect(signer: Signer): IUniswapRouter
}
