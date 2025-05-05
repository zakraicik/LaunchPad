import { Alchemy, Network } from 'alchemy-sdk'
import { ALCHEMY_SETTINGS, CONTRACT_ADDRESSES } from '../config/blockchain'

// Initialize Alchemy
const alchemy = new Alchemy(ALCHEMY_SETTINGS)

// Get the latest block number
export const getLatestBlock = async () => {
  return await alchemy.core.getBlockNumber()
}

// Get contract events
export const getContractEvents = async (
  contractAddress: string,
  eventName: string
) => {
  return await alchemy.core.getLogs({
    address: contractAddress,
    topics: [eventName]
  })
}

// Get token metadata
export const getTokenMetadata = async (contractAddress: string) => {
  return await alchemy.core.getTokenMetadata(contractAddress)
}

// Get token balances
export const getTokenBalances = async (address: string) => {
  return await alchemy.core.getTokenBalances(address)
}

// Get NFT metadata
export const getNftMetadata = async (
  contractAddress: string,
  tokenId: string
) => {
  return await alchemy.nft.getNftMetadata(contractAddress, tokenId)
}

// Get transaction details
export const getTransaction = async (txHash: string) => {
  return await alchemy.core.getTransaction(txHash)
}

// Get block details
export const getBlock = async (blockNumber: number) => {
  return await alchemy.core.getBlock(blockNumber)
}

// Get contract code
export const getContractCode = async (address: string) => {
  return await alchemy.core.getCode(address)
}
