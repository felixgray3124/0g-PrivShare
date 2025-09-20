import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { decryptFileFromBlob } from "../lib/encryption";
import { validateShareCode, extractCodeFromShareCode } from "../lib/ipfs-mapping";
import { useZgStorage } from "../providers/ZgStorageProvider";
import { config } from "../config";

// Pinata API configuration
const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud';

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

import { FileMetadata } from "../lib/fileMetadata";

export type DownloadInfo = {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isEncrypted?: boolean;
  encryptionKey?: string;
  iv?: string;
  uploader?: string;
  uploadTime?: number;
};

export type DownloadOptions = {
  shareCode: string;
  encryptionKey?: string;
};

/**
 * Hook to download a file from the 0G Storage network.
 */
export const useFileDownload = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [downloadInfo, setDownloadInfo] = useState<DownloadInfo | null>(null);
  const { zgStorage, isConnected, error: zgError } = useZgStorage();
  
  const mutation = useMutation({
    mutationKey: ["file-download"],
    mutationFn: async ({ shareCode, encryptionKey }: DownloadOptions) => {
      
      setProgress(0);
      setDownloadInfo(null);
      setStatus("🔍 Validating share code...");

      // Validate share code format
      if (!validateShareCode(shareCode)) {
        throw new Error("Invalid share code format");
      }

      setStatus("🔍 Looking up file from 0G Storage...");
      setProgress(20);

      // Get complete metadata from IPFS
      const code = extractCodeFromShareCode(shareCode);
      const headers = getPinataHeaders();
      
      console.log('Searching share code metadata:', code);
      
      // Search for files containing this shareCode via Pinata API
      const metadataResponse = await fetch(`${PINATA_API_URL}/data/pinList?metadata[keyvalues]={"shareCode":{"value":"${code}","op":"eq"}}`, {
        method: 'GET',
        headers
      });
      
      let fileMetadata: FileMetadata;
      
      if (metadataResponse.ok) {
        const metadataResult = await metadataResponse.json();
        console.log('Pinata search results:', metadataResult);
        
        if (metadataResult.rows && metadataResult.rows.length > 0) {
          // Found matching mapping, get data from IPFS
          const ipfsHash = metadataResult.rows[0].ipfs_pin_hash;
          console.log('Found IPFS Hash:', ipfsHash);
          
          const dataResponse = await fetch(`${PINATA_GATEWAY_URL}/ipfs/${ipfsHash}`);
          
          if (dataResponse.ok) {
            const mappingData = await dataResponse.json();
            console.log('Retrieved mapping data from IPFS:', mappingData);
            
            // Extract file metadata from complete IPFS data
            fileMetadata = {
              id: mappingData.shareCode, // Use shareCode as id
              shareCode: mappingData.shareCode,
              fileName: mappingData.fileName || mappingData.metadata?.fileName || 'unknown',
              fileSize: mappingData.fileSize || mappingData.metadata?.fileSize || 0,
              mimeType: mappingData.mimeType || mappingData.metadata?.mimeType || 'application/octet-stream',
              isEncrypted: mappingData.isEncrypted || mappingData.metadata?.isEncrypted || false,
              encryptionKey: mappingData.encryptionKey || mappingData.metadata?.encryptionKey,
              iv: mappingData.iv || mappingData.metadata?.iv,
              uploader: mappingData.uploader || mappingData.metadata?.uploader || 'unknown',
              uploadTime: mappingData.uploadTime || mappingData.metadata?.uploadTime || Date.now(),
              pieceCid: mappingData.rootHash || mappingData.pieceCid, // Use rootHash for 0G Storage
              // Add 0G Storage specific fields
              rootHash: mappingData.rootHash,
              txHash: mappingData.txHash,
              provider: mappingData.provider
            };
          } else {
            throw new Error(`Failed to retrieve metadata from IPFS: ${dataResponse.status}`);
          }
        } else {
          throw new Error("No file found with this share code");
        }
      } else {
        throw new Error(`Failed to search metadata: ${metadataResponse.status} ${metadataResponse.statusText}`);
      }

      setStatus("📋 File metadata retrieved successfully");
      setProgress(30);

      // Set download info for display
      setDownloadInfo({
        fileName: fileMetadata.fileName,
        fileSize: fileMetadata.fileSize,
        mimeType: fileMetadata.mimeType,
        isEncrypted: fileMetadata.isEncrypted,
        encryptionKey: fileMetadata.encryptionKey,
        iv: fileMetadata.iv,
        uploader: fileMetadata.uploader,
        uploadTime: fileMetadata.uploadTime,
      });

      console.log('Checking encryption status:', {
        isEncrypted: fileMetadata.isEncrypted,
        hasEncryptionKey: !!encryptionKey,
        encryptionKey: encryptionKey
      });
      
      if (fileMetadata.isEncrypted && !encryptionKey) {
        throw new Error("This file is encrypted. Please provide the decryption key.");
      }

      setStatus("📥 Downloading file from 0G Storage...");
      setProgress(40);

      console.log('Starting file download from 0G Storage:', fileMetadata.pieceCid);

      // Check if 0G Storage is available
      if (!zgStorage) {
        throw new Error("0G Storage not available. Please check your connection and try again.");
      }

      if (!isConnected) {
        throw new Error(`0G Storage connection failed: ${zgError || 'Unknown error'}`);
      }

      // Download file from 0G Storage using root hash
      const downloadResult = await zgStorage.downloadFile(
        fileMetadata.pieceCid, 
        config.enableProofVerification
      );
      
      if (!downloadResult.success) {
        throw new Error(`Download failed: ${downloadResult.error || 'Unknown error'}`);
      }

      if (!downloadResult.data) {
        throw new Error("No data received from 0G Storage");
      }

      setStatus("📦 File downloaded successfully");
      setProgress(70);

      let finalData = downloadResult.data;

      // Decrypt if necessary
      if (fileMetadata.isEncrypted && encryptionKey) {
        setStatus("🔓 Decrypting file...");
        setProgress(80);
        
        try {
          // Convert the downloaded data to a Blob for decryption
          const blob = new Blob([finalData as BlobPart], { type: fileMetadata.mimeType });
          
          // Use the provided encryption key or the stored one
          const keyToUse = encryptionKey || fileMetadata.encryptionKey;
          if (!keyToUse) {
            throw new Error("No decryption key available");
          }

          // Ensure IV is available
          if (!fileMetadata.iv) {
            throw new Error("No IV available for decryption");
          }

          // Use the key directly - decryptFileFromBlob will handle hex conversion internally
          const decryptedBlob = await decryptFileFromBlob(blob, keyToUse, fileMetadata.iv);
          finalData = new Uint8Array(await decryptedBlob.arrayBuffer());
          
          setStatus("🔓 File decrypted successfully");
        } catch (decryptError) {
          console.error('Decryption failed:', decryptError);
          throw new Error(`Decryption failed: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`);
        }
      }

      setStatus("✅ File ready for download");
      setProgress(100);

      // Create download URL
      const blob = new Blob([finalData as BlobPart], { type: fileMetadata.mimeType });
      const downloadUrl = URL.createObjectURL(blob);
      
      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileMetadata.fileName || 'downloaded-file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      URL.revokeObjectURL(downloadUrl);

      return {
        fileName: fileMetadata.fileName,
        fileSize: fileMetadata.fileSize,
        mimeType: fileMetadata.mimeType,
        data: finalData,
        downloadUrl
      };
    },
    onSuccess: () => {
      setStatus("🎉 File downloaded successfully!");
      setProgress(100);
    },
    onError: (error) => {
      console.error("Download failed:", error);
      
      // Parse error message for better user experience
      const errorMessage = error.message || "Unknown error";
      let userFriendlyMessage = "";
      
      if (errorMessage.includes('Invalid share code format')) {
        userFriendlyMessage = "❌ Invalid Share Code\n\nPlease check the share code format and try again.";
      } else if (errorMessage.includes('No file found')) {
        userFriendlyMessage = "🔍 File Not Found\n\nNo file found with this share code. Please check the code and try again.";
      } else if (errorMessage.includes('encrypted') && errorMessage.includes('decryption key')) {
        userFriendlyMessage = "🔐 Decryption Key Required\n\nThis file is encrypted. Please provide the decryption key.";
      } else if (errorMessage.includes('0G Storage not available')) {
        userFriendlyMessage = "🔧 0G Storage Not Available\n\nPlease check your connection and try again.";
      } else if (errorMessage.includes('Download failed')) {
        userFriendlyMessage = `Download Failed\n\n${errorMessage}\n\nPlease try again or contact support.`;
      } else {
        userFriendlyMessage = `Download Failed\n\n${errorMessage}\n\nPlease try again or contact support.`;
      }
      
      setStatus(`❌ ${userFriendlyMessage}`);
      setProgress(0);
      setDownloadInfo(null);
    },
  });

  const handleReset = () => {
    setProgress(0);
    setDownloadInfo(null);
    setStatus("");
  };

  return {
    downloadFileMutation: mutation,
    progress,
    downloadInfo,
    setDownloadInfo,
    handleReset,
    status,
  };
};