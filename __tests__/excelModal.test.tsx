import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ExcelImportModal } from '../src/components/ExcelImportModal';
import { ThemeProvider } from '../src/context/ThemeContext';
import { MobilePriceItem } from '../src/types';
import { Keyboard } from 'react-native';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    getStorage: jest.fn(),
  },
}));

const mockMetrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 40, left: 0, right: 0, bottom: 34 },
};

describe('ExcelImportModal component', () => {
  const mockExisting: MobilePriceItem[] = [
    {
      id: 'm1',
      brand: 'Vivo',
      model: 'V50',
      ram: '8GB',
      storage: '128GB',
      purchasePrice: 22000,
      sellingPrice: 24999,
      updatedAt: '2026-09-01T00:00:00Z',
      priceHistory: [],
    },
  ];

  it('renders modal header, input area, and action buttons when visible', () => {
    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={mockMetrics}>
          <ThemeProvider>
            <ExcelImportModal
              visible={true}
              onClose={jest.fn()}
              existingItems={mockExisting}
              onImportComplete={jest.fn()}
            />
          </ThemeProvider>
        </SafeAreaProvider>
      );
    });

    const root = renderer.root;
    const textInstances = root.findAllByType('Text');
    const texts = textInstances.map((t: any) =>
      typeof t.props.children === 'string' ? t.props.children : ''
    );

    expect(texts).toContain('Smart Excel / CSV Import');
    expect(texts).toContain('Excel Sheet Content (CSV / XLSX)');
    expect(texts).toContain('Load Sample Sheet (PDF Example)');
    expect(texts).toContain('Validate & Detect Data');
  });

  it('registers keyboard event listeners and unmounts cleanly', () => {
    let capturedCallback: any = null;
    const removeSub = jest.fn();
    const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event: string, cb: any) => {
      if (event === 'keyboardDidShow') {
        capturedCallback = cb;
      }
      return { remove: removeSub } as any;
    });

    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={mockMetrics}>
          <ThemeProvider>
            <ExcelImportModal
              visible={true}
              onClose={jest.fn()}
              existingItems={mockExisting}
              onImportComplete={jest.fn()}
            />
          </ThemeProvider>
        </SafeAreaProvider>
      );
    });

    expect(addListenerSpy).toHaveBeenCalled();
    if (capturedCallback) {
      ReactTestRenderer.act(() => {
        capturedCallback({ endCoordinates: { height: 320 } });
      });
    }

    ReactTestRenderer.act(() => {
      renderer.unmount();
    });

    expect(removeSub).toHaveBeenCalled();
    addListenerSpy.mockRestore();
  });
});

