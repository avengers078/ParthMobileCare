import React, { useState, useEffect, useRef, createContext } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  StyleProp,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '../theme';

export interface ModalScrollContextType {
  scrollToInput: (targetNode: any) => void;
  scrollViewRef: React.RefObject<any>;
}

export const ModalScrollContext = createContext<ModalScrollContextType | null>(null);

interface ModalCardProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  maxHeight?: string | number;
}

export const ModalCard: React.FC<ModalCardProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  contentStyle,
  maxHeight = '85%',
}) => {
  const { colors } = useTheme();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const scrollViewRef = useRef<any>(null);
  const lastFocusedNodeRef = useRef<any>(null);

  useEffect(() => {
    const onDimensionsChange = ({ window }: { window: { height: number } }) => {
      setScreenHeight(window.height);
    };
    const dimSub = Dimensions.addEventListener('change', onDimensionsChange);

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kh = e.endCoordinates.height;
      setKeyboardHeight(kh);
      if (lastFocusedNodeRef.current) {
        scrollToInput(lastFocusedNodeRef.current);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      dimSub?.remove();
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToInput = (targetNode: any) => {
    if (!targetNode) return;
    lastFocusedNodeRef.current = targetNode;

    setTimeout(() => {
      try {
        if (!targetNode || !scrollViewRef.current) return;
        targetNode.measureLayout(
          scrollViewRef.current as any,
          (left: number, top: number, width: number, height: number) => {
            const targetY = Math.max(0, top - 30);
            scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
          },
          () => {}
        );
      } catch (e) {
        // Safe fallback
      }
    }, 100);
  };

  const isKeyboardActive = keyboardHeight > 0;
  const dynamicMaxHeight = isKeyboardActive
    ? Math.max(260, screenHeight - keyboardHeight - (Platform.OS === 'android' ? 36 : 50))
    : maxHeight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <ModalScrollContext.Provider value={{ scrollToInput, scrollViewRef }}>
        <View
          style={[
            styles.overlay,
            isKeyboardActive && {
              justifyContent: 'flex-start',
              paddingTop: Platform.OS === 'android' ? 16 : 32,
              paddingBottom: 8,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={onClose}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  maxHeight: dynamicMaxHeight as any,
                },
                SHADOWS.modal,
                contentStyle,
              ]}
            >
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
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
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={[
                  styles.scrollBody,
                  isKeyboardActive && { paddingBottom: 140 },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {children}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </ModalScrollContext.Provider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
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
  scrollBody: {
    padding: SPACING.xl,
  },
});
