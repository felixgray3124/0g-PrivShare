/*
    This is the configuration for the PrivShare dApp using 0G Storage.
    It is used to configure the storage settings and network endpoints.
*/

export const config = {
  // 0G Storage network configuration
  zgStorage: {
    rpcUrl: 'https://evmrpc-testnet.0g.ai/',
    indexerRpc: 'https://indexer-storage-testnet-turbo.0g.ai',
  },
  // File upload settings based on 0G SDK constants
  // DEFAULT_SEGMENT_SIZE = 256 * 1024 = 256KB (0G SDK default)
  // For large files, 0G SDK handles chunking automatically
  maxFileSize: 256 * 1024 * 1024, // 256MB (0G can handle much larger files)
  // Whether to enable Merkle proof verification for downloads
  enableProofVerification: true,
  // Whether to use CDN for the storage for faster retrieval
  withCDN: true,
} satisfies {
  zgStorage: {
    rpcUrl: string;
    indexerRpc: string;
  };
  maxFileSize: number;
  enableProofVerification: boolean;
  withCDN: boolean;
};
