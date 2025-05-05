import { Network } from "alchemy-sdk";

// Default to mainnet (8453) if not specified
export const NETWORK = Network.BASE_MAINNET;

export const ALCHEMY_SETTINGS = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  network: NETWORK,
};
