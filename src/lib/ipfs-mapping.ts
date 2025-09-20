// IPFS + Pinata mapping service

// Pinata API configuration
const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud';

// Helper function to convert BigInt to string for JSON serialization
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }
  
  return obj;
}

// Get Pinata authentication headers
function getPinataHeaders(): Record<string, string> {
  const jwt = import.meta.env.VITE_PINATA_JWT;
  const apiKey = import.meta.env.VITE_PINATA_API_KEY;
  const apiSecret = import.meta.env.VITE_PINATA_API_SECRET;
  
  if (jwt) {
    return {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    };
  } else if (apiKey && apiSecret) {
    return {
      'pinata_api_key': apiKey,
      'pinata_secret_api_key': apiSecret,
      'Content-Type': 'application/json'
    };
  } else {
    throw new Error('Pinata configuration missing');
  }
}

/**
 * Store share code and CID mapping to IPFS
 */
export async function storeMappingToIPFS(shareCode: string, rootHash: string, metadata: any, providerInfo?: any) {
  try {
    // Create complete metadata object for 0G Storage
    const completeMetadata = {
      // Basic info
      shareCode,
      rootHash, // 0G Storage uses rootHash instead of pieceCid
      provider: '0g-storage',
      
      // File metadata
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      isEncrypted: metadata.isEncrypted,
      encryptionKey: metadata.encryptionKey,
      iv: metadata.iv,
      
      // Upload info
      uploader: metadata.uploader || 'anonymous',
      uploadTime: metadata.uploadTime || Date.now(),
      
      // 0G Storage specific
      txHash: metadata.txHash,
      finalityRequired: metadata.finalityRequired || true,
      expectedReplica: metadata.expectedReplica || 1,
      
      // System info
      timestamp: Date.now(),
      version: '2.0', // Updated version for 0G Storage
      providerInfo: providerInfo || {
        name: '0G Storage',
        network: '0G-Galileo-Testnet',
        chainId: 16601
      }
    };
    
    // Convert BigInt to string for JSON serialization
    const serializableData = convertBigIntToString(completeMetadata);
    
    // Upload to IPFS
    const headers = getPinataHeaders();
    
    const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pinataContent: serializableData,
        pinataMetadata: {
          name: `privshare-0g-${shareCode.replace('privshare://0g-', '')}`,
          keyvalues: {
            shareCode: shareCode.replace('privshare://0g-', ''),
            rootHash: rootHash,
            provider: '0g-storage'
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Pinata API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Complete metadata stored to IPFS:', result);
    
    return {
      ipfsHash: result.IpfsHash,
      shareCode,
      rootHash
    };
  } catch (error) {
    console.error('Failed to store to IPFS:', error);
    throw error; // Throw error directly, no local storage fallback
  }
}

/**
 * Get mapping data corresponding to share code from IPFS
 */
export async function getMappingFromIPFS(shareCode: string) {
  try {
    const code = extractCodeFromShareCode(shareCode);
    const headers = getPinataHeaders();
    
    console.log('Searching share code:', code);
    
    // Search for files containing this shareCode via Pinata API
    const response = await fetch(`${PINATA_API_URL}/data/pinList?metadata[keyvalues]={"shareCode":{"value":"${code}","op":"eq"}}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Pinata API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Pinata search results:', result);
    
    if (result.rows && result.rows.length > 0) {
      // Found matching mapping, get data from IPFS
      const ipfsHash = result.rows[0].ipfs_pin_hash;
      console.log('Found IPFS Hash:', ipfsHash);
      
      const dataResponse = await fetch(`${PINATA_GATEWAY_URL}/ipfs/${ipfsHash}`);
      
      if (dataResponse.ok) {
        const mappingData = await dataResponse.json();
        console.log('Retrieved complete metadata from IPFS:', mappingData);
        
        // Return data in the expected format for backward compatibility
        return {
          shareCode: mappingData.shareCode,
          pieceCid: mappingData.rootHash, // Map rootHash to pieceCid for compatibility
          metadata: {
            fileName: mappingData.fileName,
            fileSize: mappingData.fileSize,
            mimeType: mappingData.mimeType,
            isEncrypted: mappingData.isEncrypted,
            encryptionKey: mappingData.encryptionKey,
            iv: mappingData.iv,
            uploader: mappingData.uploader,
            uploadTime: mappingData.uploadTime
          },
          providerInfo: mappingData.providerInfo,
          timestamp: mappingData.timestamp,
          // Add 0G Storage specific fields
          rootHash: mappingData.rootHash,
          txHash: mappingData.txHash,
          provider: mappingData.provider
        };
      } else {
        console.error('Unable to get data from IPFS Gateway:', dataResponse.status);
      }
    }
    
    console.warn('No corresponding mapping data found');
    return null;
  } catch (error) {
    console.error('Failed to get from IPFS:', error);
    return null;
  }
}

/**
 * Get CID corresponding to share code from IPFS (backward compatibility)
 */
export async function getCidFromIPFS(shareCode: string) {
  const mappingData = await getMappingFromIPFS(shareCode);
  return mappingData?.pieceCid || null;
}

/**
 * Generate random share code for 0G Storage
 */
export function generateRandomShareCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Generate 16 random characters
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Format as 0g-xxxx-xxxx-xxxx-xxxx
  const formatted = `0g-${result.match(/.{1,4}/g)?.join('-') || result}`;
  const shareCode = `privshare://${formatted}`;
  
  // Debug information
  console.log('Generated share code:', {
    raw: result,
    formatted,
    shareCode
  });
  
  return shareCode;
}

/**
 * Validate share code format for 0G Storage
 */
export function validateShareCode(shareCode: string): boolean {
  // Support 0G Storage format: privshare://0g-xxxx-xxxx-xxxx-xxxx
  const pattern = /^privshare:\/\/0g-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
  const isValid = pattern.test(shareCode);
  
  // Debug information
  console.log('Validating share code:', {
    shareCode,
    isValid,
    length: shareCode.length
  });
  
  return isValid;
}

/**
 * Extract code part from share code for 0G Storage
 */
export function extractCodeFromShareCode(shareCode: string): string {
  // For 0G Storage format: privshare://0g-xxxx-xxxx-xxxx-xxxx
  // Remove both 'privshare://' and '0g-' prefixes
  return shareCode.replace('privshare://0g-', '');
}