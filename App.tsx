import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ShopConfigProvider } from './src/context/ShopConfigContext';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import FirebaseService from './src/services/firebase';

function MainApp() {
  const { isDark } = useTheme();

  useEffect(() => {
    // Initialize Firebase client service
    FirebaseService.init();
  }, []);

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
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
