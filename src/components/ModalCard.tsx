import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ViewStyle,
  StyleProp,
  Keyboard,
  useWindowDimensions,
  LayoutAnimation,
  BackHandler,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '../theme';

export interface ModalScrollContextType {
  scrollToInput: (targetNode: any) => void;
  scrollViewRef: React.RefObject<any>;
}

export const ModalScrollContext = createContext<ModalScrollContextType | null>(null);

export interface ModalCardProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  scrollStyle?: StyleProp<ViewStyle>;
  maxHeight?: string | number;
  scrollEnabled?: boolean;
  scrollable?: boolean;
}

const ModalCardContent: React.FC<ModalCardProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  footerStyle,
  contentStyle,
  bodyStyle,
  scrollStyle,
  maxHeight = '85%',
  scrollEnabled = true,
  scrollable = true,
}) => {
  const { colors } = useTheme();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef<number>(0);
  const cardRef = useRef<any>(null);
  const headerLayoutRef = useRef<{ y: number; height: number }>({ y: 0, height: 64 });
  const footerLayoutRef = useRef<{ height: number }>({ height: 72 });
  const scrollViewRef = useRef<any>(null);
  const lastFocusedNodeRef = useRef<any>(null);
  const scrollYRef = useRef<number>(0);
  const viewportHeightRef = useRef<number>(350);
  const [cardMetrics, setCardMetrics] = useState<{ y: number; height: number }>({ y: 0, height: 0 });
  const cardMetricsRef = useRef<{ y: number; height: number }>({ y: 0, height: 0 });
  const initialTopYRef = useRef<number>(0);
  const scrollViewLayoutRef = useRef<{ height: number }>({ height: 0 });

  useEffect(() => {
    if (visible) {
      initialTopYRef.current = 0;
      setKeyboardHeight(0);
      keyboardHeightRef.current = 0;
    }
  }, [visible]);

  const measureCard = () => {
    if (cardRef.current?.measureInWindow) {
      try {
        cardRef.current.measureInWindow((_x: number, y: number, _w: number, height: number) => {
          if (y !== undefined && height !== undefined && !isNaN(y) && !isNaN(height) && height > 0) {
            if (keyboardHeightRef.current === 0 && (initialTopYRef.current === 0 || y < initialTopYRef.current)) {
              initialTopYRef.current = y;
            }
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
      const kh = e.endCoordinates ? e.endCoordinates.height : 0;
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (_) {}
      keyboardHeightRef.current = kh;
      setKeyboardHeight(kh);
      measureCard();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch (_) {}
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      measureCard();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (keyboardHeightRef.current > 0) {
        Keyboard.dismiss();
        return true; // Dismiss keyboard first, preserve modal
      }
      return false;
    });

    return () => {
      backSub.remove();
    };
  }, [visible]);

  const isKeyboardActive = keyboardHeight > 0;
  const parsedMaxHeight =
    typeof maxHeight === 'string' && maxHeight.endsWith('%')
      ? (windowHeight * parseFloat(maxHeight)) / 100
      : typeof maxHeight === 'number'
      ? maxHeight
      : windowHeight * 0.85;

  const defaultCenterTop = Math.max(insets.top + 16, (windowHeight - parsedMaxHeight) / 2);
  const anchoredTopY = initialTopYRef.current > 0
    ? initialTopYRef.current
    : (cardMetrics.y > 0 ? cardMetrics.y : defaultCenterTop);

  // Available vertical space above the keyboard from the card's anchored top position
  const availableHeightAboveKeyboard = Math.max(160, (windowHeight - keyboardHeight) - anchoredTopY - SPACING.md);
  const effectiveMaxHeight = isKeyboardActive
    ? Math.min(parsedMaxHeight, availableHeightAboveKeyboard)
    : parsedMaxHeight;

  const effectiveCardH = cardMetrics.height || cardMetricsRef.current.height || Math.min(effectiveMaxHeight, windowHeight * 0.78);
  const effectiveCardY = isKeyboardActive ? anchoredTopY : (cardMetrics.y || cardMetricsRef.current.y || defaultCenterTop);
  const cardBottom = effectiveCardY + effectiveCardH;
  const keyboardTop = windowHeight - keyboardHeight;
  const keyboardOverlap = isKeyboardActive ? Math.max(0, cardBottom - keyboardTop) : 0;

  // When keyboard height changes, smoothly scroll the focused input into the visible scroll viewport
  useEffect(() => {
    if (keyboardHeight > 0 && lastFocusedNodeRef.current) {
      const timer = setTimeout(() => {
        if (lastFocusedNodeRef.current) {
          scrollToInput(lastFocusedNodeRef.current);
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [keyboardHeight]);

  const scrollToInput = (targetNode: any) => {
    if (!targetNode || !scrollViewRef.current) return;
    lastFocusedNodeRef.current = targetNode;

    setTimeout(() => {
      try {
        if (!targetNode || !scrollViewRef.current) return;

        const currentScrollY = scrollYRef.current || 0;
        const currentKeyboardH = keyboardHeightRef.current || keyboardHeight;
        const footerH = footer ? (footerLayoutRef.current.height || 72) : 0;

        // Try measuring using window coordinates for absolute precision
        if (typeof targetNode.measureInWindow === 'function') {
          targetNode.measureInWindow((_x: number, inputY: number, _w: number, inputH: number) => {
            if (inputY !== undefined && inputH !== undefined && !isNaN(inputY) && !isNaN(inputH)) {
              const cardY = cardMetricsRef.current.y || Math.max(insets.top + 16, (windowHeight - parsedMaxHeight) / 2);
              const headerH = headerLayoutRef.current.height || 64;
              const minVisibleY = cardY + headerH + 8;
              const keyboardTopY = windowHeight - currentKeyboardH;
              // Provide comfortable clearance above keyboard so focused input and error message are visible
              const maxVisibleY = currentKeyboardH > 0 ? keyboardTopY - 28 : windowHeight - 48;

              const inputTop = inputY;
              const inputBottom = inputY + inputH;

              // If already comfortably visible between header and keyboard, don't scroll
              if (inputTop >= minVisibleY && inputBottom <= maxVisibleY) {
                return;
              }

              // If input bottom is below visible area (covered by or too close to keyboard)
              if (inputBottom > maxVisibleY) {
                const delta = inputBottom - maxVisibleY;
                scrollViewRef.current?.scrollTo({
                  y: currentScrollY + delta,
                  animated: true,
                });
                return;
              }

              // If input top is above minVisibleY (behind or above header)
              if (inputTop < minVisibleY) {
                const delta = minVisibleY - inputTop;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, currentScrollY - delta),
                  animated: true,
                });
              }
              return;
            }

            fallbackMeasureLayout();
          });
          return;
        }

        fallbackMeasureLayout();

        function fallbackMeasureLayout() {
          const scrollResponder =
            scrollViewRef.current?.getScrollResponder?.() || scrollViewRef.current;

          if (typeof targetNode?.measureLayout === 'function') {
            targetNode.measureLayout(
              scrollResponder,
              (_left: number, top: number, _width: number, height: number) => {
                const fullScrollH = scrollViewLayoutRef.current.height || viewportHeightRef.current || 300;
                const visibleViewportH = Math.max(80, fullScrollH - (currentKeyboardH > 0 ? (footer ? 20 : currentKeyboardH * 0.6) : 0));
                const itemHeight = height || 48;
                const itemBottom = top + itemHeight;

                if (itemBottom > currentScrollY + visibleViewportH - 16) {
                  const targetY = itemBottom - visibleViewportH + (footer ? 24 : 70);
                  scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
                  return;
                }

                if (top < currentScrollY + 12) {
                  const targetY = Math.max(0, top - 16);
                  scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
                }
              },
              () => {}
            );
          }
        }
      } catch (e) {
        // Safe fallback
      }
    }, 80);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (isKeyboardActive) {
          Keyboard.dismiss();
        } else {
          onClose();
        }
      }}
    >
      <ModalScrollContext.Provider value={{ scrollToInput, scrollViewRef }}>
        <View
          style={[
            styles.overlay,
            isKeyboardActive && {
              justifyContent: 'flex-start',
              paddingTop: Math.max(insets.top + 10, anchoredTopY),
              paddingBottom: 0,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={() => {
              if (isKeyboardActive) {
                Keyboard.dismiss();
              } else {
                onClose();
              }
            }}
          />
          <View
            style={styles.keyboardContainer}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              if (y > 0 || height > 0) {
                if (keyboardHeightRef.current === 0 && (initialTopYRef.current === 0 || y < initialTopYRef.current)) {
                  initialTopYRef.current = y;
                }
                cardMetricsRef.current = { y, height };
                setCardMetrics({ y, height });
              }
            }}
          >
            <View
              ref={cardRef}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  maxHeight: effectiveMaxHeight,
                },
                SHADOWS.modal,
                contentStyle,
              ]}
            >
              {/* Header */}
              <View
                style={[styles.header, { borderBottomColor: colors.border }]}
                onLayout={(e) => {
                  headerLayoutRef.current = {
                    y: e.nativeEvent.layout.y,
                    height: e.nativeEvent.layout.height,
                  };
                }}
              >
                <View style={styles.titleArea}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text
                      style={[styles.subtitle, { color: colors.textSecondary }]}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    onClose();
                  }}
                  style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close dialog"
                  accessibilityHint="Dismisses this modal"
                >
                  <X size={15} color={colors.textSecondary} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              {scrollable ? (
                <ScrollView
                  ref={scrollViewRef}
                  style={[styles.scrollView, scrollStyle]}
                  contentContainerStyle={[
                    styles.scrollBody,
                    bodyStyle,
                    isKeyboardActive && { paddingBottom: SPACING.xxl + 24 },
                  ]}
                  onScroll={(e) => {
                    scrollYRef.current = e.nativeEvent.contentOffset.y;
                  }}
                  onLayout={(e) => {
                    scrollViewLayoutRef.current = { height: e.nativeEvent.layout.height };
                    viewportHeightRef.current = e.nativeEvent.layout.height;
                  }}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="none"
                  nestedScrollEnabled={true}
                  scrollEnabled={scrollEnabled}
                  bounces={false}
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={[styles.scrollBody, bodyStyle]}>
                  {children}
                </View>
              )}

              {/* Sticky Action Footer (only rendered if explicit footer prop is passed) */}
              {footer ? (
                <View
                  style={[
                    styles.footer,
                    {
                      backgroundColor: colors.card,
                      borderTopColor: colors.borderLight,
                      marginBottom: isKeyboardActive ? keyboardOverlap + 10 : 0,
                    },
                    footerStyle,
                  ]}
                  onLayout={(e) => {
                    if (e.nativeEvent.layout.height > 0) {
                      footerLayoutRef.current = { height: e.nativeEvent.layout.height };
                    }
                  }}
                >
                  {footer}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ModalScrollContext.Provider>
    </Modal>
  );
};

export const ModalCard: React.FC<ModalCardProps> = React.memo((props) => {
  if (!props.visible) {
    return null;
  }
  return <ModalCardContent {...props} />;
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFill,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 500,
  },
  card: {
    width: '100%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    flexShrink: 0,
  },
  titleArea: {
    flex: 1,
    marginRight: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h3,
    fontWeight: '700',
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollBody: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth * 1.5,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    flexShrink: 0,
  },
});
