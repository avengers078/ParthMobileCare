import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ShopConfigProvider } from './src/context/ShopConfigContext';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import FirebaseService from './src/services/firebase';

function MainApp() {
  const { isDark } = useTheme();

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
