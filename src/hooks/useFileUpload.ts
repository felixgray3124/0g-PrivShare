import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useZgStorage } from "../providers/ZgStorageProvider";
import { useEthersSigner } from "./useEthers";
import { encryptFile, generateKey } from "../lib/encryption";
import { generateRandomShareCode, storeMappingToIPFS } from "../lib/ipfs-mapping";
import { config } from "../config";

export type UploadedInfo = {
  fileName?: string;
  fileSize?: number;
  rootHash?: string;
  txHash?: string;
  shareCode?: string;
  encryptionKey?: string;
  isEncrypted?: boolean;
};

export type UploadOptions = {
  file: File;
  isEncrypted: boolean;
  customKey?: string;
};

/**
 * Hook to upload a file to the 0G Storage network.
 */
export const useFileUpload = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [uploadedInfo, setUploadedInfo] = useState<UploadedInfo | null>(null);
  const [lastAddress, setLastAddress] = useState<string | undefined>(undefined);
  const { zgStorage, isConnected, error: zgError } = useZgStorage();
  const { address } = useAccount();
  const signer = useEthersSigner();

  const mutation = useMutation({
    mutationKey: ["file-upload", address],
    mutationFn: async ({ file, isEncrypted, customKey }: UploadOptions) => {
      if (!zgStorage) {
        throw new Error("0G Storage not available. Please check your wallet connection and try again.");
      }
      if (!address) {
        throw new Error("Wallet not connected. Please connect your wallet to upload files.");
      }
      if (!isConnected) {
        throw new Error(`0G Storage connection failed: ${zgError || 'Unknown error'}`);
      }
      
      // Check file size
      if (file.size > config.maxFileSize) {
        throw new Error(`File too large. Maximum size is ${Math.round(config.maxFileSize / 1024 / 1024)}MB`);
      }
      
      setProgress(0);
      setUploadedInfo(null);
      
      let fileData: Uint8Array;
      let encryptionKey: string | undefined;
      let iv: string | undefined;
      
      if (isEncrypted) {
        setStatus("🔐 Encrypting file...");
        // Use custom key or generate new one
        if (customKey) {
          // Store the original custom key for display
          encryptionKey = customKey;
          if (import.meta.env.MODE === 'development') {
            console.log('Using passed key:', { customKey, encryptionKey });
          }
          // Convert to hex format for encryption
          const hexKey = Array.from(customKey, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
          if (import.meta.env.MODE === 'development') {
            console.log('Converted to hex key:', hexKey);
          }
          const encryptedResult = await encryptFile(file, hexKey);
          iv = encryptedResult.iv;
          fileData = Uint8Array.from(atob(encryptedResult.encryptedData), c => c.charCodeAt(0));
        } else {
          // This should not happen as frontend generates key first
          encryptionKey = generateKey();
          if (import.meta.env.MODE === 'development') {
            console.log('Warning: No key passed, generating random key:', encryptionKey);
          }
          const encryptedResult = await encryptFile(file, encryptionKey);
          iv = encryptedResult.iv;
          fileData = Uint8Array.from(atob(encryptedResult.encryptedData), c => c.charCodeAt(0));
        }
      } else {
        setStatus("📁 Preparing file for upload...");
        // Use original file data
        const arrayBuffer = await file.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      }
      
      setStatus("🔄 Initializing file upload to 0G Storage...");
      setProgress(10);

      // Check network status
      setStatus("🔍 Checking 0G Storage network status...");
      setProgress(20);

      const networkStatus = await zgStorage.getNetworkStatus();
      if (!networkStatus.rpc || !networkStatus.indexer) {
        throw new Error(`0G Storage network error: RPC=${networkStatus.rpc}, Indexer=${networkStatus.indexer}`);
      }

      setStatus("📁 Uploading file to 0G Storage...");
      setProgress(30);

      // Create a temporary file for upload
      const tempFile = new File([fileData.buffer as ArrayBuffer], file.name, { type: file.type });
      
      // Upload file to 0G Storage
      if (!signer) {
        throw new Error('Wallet not connected');
      }
      
      setStatus("🔐 Submitting transaction to blockchain...");
      setProgress(40);
      
      const uploadResult = await zgStorage.uploadFile(tempFile, signer);
      
      setStatus("⏳ Waiting for transaction confirmation...");
      setProgress(50);
      
      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error || 'Unknown error'}`);
      }

      setStatus("📊 File uploaded successfully! Generating share code...");
      setProgress(70);

      // Generate random share code
      const shareCode = generateRandomShareCode();
      
      // Store complete metadata to IPFS
      console.log('Storing complete metadata to IPFS:', {
        shareCode,
        rootHash: uploadResult.rootHash,
        isEncrypted,
        encryptionKey,
        iv,
        txHash: uploadResult.txHash
      });
      
      await storeMappingToIPFS(shareCode, uploadResult.rootHash, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        isEncrypted: isEncrypted,
        encryptionKey: encryptionKey,
        iv: iv,
        uploader: address,
        uploadTime: Date.now(),
        txHash: uploadResult.txHash,
        finalityRequired: true,
        expectedReplica: 1
      }, {
        name: '0G Storage',
        type: '0g-storage',
        network: '0G-Galileo-Testnet',
        chainId: 16602
      });
      
      setProgress(90);
      console.log('Setting upload info:', {
        fileName: file.name,
        shareCode,
        encryptionKey,
        isEncrypted
      });
      
      setUploadedInfo({
        fileName: file.name,
        fileSize: file.size,
        rootHash: uploadResult.rootHash,
        txHash: uploadResult.txHash,
        shareCode,
        encryptionKey,
        isEncrypted,
      });
    },
    onSuccess: () => {
      setStatus("🎉 File successfully stored on 0G Storage!");
      setProgress(100);
    },
    onError: (error: any) => {
      console.error("Upload failed:", error);
      
      // Parse error message for better user experience
      const errorMessage = error.message || "Unknown error";
      let userFriendlyMessage = "";
      
      if (errorMessage.includes('File too large')) {
        userFriendlyMessage = `📏 File Too Large\n\nMaximum file size is ${Math.round(config.maxFileSize / 1024 / 1024)}MB. Please select a smaller file.`;
      } else if (errorMessage.includes('0G Storage not available')) {
        userFriendlyMessage = "🔧 0G Storage Not Available\n\nPlease refresh the page and reconnect your wallet.";
      } else if (errorMessage.includes('Wallet not connected')) {
        userFriendlyMessage = "🔗 Wallet Not Connected\n\nPlease connect your wallet to upload files.";
      } else if (errorMessage.includes('0G Storage connection failed')) {
        userFriendlyMessage = "🌐 Network Connection Failed\n\nPlease check your internet connection and try again.";
      } else if (errorMessage.includes('Upload failed')) {
        userFriendlyMessage = `❌ Upload Failed\n\n${errorMessage}\n\nPlease try again or contact support.`;
      } else {
        userFriendlyMessage = `❌ Upload Failed\n\n${errorMessage}\n\nPlease try again or contact support.`;
      }
      
      setStatus(`❌ ${userFriendlyMessage}`);
      setProgress(0);
      // Reset uploaded info to allow retry
      setUploadedInfo(null);
    },
  });

  // Detect wallet changes and reset state
  useEffect(() => {
    if (lastAddress && lastAddress !== address) {
      console.log('Wallet address changed from', lastAddress, 'to', address);
      setStatus("🔄 Wallet changed, resetting upload state...");
      setProgress(0);
      setUploadedInfo(null);
      
      // Reset mutation state to allow fresh start
      mutation.reset();
      
      // Small delay to allow state to settle
      setTimeout(() => {
        setStatus("");
      }, 1000);
    }
    setLastAddress(address);
  }, [address, lastAddress, mutation]);

  const handleReset = () => {
    setProgress(0);
    setUploadedInfo(null);
    setStatus("");
  };

  return {
    uploadFileMutation: mutation,
    progress,
    uploadedInfo,
    setUploadedInfo,
    handleReset,
    status,
  };
};