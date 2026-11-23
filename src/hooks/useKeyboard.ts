import { useState, useEffect } from 'react';
import { Keyboard, KeyboardEvent, Platform, LayoutAnimation } from 'react-native';

export interface KeyboardState {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
  dismissKeyboard: () => void;
}

/**
 * Universal keyboard listener hook providing synchronized keyboard height and visibility.
 * Supports iOS keyboardWillShow/Hide and Android keyboardDidShow/Hide.
 */
export function useKeyboard(): KeyboardState {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      const kh = e.endCoordinates ? e.endCoordinates.height : 0;
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setKeyboardHeight(kh);
    };

    const onHide = () => {
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardVisible: keyboardHeight > 0,
    dismissKeyboard: Keyboard.dismiss,
  };
}

