import React, { createContext, useContext, useState, useEffect } from 'react';
import { ShopConfig } from '../types';
import { DEFAULT_SHOP_CONFIG } from '../constants';
import { StorageService } from '../services/storageService';

interface ShopConfigContextType {
  config: ShopConfig;
  updateConfig: (newConfig: ShopConfig) => Promise<void>;
  reloadConfig: () => Promise<void>;
  isLoading: boolean;
}

const ShopConfigContext = createContext<ShopConfigContextType | undefined>(undefined);

export const ShopConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ShopConfig>(DEFAULT_SHOP_CONFIG);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const reloadConfig = async () => {
    setIsLoading(true);
    try {
      const saved = await StorageService.getShopConfig();
      setConfig(saved);
    } catch (error) {
      console.warn('Shop configuration unavailable; using default configuration.', error);
      setConfig(DEFAULT_SHOP_CONFIG);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadConfig();
  }, []);

  const updateConfig = async (newConfig: ShopConfig) => {
    setConfig(newConfig);
    await StorageService.saveShopConfig(newConfig);
  };

  return (
    <ShopConfigContext.Provider value={{ config, updateConfig, reloadConfig, isLoading }}>
      {children}
    </ShopConfigContext.Provider>
  );
};

export const useShopConfig = () => {
  const context = useContext(ShopConfigContext);
  if (!context) {
    throw new Error('useShopConfig must be used within a ShopConfigProvider');
  }
  return context;
};
