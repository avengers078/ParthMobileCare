import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ViewStyle,
  StyleProp,
  Keyboard,
  useWindowDimensions,
  LayoutAnimation,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '../theme';
import { ModalScrollContext, ModalScrollContextType } from './ModalCard';
import { FormScrollContext, FormScrollContextType } from './ScreenContainer';

export interface KeyboardAwareFormContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  cardTitle?: string;
  cardSubtitle?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  scrollStyle?: StyleProp<ViewStyle>;
  cardMode?: boolean;
  maxHeight?: string | number;
  scrollEnabled?: boolean;
  keyboardExtraOffset?: number;
  autoScrollOnFocus?: boolean;
  onKeyboardChange?: (visible: boolean, height: number) => void;
}

/**
 * Global Keyboard-Aware Form Container
 * Matches the reference Add Customer Lead modal interaction across full-page forms and cards:
 * - Card remains visually stable at its anchored top position when keyboard opens
 * - Card does NOT jump around or get pushed off-screen
 * - Card height is dynamically constrained so its bottom stops right above the keyboard
 * - Inner content becomes vertically scrollable with smooth auto-scroll to focused inputs
 * - Full accessibility to every input and submit/action button even with keyboard visible
 * - Android hardware back button dismisses keyboard first without jumping or exiting
 */
