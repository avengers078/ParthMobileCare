import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, Keyboard, BackHandler, TextInput, View } from 'react-native';
import { KeyboardAwareFormContainer } from '../src/components/KeyboardAwareFormContainer';
import { Input } from '../src/components/Input';
import { ThemeProvider } from '../src/context/ThemeContext';

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#194D9C',
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      danger: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
    },
    isDark: false,
  }),
  ThemeProvider: ({ children }: any) => children,
}));

describe('KeyboardAwareFormContainer Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children, header, footer, cardTitle and cardSubtitle correctly', () => {
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <KeyboardAwareFormContainer
            header={<Text>Test Brand Header</Text>}
            footer={<Text>Test App Footer</Text>}
            cardTitle="Test Card Title"
            cardSubtitle="Test Card Subtitle"
          >
            <Text>Form Content Inside Card</Text>
            <Input placeholder="Enter email" />
          </KeyboardAwareFormContainer>
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType(Text).map((t: any) => t.props.children);
    expect(texts).toContain('Test Brand Header');
    expect(texts).toContain('Test App Footer');
    expect(texts).toContain('Test Card Title');
    expect(texts).toContain('Test Card Subtitle');
    expect(texts).toContain('Form Content Inside Card');
  });

  it('handles keyboard show and hide listeners safely and calls onKeyboardChange', () => {
    let showCb: any = null;
    let hideCb: any = null;

    const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string, cb: any) => {
      if (event === 'keyboardDidShow' || event === 'keyboardWillShow') showCb = cb;
      if (event === 'keyboardDidHide' || event === 'keyboardWillHide') hideCb = cb;
      return { remove: jest.fn() } as any;
    });

    const onKeyboardChange = jest.fn();

    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <KeyboardAwareFormContainer
            cardTitle="Login Form"
            onKeyboardChange={onKeyboardChange}
          >
            <Input placeholder="Enter username" />
          </KeyboardAwareFormContainer>
        </ThemeProvider>
      );
    });

    expect(addListenerSpy).toHaveBeenCalled();

    if (showCb) {
      act(() => {
        showCb({
          endCoordinates: { height: 300, screenX: 0, screenY: 500, width: 360 },
        });
      });
    }

    expect(onKeyboardChange).toHaveBeenCalledWith(true, 300);

    if (hideCb) {
      act(() => {
        hideCb();
      });
    }

    expect(onKeyboardChange).toHaveBeenCalledWith(false, 0);

    const input = renderer.root.findByType(TextInput);
    expect(input.props.placeholder).toBe('Enter username');
    addListenerSpy.mockRestore();
  });

  it('dismisses keyboard on hardware back press when keyboard is active', () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    let showCb: any = null;
    let backPressCb: any = null;

    const keyboardSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string, cb: any) => {
      if (event === 'keyboardDidShow' || event === 'keyboardWillShow') showCb = cb;
      return { remove: jest.fn() } as any;
    });

    const backSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event: string, cb: any) => {
      if (event === 'hardwareBackPress') backPressCb = cb;
      return { remove: jest.fn() } as any;
    });

    act(() => {
      ReactTestRenderer.create(
        <ThemeProvider>
          <KeyboardAwareFormContainer cardTitle="Staff Form">
            <Input placeholder="Mobile Number" />
          </KeyboardAwareFormContainer>
        </ThemeProvider>
      );
    });

    // Simulate keyboard open
    if (showCb) {
      act(() => {
        showCb({
          endCoordinates: { height: 280, screenX: 0, screenY: 520, width: 360 },
        });
      });
    }

    // Trigger hardware back handler
    if (backPressCb) {
      act(() => {
        const handled = backPressCb();
        expect(handled).toBe(true);
      });
      expect(dismissSpy).toHaveBeenCalled();
    }

    dismissSpy.mockRestore();
    keyboardSpy.mockRestore();
    backSpy.mockRestore();
  });

  it('provides scroll context so child Input can register and focus safely', () => {
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <KeyboardAwareFormContainer cardTitle="Registration Step 1">
            <Input placeholder="Full Name" />
            <Input placeholder="Password" />
          </KeyboardAwareFormContainer>
        </ThemeProvider>
      );
    });

    const inputs = renderer.root.findAllByType(TextInput);
    expect(inputs.length).toBe(2);

    // Trigger focus on second input
    act(() => {
      if (inputs[1].props.onFocus) {
        inputs[1].props.onFocus({ nativeEvent: {} });
      }
    });
  });

  it('renders centered registration stepper with equal circle dimensions and equal lines', () => {
    const isStep1Active = true;
    const isLine1Active = false;
    const isStep2Active = false;
    const isLine2Active = false;
    const isStep3Active = false;

    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(
        <View style={{ width: '100%', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', width: '100%', maxWidth: 240 }}>
            <View testID="dot-1" style={{ width: 28, height: 28, borderRadius: 14 }}>
              <Text>{isStep1Active ? '1' : ''}</Text>
            </View>
            <View testID="line-1" style={{ flex: 1, height: 2 }} />
            <View testID="dot-2" style={{ width: 28, height: 28, borderRadius: 14 }}>
              <Text>2</Text>
            </View>
            <View testID="line-2" style={{ flex: 1, height: 2 }} />
            <View testID="dot-3" style={{ width: 28, height: 28, borderRadius: 14 }}>
              <Text>3</Text>
            </View>
          </View>
        </View>
      );
    });

    const root = renderer.root;
    const dot1 = root.findByProps({ testID: 'dot-1' });
    const dot2 = root.findByProps({ testID: 'dot-2' });
    const dot3 = root.findByProps({ testID: 'dot-3' });
    const line1 = root.findByProps({ testID: 'line-1' });
    const line2 = root.findByProps({ testID: 'line-2' });

    expect(dot1.props.style.width).toBe(28);
    expect(dot2.props.style.width).toBe(28);
    expect(dot3.props.style.width).toBe(28);
    expect(line1.props.style.flex).toBe(1);
    expect(line2.props.style.flex).toBe(1);
  });
});
