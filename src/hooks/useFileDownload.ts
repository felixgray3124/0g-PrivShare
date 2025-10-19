import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { decryptFileFromBlob } from "../lib/encryption";
import { validateShareCode, getMappingFrom0G } from "../lib/ipfs-mapping";
import { useZgStorage } from "../providers/ZgStorageProvider";
import { config } from "../config";

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

      setStatus("🔍 Resolving file location on 0G Storage...");
      setProgress(20);

      // Resolve mapping from 0G using share code
      const mapping = await getMappingFrom0G(shareCode);
      const rootHash = mapping.rootHash;
      const shareIv = mapping.iv;
      
      // Build metadata from mapping
      const fileMetadata: FileMetadata = {
        id: shareCode,
        shareCode,
        pieceCid: rootHash,
        fileName: mapping.fileName || 'unknown',
        fileSize: mapping.fileSize || 0,
        mimeType: mapping.mimeType || 'application/octet-stream',
        isEncrypted: !!shareIv,
        encryptionKey: encryptionKey,
        iv: shareIv,
        uploader: mapping.uploader || 'unknown',
        uploadTime: mapping.uploadTime || Date.now(),
        provider: '0g-storage',
        rootHash: rootHash
      };

      setStatus("📋 File metadata resolved");
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