export const KeyboardAwareFormContainer: React.FC<KeyboardAwareFormContainerProps> = ({
  children,
  header,
  footer,
  cardTitle,
  cardSubtitle,
  style,
  contentStyle,
  bodyStyle,
  scrollStyle,
  cardMode = true,
  maxHeight = '88%',
  scrollEnabled = true,
  keyboardExtraOffset = 28,
  autoScrollOnFocus = false,
  onKeyboardChange,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const { height: windowHeight } = useWindowDimensions();

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef<number>(0);

  const cardRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
  const headerLayoutRef = useRef<{ height: number }>({ height: 0 });
  const footerLayoutRef = useRef<{ height: number }>({ height: 0 });
  const scrollYRef = useRef<number>(0);
  const scrollViewLayoutRef = useRef<{ height: number }>({ height: 0 });
  const lastFocusedNodeRef = useRef<any>(null);

  const [cardMetrics, setCardMetrics] = useState<{ y: number; height: number }>({ y: 0, height: 0 });
  const cardMetricsRef = useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  const [headerHeight, setHeaderHeight] = useState(0);

  const measureCard = () => {
    if (cardRef.current?.measureInWindow) {
      try {
        cardRef.current.measureInWindow((_x: number, y: number, _w: number, height: number) => {
          if (y !== undefined && height !== undefined && !isNaN(y) && !isNaN(height) && height > 0) {
            cardMetricsRef.current = { y, height };
            setCardMetrics({ y, height });
          }
        });
      } catch (_) {}
    }
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kh = e.endCoordinates ? e.endCoordinates.height : 260;
      keyboardHeightRef.current = kh;
      setKeyboardHeight(kh);
      onKeyboardChange?.(true, kh);
      measureCard();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      onKeyboardChange?.(false, 0);
      measureCard();
    });

    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (keyboardHeightRef.current > 0) {
        Keyboard.dismiss();
        return true; // Dismiss keyboard first, keep screen state intact
      }
      return false;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      backSub.remove();
    };
  }, []);

  const isKeyboardActive = keyboardHeight > 0;

  const parsedMaxHeight =
    typeof maxHeight === 'string' && maxHeight.endsWith('%')
      ? (windowHeight * parseFloat(maxHeight)) / 100
      : typeof maxHeight === 'number'
      ? maxHeight
      : windowHeight * 0.88;

  // Stable positioning: card top position remains fixed.
  // Card height adapts so its bottom stops safely above the keyboard without shifting the outer screen.
  const cardTopY = cardMetricsRef.current.y > 0
    ? cardMetricsRef.current.y
    : insets.top + (header ? headerHeight : 0) + SPACING.xs;
  const safeBottom = insets.bottom > 0 ? insets.bottom : 16;
  const availableHeightAboveKeyboard = windowHeight - keyboardHeight - cardTopY - safeBottom;
  const availableHeightWithoutKeyboard = windowHeight - cardTopY - safeBottom - SPACING.sm;

  const effectiveMaxHeight = isKeyboardActive
    ? Math.max(160, Math.min(parsedMaxHeight, availableHeightAboveKeyboard))
    : Math.min(parsedMaxHeight, availableHeightWithoutKeyboard);

  // Manual scrolling by default: do not auto-scroll unless explicitly enabled
  const scrollToInput = (targetNode: any) => {
    if (!autoScrollOnFocus || !targetNode || !scrollViewRef.current) return;
    lastFocusedNodeRef.current = targetNode;

    setTimeout(() => {
      try {
        if (!targetNode || !scrollViewRef.current) return;

        const currentScrollY = scrollYRef.current || 0;
        const currentKeyboardH = keyboardHeightRef.current || keyboardHeight;

        if (typeof targetNode.measureInWindow === 'function') {
          targetNode.measureInWindow((_x: number, inputY: number, _w: number, inputH: number) => {
            if (inputY !== undefined && inputH !== undefined && !isNaN(inputY) && !isNaN(inputH)) {
              const cardY = cardMetricsRef.current.y || cardTopY;
              const headerH = headerLayoutRef.current.height || 0;
              const minVisibleY = cardY + headerH + 4;
              const keyboardTopY = windowHeight - currentKeyboardH;
              const maxVisibleY = currentKeyboardH > 0
                ? keyboardTopY - keyboardExtraOffset
                : windowHeight - 48;

              const inputTop = inputY;
              const inputBottom = inputY + inputH;

              if (inputTop >= minVisibleY && inputBottom <= maxVisibleY) {
                return;
              }

              if (inputBottom > maxVisibleY) {
                const delta = inputBottom - maxVisibleY + 14;
                scrollViewRef.current?.scrollTo({
                  y: currentScrollY + delta,
                  animated: true,
                });
                return;
              }

              if (inputTop < minVisibleY) {
                const delta = minVisibleY - inputTop + 8;
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
              (_left: number, top: number, _width: number, height: number) => {
                const visibleH = scrollViewLayoutRef.current.height || 300;
                const itemBottom = top + (height || 48);
                if (itemBottom > currentScrollY + visibleH - 24) {
                  const targetY = itemBottom - visibleH + 40;
                  scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
                } else if (top < currentScrollY + 12) {
                  scrollViewRef.current?.scrollTo({ y: Math.max(0, top - 16), animated: true });
                }
              },
              () => {}
            );
          }
        }
      } catch (_) {}
    }, Platform.OS === 'android' ? 100 : 50);
  };

  const scrollContextValue: FormScrollContextType = {
    scrollToInput,
    scrollViewRef,
  };

  const modalScrollContextValue: ModalScrollContextType = {
    scrollToInput,
    scrollViewRef,
  };

  return (
    <FormScrollContext.Provider value={scrollContextValue}>
      <ModalScrollContext.Provider value={modalScrollContextValue}>
        <View style={[styles.outerWrapper, style]}>
          {header && (
            <View
              style={styles.externalHeader}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0 && Math.abs(h - headerHeight) > 1) {
                  setHeaderHeight(h);
                }
              }}
            >
              {header}
            </View>
          )}

          <View
            ref={cardRef}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              if (y > 0 || height > 0) {
                cardMetricsRef.current = { y, height };
                setCardMetrics({ y, height });
              }
            }}
            style={[
              cardMode ? styles.card : styles.container,
              cardMode && {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              cardMode && SHADOWS.card,
              {
                maxHeight: effectiveMaxHeight,
              },
              contentStyle,
            ]}
          >
            {/* Optional Card Internal Header */}
            {(cardTitle || cardSubtitle) && (
              <View
                style={[styles.cardHeader, { borderBottomColor: colors.border }]}
                onLayout={(e) => {
                  headerLayoutRef.current = { height: e.nativeEvent.layout.height };
                }}
              >
                {cardTitle && (
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{cardTitle}</Text>
                )}
                {cardSubtitle && (
                  <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                    {cardSubtitle}
                  </Text>
                )}
              </View>
            )}

            {/* Inner Vertically Scrollable Content */}
            <ScrollView
              ref={scrollViewRef}
              style={[styles.scrollView, scrollStyle]}
              contentContainerStyle={[
                styles.scrollBody,
                bodyStyle,
                {
                  paddingBottom: isKeyboardActive
                    ? SPACING.xxl + 80
                    : Math.max(insets.bottom, 16) + SPACING.lg,
                },
              ]}
              onScroll={(e) => {
                scrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              onLayout={(e) => {
                scrollViewLayoutRef.current = { height: e.nativeEvent.layout.height };
              }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              nestedScrollEnabled={true}
              scrollEnabled={scrollEnabled}
              bounces={false}
              overScrollMode="never"
            >
              {children}
            </ScrollView>

            {/* Optional Card Internal Footer */}
            {footer && (
              <View
                style={[styles.cardFooter, { borderTopColor: colors.border }]}
                onLayout={(e) => {
                  footerLayoutRef.current = { height: e.nativeEvent.layout.height };
                }}
              >
                {footer}
              </View>
            )}
          </View>
        </View>
      </ModalScrollContext.Provider>
    </FormScrollContext.Provider>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  externalHeader: {
    width: '100%',
    marginBottom: SPACING.sm,
  },
  card: {
    width: '100%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
  },
  cardSubtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  scrollView: {
    flexGrow: 0,
    width: '100%',
  },
  scrollBody: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xl,
    flexGrow: 1,
  },
  cardFooter: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
  },
});
