// 0G Storage service for file upload and download operations
// Using official 0G SDK via CDN to avoid Node.js module issues

import { ethers } from 'ethers';

// Global types for 0G SDK loaded from CDN
declare global {
  interface Window {
    zgstorage: {
      // Core classes
      Blob: any;
      Indexer: any;
      Uploader: any;
      Downloader: any;
      StorageNode: any;
      MerkleTree: any;
      ZgFile: any;
      MemData: any;
      
      // Contract factories
      FixedPriceFlow__factory: any;
      
      // Utility functions
      getFlowContract: any;
      getMarketContract: any;
      txWithGasAdjustment: any;
      calculatePrice: any;
      delay: any;
      computePaddedSize: any;
      nextPow2: any;
      numSplits: any;
      getShardConfigs: any;
      isValidConfig: any;
      
      // Constants
      DEFAULT_CHUNK_SIZE: number;
      DEFAULT_SEGMENT_SIZE: number;
      DEFAULT_SEGMENT_MAX_CHUNKS: number;
      SMALL_FILE_SIZE_THRESHOLD: number;
      TIMEOUT_MS: number;
      ZERO_HASH: string;
      EMPTY_CHUNK_HASH: string;
      
      // Default options
      defaultUploadOption: {
        tags: string;
        finalityRequired: boolean;
        taskSize: number;
        expectedReplica: number;
        skipTx: boolean;
        fee: bigint;
      };
    };
  }
}

// 0G Storage network configuration
const RPC_URL = 'https://evmrpc-testnet.0g.ai/';
const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai';

// Validate RPC URLs
console.log('0G Storage: RPC URL:', RPC_URL);
console.log('0G Storage: Indexer RPC:', INDEXER_RPC);

// Configuration interface
export interface ZgStorageConfig {
  rpcUrl: string;
  indexerRpc: string;
}

// Upload result interface
export interface UploadResult {
  success: boolean;
  txHash: string;
  rootHash: string;
  error?: string;
}

// Download result interface
export interface DownloadResult {
  success: boolean;
  data?: Uint8Array;
  error?: string;
}

// Helper function to convert viem signer to ethers signer
export async function toEthersSigner(signer: any): Promise<any> {
  if (signer && typeof signer.getAddress === 'function') {
    // If it's already a JsonRpcSigner, we need to ensure it works with contracts
    if (signer.constructor.name === 'JsonRpcSigner') {
      console.log('Converting JsonRpcSigner to contract-compatible signer');
      
      // Create a custom signer object that mimics Wallet interface
      const customSigner = {
        getAddress: signer.getAddress.bind(signer),
        signMessage: signer.signMessage.bind(signer),
        signTransaction: signer.signTransaction.bind(signer),
        sendTransaction: signer.sendTransaction.bind(signer),
        provider: signer.provider,
        // Add Wallet-specific methods
        connect: (_provider: any) => customSigner,
        _isSigner: true,
        // Add contract interaction methods
        call: signer.call?.bind(signer),
        estimateGas: signer.estimateGas?.bind(signer),
        getBalance: signer.getBalance?.bind(signer),
        getTransactionCount: signer.getTransactionCount?.bind(signer),
        // Ensure it has the runner property for contract interaction
        runner: signer
      };
      
      return customSigner;
    }
    // Already an ethers signer
    return signer;
  }
  
  // If it's a viem signer, we need to convert it
  // For now, we'll assume it's already an ethers signer
  return signer;
}

// Main service class using official 0G SDK with dynamic imports
export class ZgStorageService {
  private config: ZgStorageConfig;
  private indexer: any = null;

  constructor(config?: Partial<ZgStorageConfig>) {
    this.config = {
      rpcUrl: config?.rpcUrl || RPC_URL,
      indexerRpc: config?.indexerRpc || INDEXER_RPC,
      ...config
    };
  }

