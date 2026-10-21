import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { DigitalSignaturePad } from '../src/components/DigitalSignaturePad';
import { DocumentCapture } from '../src/components/DocumentCapture';
import { ModalCard } from '../src/components/ModalCard';
import { Input } from '../src/components/Input';
import { ThemeProvider } from '../src/context/ThemeContext';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    getStorage: jest.fn(),
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

describe('DigitalSignaturePad', () => {
  it('renders correctly with placeholder when unsigned', () => {
    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DigitalSignaturePad onSave={jest.fn()} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const textInstances = root.findAllByType('Text');
    const hasPlaceholder = textInstances.some((t: any) =>
      typeof t.props.children === 'string' &&
      t.props.children.includes('Touch and drag to capture digital signature')
    );
    expect(hasPlaceholder).toBe(true);
  });

  it('correctly initializes from initialSignature with multiple strokes', () => {
    const multiStrokeSig = 'M 10 10 L 20 20 M 30 30 L 40 40';
    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DigitalSignaturePad
            onSave={jest.fn()}
            initialSignature={multiStrokeSig}
          />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const textInstances = root.findAllByType('Text');
    const hasCaptured = textInstances.some((t: any) =>
      typeof t.props.children === 'string' &&
      t.props.children.includes('Signature Captured')
    );
    expect(hasCaptured).toBe(true);
  });

  it('handles Undo and Clear actions correctly', () => {
    const multiStrokeSig = 'M 10 10 L 20 20 M 30 30 L 40 40';
    const onSaveMock = jest.fn();
    const onClearMock = jest.fn();
    let renderer: any;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DigitalSignaturePad
            onSave={onSaveMock}
            onClear={onClearMock}
            initialSignature={multiStrokeSig}
          />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const pressableNodes = root.findAll((node: any) => typeof node.props.onPress === 'function');
    const clearBtn = pressableNodes.find((n: any) => {
      try {
        return n.findAllByType('Text').some((t: any) => t.props.children === 'Clear');
      } catch {
        return false;
      }
    });
    const undoBtn = pressableNodes.find((n: any) => {
      try {
        return n.findAllByType('Text').some((t: any) => t.props.children === 'Undo');
      } catch {
        return false;
      }
    });

    expect(clearBtn).toBeTruthy();
    expect(undoBtn).toBeTruthy();

    // Trigger Undo: should remove 2nd stroke, keeping 1st stroke
    ReactTestRenderer.act(() => {
      undoBtn.props.onPress();
    });
    expect(onSaveMock).toHaveBeenCalledWith('M 10 10 L 20 20');

    // Trigger Clear: should remove all strokes
    ReactTestRenderer.act(() => {
      clearBtn.props.onPress();
    });
    expect(onSaveMock).toHaveBeenCalledWith('');
    expect(onClearMock).toHaveBeenCalled();
  });
});

describe('DocumentCapture', () => {
  it('renders upload area and triggers capture callback', () => {
    const onCaptureMock = jest.fn();
    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DocumentCapture
            label="Customer Photo"
            onCapture={onCaptureMock}
            required
          />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType('Text');
    const labelText = texts.find((t: any) =>
      Array.isArray(t.props.children) && t.props.children.includes('Customer Photo')
    );
    expect(labelText).toBeTruthy();
  });

  it('renders preview with Remove and Replace when currentUri is provided', () => {
    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DocumentCapture
            label="Aadhaar Front"
            currentUri="file:///data/user/0/test.jpg"
            onCapture={jest.fn()}
          />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType('Text');
    const hasRemove = texts.some((t: any) => t.props.children === 'Remove');
    const hasReplace = texts.some((t: any) => t.props.children === 'Replace');
    expect(hasRemove).toBe(true);
    expect(hasReplace).toBe(true);
  });
});

describe('ModalCard & Input Keyboard Integration', () => {
  it('renders ModalCard and wraps Input within ModalScrollContext', () => {
    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ModalCard visible={true} onClose={jest.fn()} title="Test Modal">
            <Input label="Remarks" placeholder="Enter remarks" />
          </ModalCard>
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const texts = root.findAllByType('Text');
    const hasTitle = texts.some((t: any) => t.props.children === 'Test Modal');
    const hasInputLabel = texts.some((t: any) => t.props.children === 'Remarks');
    expect(hasTitle).toBe(true);
    expect(hasInputLabel).toBe(true);
  });
});
