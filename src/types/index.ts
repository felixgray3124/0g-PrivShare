export interface FileMetadata {
  // Basic file info
  id?: string
  shareCode: string
  fileName: string
  fileSize: number
  mimeType: string
  isEncrypted: boolean
  encryptionKey?: string
  iv?: string
  uploader: string
  uploadTime: number
  
  // Storage provider info
  pieceCid?: string // For backward compatibility
  rootHash?: string // 0G Storage root hash
  txHash?: string // Transaction hash
  provider?: string // Storage provider name
  
  // Legacy fields for backward compatibility
  cid?: string
  name?: string
  size?: number
  encryptedData?: string
  providerInfo?: any
}

export interface WalletInfo {
  address: string
  chainId: number
  balance?: string
}

export interface UploadProgress {
  stage: 'encrypting' | 'uploading' | 'generating' | 'complete'
  progress: number
  message: string
}

export interface ShareCodeInfo {
  shareCode: string
  fileName: string
  fileSize: number
  uploadTime: number
  expiresAt?: number
}

export interface DownloadInfo {
  shareCode: string
  fileName: string
  fileSize: number
  mimeType: string
  requiresKey: boolean
}

export type TabType = 'upload' | 'download'

export interface AppState {
  wallet: WalletInfo | null
  activeTab: TabType
  uploadedFile: ShareCodeInfo | null
  isUploading: boolean
  isDownloading: boolean
  error: string | null
}

/**
 * Interface representing the Pandora balance data returned from the SDK
 */
export interface WarmStorageBalance {
  rateAllowanceNeeded: bigint;
  lockupAllowanceNeeded: bigint;
  currentRateAllowance: bigint;
  currentLockupAllowance: bigint;
  currentRateUsed: bigint;
  currentLockupUsed: bigint;
  sufficient: boolean;
  message?: string;
  costs: {
    perEpoch: bigint;
    perDay: bigint;
    perMonth: bigint;
  };
  depositAmountNeeded: bigint;
}

export interface StorageCosts {
  pricePerTiBPerMonthNoCDN: bigint;
  pricePerTiBPerMonthWithCDN: bigint;
}
