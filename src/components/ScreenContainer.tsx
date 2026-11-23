import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  BackHandler,
  useWindowDimensions,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export interface FormScrollContextType {
  scrollToInput: (targetNode: any) => void;
  scrollViewRef?: React.RefObject<any>;
}

export const FormScrollContext = createContext<FormScrollContextType | null>(null);

export const useFormScroll = () => useContext(FormScrollContext);

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  keyboardAvoiding?: boolean;
  dismissKeyboardOnTap?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
  edges = ['top', 'left', 'right'],
  keyboardAvoiding = true,
  dismissKeyboardOnTap = true,
}) => {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const scrollViewRef = useRef<any>(null);
  const scrollYRef = useRef<number>(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Global Keyboard listener & Android hardware Back button integration
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e?.endCoordinates ? e.endCoordinates.height : 260);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (keyboardVisible) {
        Keyboard.dismiss();
        return true; // Dismiss soft keyboard first without exiting screen
      }
      return false;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      backSub.remove();
    };
  }, [keyboardVisible]);

  // Programmatic scroll targeting for child inputs with window-accurate delta math
  const scrollToInput = (targetNode: any) => {
    if (!targetNode || !scrollViewRef.current) return;

    setTimeout(() => {
      try {
        const currentScrollY = scrollYRef.current || 0;
        const currentKeyboardH = keyboardHeight || 260;

        if (typeof targetNode.measureInWindow === 'function') {
          targetNode.measureInWindow((_x: number, inputY: number, _w: number, inputH: number) => {
            if (inputY !== undefined && inputH !== undefined && !isNaN(inputY) && !isNaN(inputH)) {
              const keyboardTopY = windowHeight - currentKeyboardH;
              const maxVisibleY = keyboardVisible ? keyboardTopY - 32 : windowHeight - 48;
              const minVisibleY = 80;

              const inputBottom = inputY + inputH;
              if (inputBottom > maxVisibleY) {
                const delta = inputBottom - maxVisibleY;
                scrollViewRef.current?.scrollTo({
                  y: currentScrollY + delta,
                  animated: true,
                });
              } else if (inputY < minVisibleY) {
                const delta = minVisibleY - inputY;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, currentScrollY - delta),
                  animated: true,
                });
              }
              return;
            }

            fallbackScroll();
          });
          return;
        }

        fallbackScroll();

        function fallbackScroll() {
          const scrollResponder =
            scrollViewRef.current?.getScrollResponder?.() || scrollViewRef.current;
          if (typeof targetNode?.measureLayout === 'function') {
            targetNode.measureLayout(
              scrollResponder,
              (_x: number, top: number, _w: number, height: number) => {
                if (top !== undefined && !isNaN(top)) {
                  const targetY = Math.max(0, top - 60);
                  scrollViewRef.current?.scrollTo({
                    y: targetY,
                    animated: true,
                  });
                }
              },
              () => {}
            );
          }
        }
      } catch (_) {}
    }, Platform.OS === 'android' ? 100 : 50);
  };

  const dynamicPaddingBottom = keyboardVisible
    ? Math.max(keyboardHeight, 260) + 40
    : 24;

  const content = scrollable ? (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.scrollView, style]}
      contentContainerStyle={[
        styles.scrollContent,
        contentContainerStyle,
        { paddingBottom: dynamicPaddingBottom },
      ]}
      onScroll={(e) => {
        scrollYRef.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      nestedScrollEnabled={true}
      overScrollMode="always"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      <View style={styles.innerTouchable}>
        {children}
      </View>
    </ScrollView>
  ) : (
    <View style={[styles.staticContent, style]}>{children}</View>
  );

  return (
    <FormScrollContext.Provider value={{ scrollToInput, scrollViewRef }}>
      <SafeAreaView
        edges={edges}
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </SafeAreaView>
    </FormScrollContext.Provider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  innerTouchable: {
    flexGrow: 1,
    width: '100%',
  },
  staticContent: {
    flex: 1,
  },
});
