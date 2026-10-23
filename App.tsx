import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ShopConfigProvider } from './src/context/ShopConfigContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import FirebaseService from './src/services/firebase';
import { useShopConfig } from './src/context/ShopConfigContext';

function MainApp() {
  const { isDark } = useTheme();
  const { currentUser } = useAuth();
  const { reloadConfig } = useShopConfig();

  useEffect(() => {
    if (currentUser) reloadConfig();
  // Reload once per authenticated account; the context function is recreated per render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    FirebaseService.init().finally(() => {
      if (mounted) setFirebaseInitialized(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!firebaseInitialized) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ShopConfigProvider>
          <AuthProvider>
            <MainApp />
          </AuthProvider>
        </ShopConfigProvider>
      </ThemeProvider>

    </SafeAreaProvider>
  );
}
