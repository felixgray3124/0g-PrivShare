// File metadata model (unified for 0G Storage)
export interface FileMetadata {
  id: string
  shareCode: string
  fileName: string
  fileSize: number
  mimeType: string
  isEncrypted: boolean
  encryptionKey?: string
  iv?: string
  uploader: string
  uploadTime: number
  expiresAt?: number
  providerInfo?: any
  // Storage provider info
  pieceCid?: string // Backward compatibility
  rootHash?: string // 0G Storage root hash
  txHash?: string   // Transaction hash (if available)
  provider?: string // e.g., '0g-storage'
}

// No centralized metadata storage: derive at runtime
class FileMetadataStorage {
  static saveMetadata(_metadata: FileMetadata): void {
    console.warn('No centralized metadata storage; use share code + 0G indexer')
  }
  
  static getMetadata(_shareCode: string): FileMetadata | null {
    console.warn('No metadata database; reconstruct from share code when needed')
    return null
  }
  
  static getAllMetadata(): Record<string, FileMetadata> {
    console.warn('Listing all metadata is unsupported in this architecture')
    return {}
  }
  
  static deleteMetadata(_shareCode: string): void {
    console.warn('Deletion is not applicable; metadata is not centrally stored')
  }
  
  static getMetadataByPieceCid(_pieceCid: string): FileMetadata | null {
    console.warn('Lookup by CID is unsupported; use share code/rootHash instead')
    return null
  }
}

export { FileMetadataStorage }
