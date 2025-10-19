import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileMetadata } from "../lib/fileMetadata";
import { validateShareCode, getMappingFrom0G } from "../lib/ipfs-mapping";

export type FilePreviewInfo = {
  metadata: FileMetadata | null;
  isValid: boolean;
  error?: string;
};

/**
 * Hook to preview file information from share code
 */
export const useFilePreview = () => {
  const [previewInfo, setPreviewInfo] = useState<FilePreviewInfo | null>(null);

  const mutation = useMutation({
    mutationKey: ["file-preview"],
    mutationFn: async (shareCode: string) => {
      // Validate share code format
      if (!validateShareCode(shareCode)) {
        throw new Error("Invalid share code format");
      }

      // Resolve mapping from share code
      const mapping = await getMappingFrom0G(shareCode);

      // Build metadata using mapping
      const metadata: FileMetadata = {
        id: shareCode,
        shareCode,
        fileName: mapping.fileName || 'unknown',
        fileSize: mapping.fileSize || 0,
        mimeType: mapping.mimeType || 'application/octet-stream',
        isEncrypted: !!mapping.iv,
        encryptionKey: undefined,
        iv: mapping.iv,
        uploader: mapping.uploader || 'unknown',
        uploadTime: mapping.uploadTime || Date.now(),
        pieceCid: mapping.rootHash,
        rootHash: mapping.rootHash,
        provider: '0g-storage'
      };

      return {
        metadata,
        isValid: true,
      };
    },
    onSuccess: (data) => {
      setPreviewInfo(data);
    },
    onError: (error) => {
      setPreviewInfo({
        metadata: null,
        isValid: false,
        error: error.message,
      });
    },
  });

  const previewFile = (shareCode: string) => {
    mutation.mutate(shareCode);
  };

  const clearPreview = () => {
    setPreviewInfo(null);
  };

  return {
    previewFileMutation: mutation,
    previewInfo,
    previewFile,
    clearPreview,
  };
};
