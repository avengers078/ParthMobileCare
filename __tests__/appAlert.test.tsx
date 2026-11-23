import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AppAlert } from '../src/components/common/AppAlert';
import { AlertProvider, useAlert, AppAlertService } from '../src/context/AlertContext';
import { Text, TouchableOpacity } from 'react-native';

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
}));

describe('AppAlert Custom Alert Component & Context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. AppAlert Visual Rendering', () => {
    it('renders success alert with title, message, and OK button', () => {
      const onConfirm = jest.fn();
      let renderer: any;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AppAlert
            visible={true}
            options={{
              type: 'success',
              title: 'Staff Account Created',
              message: 'Account provisioned successfully for Ramesh Patel.',
              confirmText: 'Done',
              onConfirm,
            }}
            onDismiss={jest.fn()}
          />
        );
      });

      const root = renderer.root;
      const texts = root.findAllByType(Text).map((t: any) => t.props.children);
      expect(texts).toContain('Staff Account Created');
      expect(texts).toContain('Account provisioned successfully for Ramesh Patel.');
      expect(texts).toContain('Done');

      const buttons = root.findAllByType(TouchableOpacity);
      expect(buttons.length).toBe(1);
      act(() => {
        buttons[0].props.onPress();
      });
      expect(onConfirm).toHaveBeenCalled();
    });

    it('renders confirmation dialog with Cancel and Destructive Deactivate buttons', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();
      let renderer: any;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AppAlert
            visible={true}
            options={{
              type: 'confirm',
              title: 'Deactivate Staff Accounts?',
              message: 'The selected staff members will no longer be able to access their accounts. Do you want to continue?',
              confirmText: 'Deactivate',
              cancelText: 'Cancel',
              destructive: true,
              onConfirm,
              onCancel,
            }}
            onDismiss={jest.fn()}
          />
        );
      });

      const root = renderer.root;
      const texts = root.findAllByType(Text).map((t: any) => t.props.children);
      expect(texts).toContain('Deactivate Staff Accounts?');
      expect(texts).toContain('The selected staff members will no longer be able to access their accounts. Do you want to continue?');
      expect(texts).toContain('Deactivate');
      expect(texts).toContain('Cancel');

      const buttons = root.findAllByType(TouchableOpacity);
      expect(buttons.length).toBe(2);

      // Tap Confirm (Deactivate)
      act(() => {
        buttons[1].props.onPress();
      });
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('2. AlertContext and useAlert Hook', () => {
    const TestConsumer: React.FC = () => {
      const { showSuccess, showError, showConfirm } = useAlert();
      return (
        <>
          <TouchableOpacity
            accessibilityLabel="btn-success"
            onPress={() => showSuccess('Success Title', 'Success body message')}
          />
          <TouchableOpacity
            accessibilityLabel="btn-error"
            onPress={() => showError('Error Title', new Error('internal [0]'))}
          />
          <TouchableOpacity
            accessibilityLabel="btn-confirm"
            onPress={() =>
              showConfirm({
                title: 'Confirm Title',
                message: 'Confirm message',
                onConfirm: jest.fn(),
              })
            }
          />
        </>
      );
    };

    it('displays error alert with human-friendly translated text', () => {
      let renderer: any;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AlertProvider>
            <TestConsumer />
          </AlertProvider>
        );
      });

      const root = renderer.root;
      const errorBtn = root.find((n: any) => n.props?.accessibilityLabel === 'btn-error');

      // Trigger error alert with internal [0]
      act(() => {
        errorBtn.props.onPress();
      });

      // The modal should now display user-friendly message
      const texts = root.findAllByType(Text).map((t: any) => t.props.children);
      expect(texts).toContain('Error Title');
      expect(texts).toContain('Something went wrong while processing your request. Please try again.');
    });
  });

  describe('3. AppAlertService Static API', () => {
    it('dispatches alert imperatively to AlertProvider listener', () => {
      let renderer: any;
      act(() => {
        renderer = ReactTestRenderer.create(
          <AlertProvider>
            <Text>App Root</Text>
          </AlertProvider>
        );
      });

      act(() => {
        AppAlertService.showSuccess('Service Alert', 'Triggered from outside component');
      });

      const root = renderer.root;
      const texts = root.findAllByType(Text).map((t: any) => t.props.children);
      expect(texts).toContain('Service Alert');
      expect(texts).toContain('Triggered from outside component');

      // Hide alert
      act(() => {
        AppAlertService.hide();
      });
    });
  });
});

