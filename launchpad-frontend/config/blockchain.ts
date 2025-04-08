import { Network } from 'alchemy-sdk'
import deployedAddresses from '../../deployed-addresses.json'
import { baseSepolia } from './networks'

export const NETWORK = Network.BASE_SEPOLIA

export const CONTRACT_ADDRESSES = {
  CAMPAIGN_FACTORY: deployedAddresses.CampaignContractFactory,
  PLATFORM_ADMIN: deployedAddresses.PlatformAdmin,
  TOKEN_REGISTRY: deployedAddresses.TokenRegistry,
  FEE_MANAGER: deployedAddresses.FeeManager,
  DEFI_INTEGRATION_MANAGER: deployedAddresses.DefiIntegrationManager,
  CAMPAIGN_EVENT_COLLECTOR: deployedAddresses.CampaignEventCollector
}

export const ALCHEMY_SETTINGS = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '',
  network: NETWORK
}