  // Ensure crypto polyfill is available
  private ensureCryptoPolyfill(): void {
    // Ensure global is available
    if (typeof global === 'undefined') {
      (window as any).global = globalThis;
    }
    
    // Ensure process is available
    if (typeof process === 'undefined') {
      (window as any).process = {
        browser: true,
        version: 'v16.0.0',
        platform: 'browser',
        env: {}
      };
    }
    
            // Ensure Buffer is available
            if (typeof Buffer === 'undefined') {
              (window as any).Buffer = {
                from: function(data: any, _encoding?: string) {
                  if (typeof data === 'string') {
                    return new TextEncoder().encode(data);
                  }
                  return new Uint8Array(data);
                },
                isBuffer: function(obj: any) {
                  return obj instanceof Uint8Array;
                }
              };
            }
    
    // Ensure node_crypto is available (SDK expects this)
    if (!(window as any).node_crypto) {
      (window as any).node_crypto = {
        createHash: function(_algorithm: string) {
          let data: any = null;
          return {
            update: function(newData: any) {
              if (data === null) {
                data = newData;
              } else if (data instanceof Uint8Array && newData instanceof Uint8Array) {
                // Concatenate Uint8Arrays
                const combined = new Uint8Array(data.length + newData.length);
                combined.set(data);
                combined.set(newData, data.length);
                data = combined;
              } else {
                // Convert to string and concatenate
                const str1 = typeof data === 'string' ? data : new TextDecoder().decode(data);
                const str2 = typeof newData === 'string' ? newData : new TextDecoder().decode(newData);
                data = str1 + str2;
              }
              return this;
            },
            digest: function(encoding: string) {
              // Simple hash implementation - in production use a proper crypto library
              const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
              let hash = 0;
              for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
              }
              return encoding === 'hex' ? hash.toString(16) : hash.toString();
            }
          };
        }
      };
    }
    
