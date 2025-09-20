"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { ZgStorageService, getZgStorageService } from "../lib/0g-storage.js";
import { config } from "../config";

export const ZgStorageContext = createContext<{
  zgStorage: ZgStorageService | null;
  isConnected: boolean;
  error?: string;
}>({ 
  zgStorage: null, 
  isConnected: false 
});

export const ZgStorageProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [zgStorage, setZgStorage] = useState<ZgStorageService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const initializeZgStorage = async () => {
    try {
      setError(undefined);
      
      // Create ZG Storage service without private key
      const zgStorageService = getZgStorageService({
        rpcUrl: config.zgStorage.rpcUrl,
        indexerRpc: config.zgStorage.indexerRpc,
      });

      setZgStorage(zgStorageService);

      // Check network connection
      const networkStatus = await zgStorageService.getNetworkStatus();
      if (networkStatus.rpc && networkStatus.indexer) {
        setIsConnected(true);
        console.log('0G Storage connected successfully');
      } else {
        setIsConnected(false);
        setError('Failed to connect to 0G Storage');
        console.error('0G Storage connection failed');
      }
    } catch (error) {
      console.error('Failed to initialize 0G Storage:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsConnected(false);
    }
  };
  
  useEffect(() => {
    initializeZgStorage();
  }, []);

  return (
    <ZgStorageContext.Provider value={{ zgStorage, isConnected, error }}>
      {children}
    </ZgStorageContext.Provider>
  );
};

export const useZgStorage = () => {
  const { zgStorage, isConnected, error } = useContext(ZgStorageContext);
  return { zgStorage, isConnected, error };
};
