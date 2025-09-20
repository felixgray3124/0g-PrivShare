export const MAX_UINT256 = 2n ** 256n - 1n;

// 0G Storage configuration based on SDK constants
export const ZG_STORAGE_CONFIG = {
  // 0G SDK constants:
  // DEFAULT_CHUNK_SIZE = 256 bytes
  // DEFAULT_SEGMENT_MAX_CHUNKS = 1024
  // DEFAULT_SEGMENT_SIZE = 256 * 1024 = 256KB
  // SMALL_FILE_SIZE_THRESHOLD = 256 * 1024 = 256KB
  maxFileSize: 256 * 1024 * 1024, // 256MB (0G can handle much larger files)
  enableProofVerification: true,
  // 0G SDK segment size for chunking
  segmentSize: 256 * 1024, // 256KB
  chunkSize: 256, // 256 bytes
  maxChunksPerSegment: 1024,
} as const;
