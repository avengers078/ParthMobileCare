import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ShopConfig } from '../types';
import { DEFAULT_SHOP_CONFIG } from '../constants';
import { StorageService } from '../services/storageService';
import FirebaseService from '../services/firebase';

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
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const applyValidatedConfig = async (raw: any): Promise<ShopConfig | null> => {
    if (!raw) return null;
    const lat = Number(raw.latitude);
    const lng = Number(raw.longitude);
    const radius = Number(raw.allowedRadiusMeters);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.warn('[ShopConfigContext] Rejected invalid coordinates in shop config:', raw);
      return null;
    }

    // Purge obsolete Surat mock coordinates if encountered
    if (Math.abs(lat - 21.1702) < 0.0001 && Math.abs(lng - 72.8311) < 0.0001) {
      console.info('[ShopConfigContext] Replacing old Surat coordinates with actual store configuration.');
      return DEFAULT_SHOP_CONFIG;
    }

    const validated: ShopConfig = {
      shopName: String(raw.shopName || DEFAULT_SHOP_CONFIG.shopName),
      tagline: String(raw.tagline || ''),
      shopAddress: String(raw.shopAddress || DEFAULT_SHOP_CONFIG.shopAddress),
      phone: String(raw.phone || DEFAULT_SHOP_CONFIG.phone),
      alternatePhone: String(raw.alternatePhone || ''),
      email: String(raw.email || DEFAULT_SHOP_CONFIG.email),
      gstNumber: String(raw.gstNumber || ''),
      latitude: lat,
      longitude: lng,
      allowedRadiusMeters: isNaN(radius) || radius <= 0 ? 30 : radius,
      openingTime: String(raw.openingTime || '10:00'),
      closingTime: String(raw.closingTime || '21:00'),
    };

    setConfig(validated);
    await StorageService.saveShopConfig(validated);
    return validated;
  };

  const reloadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Load from AsyncStorage first
      const saved = await StorageService.getShopConfig();
      if (saved && !isNaN(saved.latitude) && !isNaN(saved.longitude)) {
        setConfig(saved);
      }

      // 2. Fetch fresh document from Cloud Firestore if authenticated
      const db = FirebaseService.getFirestore();
      if (db) {
        try {
          const { doc, getDoc } = require('firebase/firestore');
          const snapStore = await getDoc(doc(db, 'shop_config', 'main_store'));
          if (snapStore && snapStore.exists()) {
            await applyValidatedConfig(snapStore.data());
            return;
          }
          const snapMain = await getDoc(doc(db, 'shop_config', 'main'));
          if (snapMain && snapMain.exists()) {
            await applyValidatedConfig(snapMain.data());
            return;
          }
        } catch (fetchErr) {
          // Unauthenticated or offline; retained cached config
        }
      }
    } catch (error) {
      console.warn('[ShopConfigContext] Error reloading shop config:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up initial load and live real-time Firestore listener
  useEffect(() => {
    let isMounted = true;

    reloadConfig();

    const attachListener = () => {
      const db = FirebaseService.getFirestore();
      if (!db) return;

      try {
        const { doc, onSnapshot } = require('firebase/firestore');
        const targetRef = doc(db, 'shop_config', 'main_store');

        const unsub = onSnapshot(
          targetRef,
          (docSnap: any) => {
            if (isMounted && docSnap && docSnap.exists()) {
              console.info('[ShopConfigContext] Live Firestore shop_config update received.');
              applyValidatedConfig(docSnap.data());
            }
          },
          (err: any) => {
            // Permission or offline: non-fatal, logs quietly
            console.log('[ShopConfigContext] Live subscription waiting/offline:', err?.message || err);
          }
        );

        unsubscribeRef.current = unsub;
      } catch (e) {
        console.warn('[ShopConfigContext] Failed to attach onSnapshot listener:', e);
      }
    };

    attachListener();

    return () => {
      isMounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [reloadConfig]);

  const updateConfig = useCallback(async (newConfig: ShopConfig) => {
    setConfig(newConfig);
    await StorageService.saveShopConfig(newConfig);
  }, []);

  const value = useMemo(
    () => ({ config, updateConfig, reloadConfig, isLoading }),
    [config, updateConfig, reloadConfig, isLoading]
  );

  return (
    <ShopConfigContext.Provider value={value}>
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