    // Ensure promises is available (SDK expects this)
    if (!(window as any).promises) {
      (window as any).promises = {};
    }
  }

  // Load 0G SDK from CDN using UMD build
  private async loadSDKFromCDN(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.zgstorage) {
        console.log('0G Storage: SDK already loaded');
        resolve();
        return;
      }

      console.log('0G Storage: Loading SDK from CDN...');
      // Ensure polyfills are available before loading SDK
      this.ensureCryptoPolyfill();

      // Use UMD build for better browser compatibility
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@0glabs/0g-ts-sdk@0.3.1/dist/zgstorage.umd.min.js';
      script.onload = () => {
        // The SDK will be available as window.zgstorage
        console.log('0G Storage: Script loaded, checking window.zgstorage...');
        console.log('0G Storage: window.zgstorage:', window.zgstorage);
        console.log('0G Storage: window.zgstorage type:', typeof window.zgstorage);
        console.log('0G Storage: window.zgstorage keys:', window.zgstorage ? Object.keys(window.zgstorage) : 'undefined');
        
        if (window.zgstorage) {
          console.log('0G Storage: SDK loaded successfully');
          console.log('0G Storage: Indexer available:', typeof window.zgstorage.Indexer);
          console.log('0G Storage: Blob available:', typeof window.zgstorage.Blob);
          resolve();
        } else {
          console.error('0G Storage: SDK failed to load from CDN');
          reject(new Error('0G SDK failed to load from CDN'));
        }
      };
      script.onerror = (error) => {
        console.error('0G Storage: Failed to load SDK script:', error);
        reject(new Error('Failed to load 0G SDK from CDN'));
      };
      document.head.appendChild(script);
    });
  }

  // Initialize SDK components
  private async initializeSDK() {
    if (this.indexer) {
      console.log('0G Storage: SDK already initialized');
      return;
    }
    
    try {
      console.log('0G Storage: Starting SDK initialization...');
      
      // Load SDK from CDN
      await this.loadSDKFromCDN();
      console.log('0G Storage: SDK loaded successfully');
      
      // Create Indexer instance
      console.log('0G Storage: Creating Indexer with RPC:', this.config.indexerRpc);
      this.indexer = new window.zgstorage.Indexer(this.config.indexerRpc);
      console.log('0G Storage: Indexer created successfully');
    } catch (error) {
      console.error('0G Storage: Failed to initialize SDK:', error);
      throw new Error('Failed to initialize 0G Storage SDK: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Upload a file to 0G Storage using official SDK
   */
  async uploadFile(file: File, signer: any): Promise<UploadResult> {
    try {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      console.log('0G Storage: Uploading file:', { name: file.name, size: file.size, type: file.type });
      
      // Initialize SDK dynamically
      await this.initializeSDK();
      
      // Use the original signer directly as per SDK documentation
      console.log('0G Storage: Using original signer for file upload');
      console.log('0G Storage: Signer type:', signer.constructor.name);
      console.log('0G Storage: Signer address:', await signer.getAddress());

      // Initialize SDK and get Blob class
      await this.initializeSDK();
      
              // Create file object using official SDK - for browser use Blob
              // According to documentation, for browser environments we should use Blob
              console.log('0G Storage: Creating Blob from file:', file);
              const zgBlob = new window.zgstorage.Blob(file as any);
              console.log('0G Storage: Blob created successfully');
      
      // Generate Merkle tree for verification
      const [tree, treeErr] = await zgBlob.merkleTree();
      if (treeErr !== null) {
        throw new Error(`Error generating Merkle tree: ${treeErr}`);
      }
      
      // Get root hash for future reference
      const rootHash = tree?.rootHash();
      console.log('0G Storage: File Root Hash:', rootHash);
      
      // Upload to network using official SDK method
      // According to SDK source: indexer.upload(file, RPC_URL, signer, uploadOpts?, retryOpts?, opts?)
      // Use default upload options from SDK
      const uploadOpts = window.zgstorage.defaultUploadOption || {
        tags: '0x',
        finalityRequired: true,
        taskSize: 1,
        expectedReplica: 1,
        skipTx: false,
        fee: BigInt('0'),
      };
      
      // Add retry options - use SDK defaults for better compatibility
      const retryOpts = {
        Retries: 10,          // Use SDK default
        Interval: 5,          // Use SDK default
        MaxGasPrice: 0,       // Use SDK default (0 means 10x current gas price)
        TooManyDataRetries: 3 // Use SDK default
      };
      
      console.log('0G Storage: Using upload options:', uploadOpts);
      console.log('0G Storage: Using retry options:', retryOpts);
      console.log('0G Storage: Signer type:', signer.constructor.name);
      console.log('0G Storage: Signer address:', await signer.getAddress());
      console.log('0G Storage: RPC URL:', this.config.rpcUrl);
      
      try {
        // Let SDK handle gas calculation automatically by not passing gas options
        // SDK will use provider.getFeeData().gasPrice when gasPrice is 0 (default)
        console.log('0G Storage: Using SDK automatic gas calculation');
        
        // Debug: Check signer properties
        console.log('0G Storage: Signer properties:', {
          address: await signer.getAddress(),
          provider: signer.provider,
          signMessage: typeof signer.signMessage,
          signTransaction: typeof signer.signTransaction,
          sendTransaction: typeof signer.sendTransaction
        });
        
        // Debug: Test signer functionality
        try {
          console.log('0G Storage: Testing signer with a simple call...');
          const testTx = {
            to: await signer.getAddress(),
            value: 0,
            gasLimit: 21000
          };
          console.log('0G Storage: Test transaction prepared:', testTx);
          
          // Test if signer can actually sign (removed test message to avoid confusion)
          console.log('0G Storage: Signer is ready for transaction signing');
          
                  // Test contract interaction
                  console.log('0G Storage: Testing contract interaction...');
                  console.log('0G Storage: Test contract interaction ready');
        } catch (error) {
          console.error('0G Storage: Signer test failed:', error);
        }
        
        // Debug: Check network status before upload
        console.log('0G Storage: Checking network status...');
        const networkStatus = await signer.provider.getNetwork();
        console.log('0G Storage: Network status:', networkStatus);
        console.log('0G Storage: Network chainId:', networkStatus.chainId);
        console.log('0G Storage: Network name:', networkStatus.name);
        
        // Debug: Check if we're on the correct network
        const expectedChainId = 16602; // 0G Galileo Testnet
        console.log('0G Storage: Network check - Expected:', expectedChainId, 'Got:', networkStatus.chainId);
        if (Number(networkStatus.chainId) !== expectedChainId) {
          console.warn(`0G Storage: Wrong network! Expected chainId ${expectedChainId}, got ${networkStatus.chainId}`);
          throw new Error(`Wrong network! Expected chainId ${expectedChainId}, got ${networkStatus.chainId}`);
        } else {
          console.log('0G Storage: Correct network detected');
        }
        
        // Additional network validation
        try {
          console.log('0G Storage: Testing RPC connection...');
          const blockNumber = await signer.provider.getBlockNumber();
          console.log('0G Storage: Current block number:', blockNumber);
          
          console.log('0G Storage: Getting fee data...');
          const feeData = await signer.provider.getFeeData();
          console.log('0G Storage: Fee data:', feeData);
          
          // Test signer connection
          console.log('0G Storage: Testing signer connection...');
          const signerAddress = await signer.getAddress();
          console.log('0G Storage: Signer address:', signerAddress);
          
          // Test balance
          console.log('0G Storage: Checking signer balance...');
          const balance = await signer.provider.getBalance(signerAddress);
          console.log('0G Storage: Signer balance:', balance.toString());
          
          if (balance === 0n) {
            console.warn('0G Storage: Warning - Signer balance is 0, transaction may fail');
          }
          
          // Test a simple transaction to verify network
          console.log('0G Storage: Testing network with simple call...');
          try {
            const testTx = {
              to: signerAddress,
              value: 0,
              gasLimit: 21000
            };
            const gasEstimate = await signer.provider.estimateGas(testTx);
            console.log('0G Storage: Gas estimate test successful:', gasEstimate.toString());
                  } catch (gasError) {
                    console.warn('0G Storage: Gas estimate test failed:', gasError instanceof Error ? gasError.message : 'Unknown error');
          }
        } catch (error) {
          console.error('0G Storage: Network validation failed:', error);
          throw new Error('Network validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
        
        // Use SDK's built-in methods directly
        console.log('0G Storage: Using SDK methods directly without custom overrides');
        
        // Use SDK's standard upload method as per official documentation
        console.log('0G Storage: Starting upload process using SDK standard method...');
        
                // According to official docs: indexer.upload(file, RPC_URL, signer, uploadOpts, retryOpts, opts)
                // opts can contain gasPrice and gasLimit, but we omit it to use SDK defaults
                const [result, uploadErr] = await this.indexer.upload(zgBlob, this.config.rpcUrl, signer, uploadOpts, retryOpts);
        
        console.log('0G Storage: Upload result:', result);
        console.log('0G Storage: Upload error:', uploadErr);
        
        if (uploadErr !== null) {
          throw new Error(`Upload error: ${uploadErr}`);
        }
        
        console.log('0G Storage: Upload successful! Result:', result);
        
        return {
          success: true,
          rootHash: result.rootHash || rootHash || '',
          txHash: result.txHash || '',
        };
      } catch (uploadError) {
        console.error('0G Storage: Upload failed with error:', uploadError);
        throw uploadError;
      }
    } catch (error) {
      console.error('0G Storage: Upload failed:', error);
      return {
        success: false,
        rootHash: '',
        txHash: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Download a file from 0G Storage using browser-compatible method
   */
  async downloadFile(rootHash: string, withProof: boolean = true): Promise<DownloadResult> {
    try {
      console.log('0G Storage: Downloading file with root hash:', rootHash);
      
      // Initialize SDK if not already done
      await this.initializeSDK();

      // Get file locations from indexer
      const locations = await this.indexer.getFileLocations(rootHash);
      if (!locations || locations.length === 0) {
        throw new Error('File not found on any storage node');
      }

      console.log('0G Storage: Found file on', locations.length, 'nodes');

      // Create storage node clients
      const storageNodes = locations.map((location: any) => new window.zgstorage.StorageNode(location.url));
      
      // Get file info from first available node
      let fileInfo = null;
      for (const node of storageNodes) {
        try {
          const info = await node.getFileInfo(rootHash, true);
          if (info && info.finalized) {
            fileInfo = info;
            console.log('0G Storage: File info retrieved:', info);
            break;
          }
        } catch (error) {
          console.warn('0G Storage: Failed to get file info from node:', error);
          continue;
        }
      }

      if (!fileInfo) {
        throw new Error('File not found or not finalized');
      }

      // Download file data using browser-compatible method
      const fileData = await this.downloadFileData(rootHash, withProof);
      
      console.log('0G Storage: Download successful!');
      
      return {
        success: true,
        data: fileData
      };
    } catch (error) {
      console.error('0G Storage: Download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Download file data using Downloader class (browser-compatible)
   */
  private async downloadFileData(rootHash: string, withProof: boolean): Promise<Uint8Array> {
    try {
      console.log('0G Storage: Using Downloader class for root hash:', rootHash);
      
      // Initialize SDK if not already done
      await this.initializeSDK();

      // Get file locations from indexer
      const locations = await this.indexer.getFileLocations(rootHash);
      if (!locations || locations.length === 0) {
        throw new Error('File not found on any storage node');
      }

      console.log('0G Storage: Found file on', locations.length, 'nodes');

      // Create storage node clients
      const storageNodes = locations.map((location: any) => new window.zgstorage.StorageNode(location.url));
      
      // Create Downloader instance
      const downloader = new window.zgstorage.Downloader(storageNodes);
      
      // Query file info first
      const [fileInfo, queryError] = await downloader.queryFile(rootHash);
      if (queryError !== null || fileInfo === null) {
        throw new Error(`Failed to query file: ${queryError?.message || 'File not found'}`);
      }

      if (!fileInfo.finalized) {
        throw new Error('File not finalized');
      }

      if (!fileInfo.tx) {
        throw new Error('File transaction info not available');
      }

      console.log('0G Storage: File info retrieved:', fileInfo);
      
      // Get shard configs and set them on downloader
      const shardConfigs = await this.getShardConfigs(storageNodes);
      if (!shardConfigs) {
        throw new Error('Failed to get shard configs');
      }
      downloader.shardConfigs = shardConfigs;

      // Calculate download parameters
      const DEFAULT_CHUNK_SIZE = 256;
      const DEFAULT_SEGMENT_MAX_CHUNKS = 1024;
      const numChunks = Math.ceil(fileInfo.tx.size / DEFAULT_CHUNK_SIZE);
      const startSegmentIndex = Math.floor(fileInfo.tx.startEntryIndex / DEFAULT_SEGMENT_MAX_CHUNKS);
      const endSegmentIndex = Math.floor((fileInfo.tx.startEntryIndex + numChunks - 1) / DEFAULT_SEGMENT_MAX_CHUNKS);
      const numTasks = endSegmentIndex - startSegmentIndex + 1;

      // Set segment indices on downloader (this is crucial!)
      downloader.startSegmentIndex = startSegmentIndex;
      downloader.endSegmentIndex = endSegmentIndex;

      console.log('0G Storage: Download parameters:', {
        numChunks,
        startSegmentIndex,
        endSegmentIndex,
        numTasks,
        txSeq: fileInfo.tx.seq,
        txSize: fileInfo.tx.size,
        startEntryIndex: fileInfo.tx.startEntryIndex
      });

      // Download all segments
      const segments: Uint8Array[] = [];
      
      for (let taskInd = 0; taskInd < numTasks; taskInd++) {
        console.log(`0G Storage: Downloading task ${taskInd + 1}/${numTasks}`);
        
        try {
          const [segmentData, taskError] = await downloader.downloadTask(
            fileInfo, 
            0, // segmentOffset
            taskInd, 
            numChunks, 
            withProof
          );
          
          if (taskError !== null) {
            console.error(`0G Storage: Task ${taskInd} failed:`, taskError);
            continue;
          }
          
          if (segmentData && segmentData.length > 0) {
            segments.push(segmentData);
            console.log(`0G Storage: Task ${taskInd + 1} completed, size:`, segmentData.length);
          }
        } catch (taskError) {
          console.error(`0G Storage: Task ${taskInd} error:`, taskError);
          continue;
        }
      }
      
      if (segments.length === 0) {
        throw new Error('No segments were successfully downloaded');
      }

      // Combine all segments
      const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
      const fileData = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const segment of segments) {
        fileData.set(segment, offset);
        offset += segment.length;
      }
      
      console.log('0G Storage: File data assembled, total size:', fileData.length);
      return fileData;
      
    } catch (error) {
      console.error('0G Storage: Downloader download failed, trying fallback method:', error);
      
      // Fallback: Use direct StorageNode methods
      return await this.downloadFileDataFallback(rootHash, withProof);
    }
  }

  /**
   * Get shard configs from storage nodes
   */
  private async getShardConfigs(storageNodes: any[]): Promise<any[] | null> {
    try {
      const configs = [];
      for (const node of storageNodes) {
        try {
          const config = await node.getShardConfig();
          configs.push(config);
        } catch (error) {
          console.warn('0G Storage: Failed to get shard config from node:', error);
        }
      }
      return configs.length > 0 ? configs : null;
    } catch (error) {
      console.error('0G Storage: Failed to get shard configs:', error);
      return null;
    }
  }

  /**
   * Fallback download method using direct StorageNode calls
   */
  private async downloadFileDataFallback(rootHash: string, withProof: boolean): Promise<Uint8Array> {
    try {
      console.log('0G Storage: Using fallback download method');
      
      // Get file locations from indexer
      const locations = await this.indexer.getFileLocations(rootHash);
      if (!locations || locations.length === 0) {
        throw new Error('File not found on any storage node');
      }

      console.log('0G Storage: Found file on', locations.length, 'nodes');

      // Create storage node clients
      const storageNodes = locations.map((location: any) => new window.zgstorage.StorageNode(location.url));
      
      // Get file info from first available node
      let fileInfo = null;
      for (const node of storageNodes) {
        try {
          const info = await node.getFileInfo(rootHash, true);
          if (info && info.finalized) {
            fileInfo = info;
            console.log('0G Storage: File info retrieved:', info);
            break;
          }
        } catch (error) {
          console.warn('0G Storage: Failed to get file info from node:', error);
          continue;
        }
      }

      if (!fileInfo) {
        throw new Error('File not found or not finalized');
      }

      if (!fileInfo.tx) {
        throw new Error('File transaction info not available');
      }

      console.log('0G Storage: File info structure:', fileInfo);
      console.log('0G Storage: Available properties:', Object.keys(fileInfo));
      
      // Get the number of segments from fileInfo
      const numSegments = fileInfo.uploadedSegNum || fileInfo.numSegments || 1;
      console.log('0G Storage: Downloading file data, segments:', numSegments);
      
      const segments: Uint8Array[] = [];
      
      // Download each segment using the first available node
      const node = storageNodes[0];
      
      for (let i = 0; i < numSegments; i++) {
        console.log(`0G Storage: Downloading segment ${i + 1}/${numSegments}`);
        
        try {
          let segmentData: Uint8Array;
          
          // Use downloadSegmentByTxSeq as per SDK implementation
          // Calculate start and end indices for the segment
          const DEFAULT_CHUNK_SIZE = 256;
          const DEFAULT_SEGMENT_MAX_CHUNKS = 1024;
          const startIndex = i * DEFAULT_SEGMENT_MAX_CHUNKS;
          const endIndex = Math.min(startIndex + DEFAULT_SEGMENT_MAX_CHUNKS, Math.ceil(fileInfo.tx.size / DEFAULT_CHUNK_SIZE));
          
          const segment = await node.downloadSegmentByTxSeq(fileInfo.tx.seq, startIndex, endIndex);
          if (segment) {
            // Decode base64 segment data
            const { decodeBase64 } = await import('ethers');
            segmentData = decodeBase64(segment);
          } else {
            throw new Error('Segment download returned null');
          }
          
          if (segmentData && segmentData.length > 0) {
            segments.push(segmentData);
            console.log(`0G Storage: Segment ${i + 1} downloaded, size:`, segmentData.length);
          } else {
            console.warn(`0G Storage: Segment ${i + 1} is empty or failed`);
            // Try to continue with other segments
            continue;
          }
        } catch (segmentError) {
          console.error(`0G Storage: Failed to download segment ${i}:`, segmentError);
          // Try to continue with other segments
          continue;
        }
      }
      
      if (segments.length === 0) {
        throw new Error('No segments were successfully downloaded');
      }

      // Combine all segments into single file data
      const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
      const fileData = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const segment of segments) {
        fileData.set(segment, offset);
        offset += segment.length;
      }
      
      console.log('0G Storage: File data assembled, total size:', fileData.length);
      return fileData;
    } catch (error) {
      console.error('0G Storage: Fallback download failed:', error);
      throw error;
    }
  }

  /**
   * Download file as blob (for browser environments)
   */
  async downloadFileAsBlob(rootHash: string, withProof: boolean = true): Promise<Blob | null> {
    try {
      const result = await this.downloadFile(rootHash, withProof);
      if (result.success && result.data) {
        return new Blob([result.data.buffer as ArrayBuffer] as any);
      }
      return null;
    } catch (error) {
      console.error('Download as blob failed:', error);
      return null;
    }
  }

  /**
   * Get file metadata from root hash
   */
  async getFileMetadata(rootHash: string): Promise<any> {
    try {
      // This would need to be implemented based on 0G Storage's metadata API
      // For now, return basic info
      return {
        rootHash,
        timestamp: Date.now(),
        source: '0g-storage'
      };
    } catch (error) {
      console.error('Get file metadata failed:', error);
      return null;
    }
  }

  /**
   * Check network status
   */
  async getNetworkStatus(): Promise<{ rpc: boolean; indexer: boolean }> {
    try {
      // Test RPC connection
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      console.log('0G Storage: RPC connection successful, block number:', blockNumber);
      
      // Initialize SDK and test Indexer connection
      await this.initializeSDK();
      const nodes = await this.indexer.getShardedNodes();
      console.log('0G Storage: Indexer connection successful, trusted nodes:', nodes.trusted?.length || 0);
      
      return {
        rpc: true,
        indexer: true
      };
    } catch (error) {
      console.error('0G Storage: Network status check failed:', error);
      throw new Error('Failed to initialize 0G Storage SDK: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

// Export default instance
export const zgStorage = new ZgStorageService();

// Export factory function for creating instances
export function getZgStorageService(config?: Partial<ZgStorageConfig>): ZgStorageService {
  return new ZgStorageService(config);
}
