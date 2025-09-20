/// <reference types="vite/client" />
import { createConfig, http } from 'wagmi'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// 0G Chain configuration
const zgChain = {
  id: 16601, // 0G Galileo Testnet
  name: '0G-Galileo-Testnet',
  network: '0g-galileo-testnet',
  nativeCurrency: {
    decimals: 18,
    name: '0G',
    symbol: '0G',
  },
  rpcUrls: {
    default: {
      http: ['https://evmrpc-testnet.0g.ai/'],
    },
    public: {
      http: ['https://evmrpc-testnet.0g.ai/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Chainscan',
      url: 'https://chainscan-galileo.0g.ai',
    },
  },
  testnet: true,
} as const

// Get WalletConnect Project ID
const getWalletConnectProjectId = () => {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
  
  // Only output debug information in development environment
  if (import.meta.env.DEV) {
    console.log('Environment variables:', {
      VITE_WALLETCONNECT_PROJECT_ID: projectId,
      allEnv: import.meta.env
    })
  }
  
  if (!projectId) {
    throw new Error(
      'VITE_WALLETCONNECT_PROJECT_ID is required. Please set it in your .env.local file'
    )
  }
  
  return projectId
}

export const config = createConfig({
  chains: [zgChain],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({
      projectId: getWalletConnectProjectId(),
    }),
  ],
  transports: {
    [zgChain.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
