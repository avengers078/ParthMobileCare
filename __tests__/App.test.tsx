import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockInit = jest.fn().mockResolvedValue(true);
const mockResetInit = jest.fn();

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: (...args: any[]) => mockInit(...args),
    resetInit: (...args: any[]) => mockResetInit(...args),
    getAuth: jest.fn(() => ({})),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

import App from '../App';

describe('App Root Initialization State Separation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading splash and transitions to success when init resolves true', async () => {
    mockInit.mockResolvedValueOnce(true);

    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
      await Promise.resolve();
    });

    expect(mockInit).toHaveBeenCalled();
    expect(renderer.toJSON()).toBeDefined();
  });

  test('shows error screen and never marks ready when Firebase initialization returns false', async () => {
    mockInit.mockResolvedValueOnce(false);

    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
      await Promise.resolve();
    });

    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('Service Connection Error');
    expect(tree).toContain('Retry Connection');
    expect(tree).not.toContain('Preparing your workspace');
  });

  test('shows error screen when Firebase initialization throws an exception', async () => {
    mockInit.mockRejectedValueOnce(new Error('Network offline or configuration missing'));

    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
      await Promise.resolve();
    });

    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('Service Connection Error');
    expect(tree).toContain('Network offline or configuration missing');
    expect(tree).toContain('Retry Connection');
  });

  test('retry button calls resetInit and restarts initialization', async () => {
    mockInit.mockResolvedValueOnce(false);

    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(<App />);
      await Promise.resolve();
    });

    expect(mockInit).toHaveBeenCalledTimes(1);

    let tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('Service Connection Error');

    // Tap retry button
    const retryBtn = renderer.root.findByProps({ activeOpacity: 0.8 });
    mockInit.mockResolvedValueOnce(true);

    await ReactTestRenderer.act(async () => {
      retryBtn.props.onPress();
      await Promise.resolve();
    });

    expect(mockResetInit).toHaveBeenCalled();
    // mockInit is called for: initial App attempt, retry App attempt, and AuthProvider mounting upon success
    expect(mockInit).toHaveBeenCalledTimes(3);
  });
});
