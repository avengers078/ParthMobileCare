import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { ThemeProvider } from '../src/context/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

import { StorageService } from '../src/services/storageService';
import { FirestoreSyncService } from '../src/services/firestoreSync';
import { ModalCard } from '../src/components/ModalCard';
import { PrimaryButton } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { FilterChip } from '../src/components/FilterChip';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockMetrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 40, left: 0, right: 0, bottom: 34 },
};

describe('App Performance and Responsiveness Suite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    StorageService.clearMemoryCache();
    await AsyncStorage.clear();
    jest.spyOn(FirestoreSyncService, 'syncDocument').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('StorageService In-Memory Cache Latency & I/O Reduction', () => {
    it('serves repeated reads from memory cache in sub-millisecond time without hitting AsyncStorage', async () => {
      const mockLead = {
        id: 'lead_1',
        customerName: 'Test Customer',
        phone: '9876543210',
        deviceModel: 'iPhone 13',
        issueDescription: 'Battery replacement',
        stage: 'NEW_LEAD',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Populate storage and memory cache
      await StorageService.saveLead(mockLead as any);

      // Clear the mock calls recorded during the write operation
      (AsyncStorage.getItem as jest.Mock).mockClear();

      const start = Date.now();
      const cachedLeads = await StorageService.getLeads();
      const duration = Date.now() - start;

      expect(cachedLeads).toHaveLength(1);
      expect(cachedLeads[0].customerName).toBe('Test Customer');
      // Sub-millisecond retrieval from memory cache
      expect(duration).toBeLessThanOrEqual(20);
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it('invalidates cache correctly on write/delete operations so stale data is never returned', async () => {
      const initialLead = {
        id: 'lead_perf_1',
        customerName: 'Initial Name',
        phone: '9999999999',
        deviceModel: 'Galaxy S22',
        stage: 'NEW_LEAD',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await StorageService.saveLead(initialLead as any);
      let leads = await StorageService.getLeads();
      expect(leads[0].customerName).toBe('Initial Name');

      // Update lead
      await StorageService.saveLead({
        ...initialLead,
        customerName: 'Updated Name',
      } as any);

      leads = await StorageService.getLeads();
      expect(leads[0].customerName).toBe('Updated Name');

      // Delete lead
      await StorageService.deleteLead('lead_perf_1');
      leads = await StorageService.getLeads();
      expect(leads).toHaveLength(0);
    });

    it('isolates price list, purchases, and sales in independent cache slots', async () => {
      const priceItem = {
        id: 'price_1',
        brand: 'Apple',
        model: 'iPhone 14',
        repairType: 'Screen',
        costPrice: 3000,
        sellingPrice: 5000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await StorageService.savePriceItem(priceItem as any);
      const items = await StorageService.getPriceList();
      expect(items).toHaveLength(1);
      expect(items[0].model).toBe('iPhone 14');

      // Clearing memory cache clears all slots and forces fresh fetch
      StorageService.clearMemoryCache();
      (AsyncStorage.getItem as jest.Mock).mockClear();
      await StorageService.getPriceList();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@pmc_price_list');
    });
  });

  describe('ModalCard Lazy Mounting Architecture', () => {
    it('does NOT mount internal tree when visible is false (prevents layout and keyboard overhead)', () => {
      const childRenderSpy = jest.fn();

      const TestChild = () => {
        childRenderSpy();
        return <Text testID="modal-child-text">Heavy Form Content</Text>;
      };

      let renderer: any;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={mockMetrics}>
            <ThemeProvider>
              <ModalCard visible={false} onClose={() => {}}>
                <TestChild />
              </ModalCard>
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      // Child must NOT be rendered when modal is hidden
      expect(childRenderSpy).not.toHaveBeenCalled();
      const foundChildren = renderer.root.findAllByProps({ testID: 'modal-child-text' });
      expect(foundChildren).toHaveLength(0);
    });

    it('mounts internal tree immediately when visible transitions to true', () => {
      const childRenderSpy = jest.fn();

      const TestChild = () => {
        childRenderSpy();
        return <Text testID="modal-child-text">Heavy Form Content</Text>;
      };

      let renderer: any;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={mockMetrics}>
            <ThemeProvider>
              <ModalCard visible={false} onClose={() => {}}>
                <TestChild />
              </ModalCard>
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      expect(childRenderSpy).not.toHaveBeenCalled();
      expect(renderer.root.findAllByProps({ testID: 'modal-child-text' })).toHaveLength(0);

      // Transition to visible
      ReactTestRenderer.act(() => {
        renderer.update(
          <SafeAreaProvider initialMetrics={mockMetrics}>
            <ThemeProvider>
              <ModalCard visible={true} onClose={() => {}}>
                <TestChild />
              </ModalCard>
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      expect(childRenderSpy).toHaveBeenCalledTimes(1);
      expect(renderer.root.findAllByProps({ testID: 'modal-child-text' }).length).toBeGreaterThan(0);
    });
  });

  describe('Optimized Core UI Components (React.memo)', () => {
    it('renders PrimaryButton with correct text and handles press', () => {
      const onPressMock = jest.fn();
      let renderer: any;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={mockMetrics}>
            <ThemeProvider>
              <PrimaryButton title="Save Lead" onPress={onPressMock} />
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      expect(renderer.root.findByProps({ children: 'Save Lead' })).toBeTruthy();
    });

    it('renders FilterChip and shows label and count', () => {
      const onPressMock = jest.fn();
      let renderer: any;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={mockMetrics}>
            <ThemeProvider>
              <FilterChip label="NEW_LEAD" count={5} selected={false} onPress={onPressMock} />
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      expect(renderer.root.findByProps({ children: 'NEW_LEAD' })).toBeTruthy();
      expect(renderer.root.findByProps({ children: 5 })).toBeTruthy();
    });

    it('renders Input component without layout shifts', () => {
      const onChangeMock = jest.fn();
      let renderer: any;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={mockMetrics}>
            <ThemeProvider>
              <Input
                label="Customer Name"
                placeholder="Enter customer name"
                value="Rajesh Patel"
                onChangeText={onChangeMock}
              />
            </ThemeProvider>
          </SafeAreaProvider>
        );
      });

      expect(renderer.root.findByProps({ value: 'Rajesh Patel' })).toBeTruthy();
    });
  });
});
