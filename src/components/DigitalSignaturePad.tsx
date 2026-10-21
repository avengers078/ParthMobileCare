import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface DigitalSignaturePadProps {
  onSave: (signatureData: string) => void;
  onClear?: () => void;
  label?: string;
  initialSignature?: string;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  onSave,
  onClear,
  label = 'Customer Digital Signature',
  initialSignature,
}) => {
  const { colors, isDark } = useTheme();

  // Parse initial signature string into strokes if present
  const parseSignature = (sig?: string): string[] => {
    if (!sig || !sig.trim()) return [];
    const matches = sig.match(/[M][^M]*/g);
    if (matches && matches.length > 0) {
      return matches.map(s => s.trim()).filter(Boolean);
    }
    return [sig.trim()];
  };

  const initialStrokes = parseSignature(initialSignature);
  const [paths, setPaths] = useState<string[]>(initialStrokes);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [hasSigned, setHasSigned] = useState<boolean>(initialStrokes.length > 0);

  const pathsRef = useRef<string[]>(initialStrokes);
  const currentPathRef = useRef<string>('');
  const lastEmittedRef = useRef<string>(initialSignature || '');
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Sync when initialSignature prop changes externally
  useEffect(() => {
    if (initialSignature !== undefined && initialSignature !== lastEmittedRef.current) {
      const parsed = parseSignature(initialSignature);
      pathsRef.current = parsed;
      lastEmittedRef.current = initialSignature;
      setPaths(parsed);
      setHasSigned(parsed.length > 0);
    }
  }, [initialSignature]);

  const commitCurrentStroke = () => {
    const stroke = currentPathRef.current.trim();
    if (stroke) {
      const nextPaths = [...pathsRef.current, stroke];
      pathsRef.current = nextPaths;
      currentPathRef.current = '';
      setPaths(nextPaths);
      setCurrentPath('');
      setHasSigned(true);
      const sigData = nextPaths.join(' ');
      lastEmittedRef.current = sigData;
      onSaveRef.current(sigData);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false, // Prevent parent ScrollView from canceling drawing
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const startPoint = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentPathRef.current = startPoint;
        setCurrentPath(startPoint);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPoint = ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        currentPathRef.current += newPoint;
        setCurrentPath(currentPathRef.current);
      },
      onPanResponderRelease: () => {
        commitCurrentStroke();
      },
      onPanResponderTerminate: () => {
        commitCurrentStroke();
      },
    })
  ).current;

  const handleClear = () => {
    pathsRef.current = [];
    currentPathRef.current = '';
    setPaths([]);
    setCurrentPath('');
    setHasSigned(false);
    lastEmittedRef.current = '';
    onSaveRef.current('');
    if (onClear) onClear();
  };

  const handleUndo = () => {
    const next = pathsRef.current.slice(0, pathsRef.current.length - 1);
    pathsRef.current = next;
    setPaths(next);
    setHasSigned(next.length > 0);
    const sigData = next.join(' ');
    lastEmittedRef.current = sigData;
    onSaveRef.current(sigData);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label} *
        </Text>
        <Text style={[styles.subHint, { color: colors.textMuted }]}>
          Sign inside the box below
        </Text>
      </View>

      <View
        style={[
          styles.padContainer,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: hasSigned ? colors.accent : colors.border,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Svg height="160" width="100%" style={styles.svgCanvas}>
          {paths.map((d, index) => (
            <Path
              key={`path_${index}`}
              d={d}
              stroke={isDark ? '#93C5FD' : '#194D9C'}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath ? (
            <Path
              d={currentPath}
              stroke={isDark ? '#93C5FD' : '#194D9C'}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>

        {!hasSigned && !currentPath && (
          <View style={styles.placeholderContainer} pointerEvents="none">
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              ✍️ Touch and drag to capture digital signature
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={handleClear}
          style={[styles.actionBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.actionBtnText, { color: colors.danger }]}>
            Clear
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleUndo}
          disabled={paths.length === 0}
          style={[
            styles.actionBtn,
            { borderColor: colors.border, opacity: paths.length === 0 ? 0.4 : 1 },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
            Undo
          </Text>
        </TouchableOpacity>

        {hasSigned && (
          <View style={styles.statusBadge}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>
              ✓ Signature Captured
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  subHint: {
    fontSize: 12,
  },
  padContainer: {
    height: 160,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  svgCanvas: {
    flex: 1,
  },
  placeholderContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 6,
    marginRight: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    marginLeft: 'auto',
  },
});
