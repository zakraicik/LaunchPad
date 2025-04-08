import { createConfig, http } from 'wagmi'
import { baseSepolia, baseMainnet } from './networks'

export const config = createConfig({
  chains: [baseSepolia, baseMainnet],
  transports: {
    [baseSepolia.id]: http(),
    [baseMainnet.id]: http()
  }
})

export const { chains } = config
