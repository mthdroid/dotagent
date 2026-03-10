// DotAgent — Multi-chain Configuration
// Polkadot Hub EVM + Ethereum chains

export const CHAINS = {
  // ─── Polkadot Hub ───
  polkadotHub: {
    name: 'Polkadot Hub',
    chainId: 420420420,
    rpcUrl: 'https://polkadot-hub-rpc.polkadot.io',
    explorer: 'https://polkadot-hub.subscan.io',
    type: 'mainnet',
    tokens: {},
    aave: null,
    swap: null
  },

  polkadotHubTestnet: {
    name: 'Polkadot Hub Testnet',
    chainId: 420420421,
    rpcUrl: 'https://westend-asset-hub-eth-rpc.polkadot.io',
    explorer: 'https://westend-hub.subscan.io',
    type: 'testnet',
    tokens: {},
    aave: null,
    swap: null
  },

  // ─── Passet Hub (Alt Testnet) ───
  passetHub: {
    name: 'Passet Hub Testnet',
    chainId: 420420422,
    rpcUrl: 'https://testnet-passet-hub-eth-rpc.polkadot.io',
    explorer: 'https://passet-hub.subscan.io',
    type: 'testnet',
    tokens: {},
    aave: null,
    swap: null
  },

  // ─── Ethereum Testnets (for cross-chain demo) ───
  sepolia: {
    name: 'Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://sepolia.drpc.org',
    explorer: 'https://sepolia.etherscan.io',
    type: 'testnet',
    tokens: {
      USDT: { address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', decimals: 6 },
      DAI: { address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357', decimals: 18 },
      USDC: { address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', decimals: 6 },
      WETH: { address: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c', decimals: 18 }
    },
    aave: {
      pool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
      faucet: '0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D'
    },
    swap: 'uniswap'
  },

  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    type: 'testnet',
    tokens: {
      USDT: { address: '0x0a215D8ba66387DCA84B284D18c3B4ec3de6E54a', decimals: 6 },
      USDC: { address: '0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f', decimals: 6 },
      WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 }
    },
    aave: {
      pool: '0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27',
      dataProvider: '0xBc9f5b7E248451CdD7cA54e717a2BFe1F32b566b',
      faucet: '0xD9145b5F45Ad4519c7ACcD6E0A4A82e83bB8A6Dc',
      aTokens: {
        USDT: '0xcE3CAae5Ed17A7AafCEEbc897DE843fA6CC0c018',
        USDC: '0x10F1A9D11CDf50041f3f8cB7191CBE2f31750ACC',
        WETH: '0x73a5bB60b0B0fc35710DDc0ea9c407031E31Bdbb'
      }
    },
    swap: 'uniswap',
    uniswap: {
      SWAP_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
      QUOTER_V2: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27',
      FACTORY: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'
    }
  }
}

/**
 * Resolve chain config from env vars or chain name
 * @param {string} [chainName] - Chain name override (default: auto-detect)
 * @returns {object} Chain configuration
 */
export function resolveChainConfig (chainName) {
  if (chainName && CHAINS[chainName]) {
    return { ...CHAINS[chainName] }
  }
  return { ...CHAINS.baseSepolia }
}

/**
 * Get chain config by chain ID
 * @param {number} chainId
 * @returns {object|null} Chain configuration
 */
export function getChainById (chainId) {
  for (const config of Object.values(CHAINS)) {
    if (config.chainId === chainId) return { ...config }
  }
  return null
}

/**
 * Check if chain is Polkadot Hub
 * @param {number} chainId
 * @returns {boolean}
 */
export function isPolkadotHub (chainId) {
  return [420420420, 420420421, 420420422].includes(chainId)
}
