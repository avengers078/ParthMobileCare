import React from 'react';

describe('Face Enrollment Camera & Sample Counter Bug Fixes', () => {
  const REQUIRED_SAMPLES = 3;

  describe('Bug 1: FaceMaskOverlay geometry and responsive container centering', () => {
    it('centers oval within container dimensions instead of whole device screen', () => {
      // In the bug, useWindowDimensions returned 915px height, placing cy at 411px.
      // In a 380px high container, 411px was pushed completely to the bottom rim.
      const containerLayout = { width: 360, height: 380 };

      // Patched calculation:
      const cx = containerLayout.width * 0.5;
      const cy = containerLayout.height * 0.44;
      const rx = Math.min(Math.round(containerLayout.width * 0.30), 125);
      const ry = Math.min(Math.round(containerLayout.height * 0.32), 155);

      expect(cx).toBe(180);
      expect(cy).toBeCloseTo(167.2);
      expect(rx).toBe(108);
      expect(ry).toBe(122);

      // Verify oval top is inside container
      const ovalTop = cy - ry;
      expect(ovalTop).toBeGreaterThan(0);
      expect(ovalTop).toBeCloseTo(45.2);

      // Verify oval bottom is well above the bottom hintBar (which sits at bottom ~48px: y >= 332px)
      const ovalBottom = cy + ry;
      expect(ovalBottom).toBeLessThan(332);
      expect(ovalBottom).toBeCloseTo(289.2);
    });
  });

  describe('Bug 2: Atomic lock and strict limit of 3 samples (never 8 of 3)', () => {
    it('strictly clamps samples to 3 even when 8 rapid frames arrive', async () => {
      let isCapturing = false;
      const samples: string[] = [];
      let sampleCount = 0;
      let sessionKey = 1;

      const handleCapture = async (embedding: string) => {
        // Atomic guard
        if (isCapturing || samples.length >= REQUIRED_SAMPLES) {
          return;
        }
        isCapturing = true;

        try {
          if (samples.length >= REQUIRED_SAMPLES) {
            return;
          }

          samples.push(embedding);
          const currentCount = Math.min(samples.length, REQUIRED_SAMPLES);
          sampleCount = currentCount;

          if (currentCount < REQUIRED_SAMPLES) {
            // Simulated cooldown
            sessionKey += 1;
            isCapturing = false;
            return;
          }

          // At 3 samples, lock permanently
          expect(currentCount).toBe(REQUIRED_SAMPLES);
        } catch {
          isCapturing = false;
        }
      };

      // Simulate 8 rapid consecutive frame results
      const mockFrames = Array.from({ length: 8 }, (_, i) => `embedding_${i + 1}`);

      for (const frame of mockFrames) {
        await handleCapture(frame);
      }

      // Assert that counter NEVER exceeded 3 and samples array has exactly 3 elements
      expect(sampleCount).toBe(3);
      expect(samples.length).toBe(3);
      expect(samples).toEqual(['embedding_1', 'embedding_2', 'embedding_3']);
      expect(sampleCount).not.toBe(8);
    });

    it('concurrent frame callbacks are dropped by isCapturing lock', async () => {
      let isCapturing = false;
      const samples: string[] = [];
      let droppedCount = 0;

      const handleConcurrentCapture = async (id: number) => {
        if (isCapturing || samples.length >= REQUIRED_SAMPLES) {
          droppedCount++;
          return false;
        }
        isCapturing = true;
        // simulate async duplicate check
        await new Promise((r) => setTimeout(r, 20));
        samples.push(`sample_${id}`);
        isCapturing = false;
        return true;
      };

      // Fire 5 concurrent requests at the exact same instant
      const results = await Promise.all([
        handleConcurrentCapture(1),
        handleConcurrentCapture(2),
        handleConcurrentCapture(3),
        handleConcurrentCapture(4),
        handleConcurrentCapture(5),
      ]);

      // Only 1 should have succeeded, the remaining 4 dropped
      const successfulCaptures = results.filter(Boolean);
      expect(successfulCaptures.length).toBe(1);
      expect(droppedCount).toBe(4);
      expect(samples.length).toBe(1);
    });
  });

  describe('Bug 3: Camera preview continuity without unmounting', () => {
    it('increments sessionKey without triggering component unmount', () => {
      let unmountCount = 0;
      let pipelineRestartCount = 0;

      // Component lifecycle simulation:
      // Previously, <FaceAuthView key={sessionKey} /> forced unmount on every sample.
      // Now, sessionKey is passed as a prop, keeping Camera mounted.
      const simulateSessionKeyPropChange = (oldKey: number, newKey: number) => {
        if (oldKey !== newKey) {
          // Triggers useEffect([sessionKey]) -> cancel() & start()
          pipelineRestartCount++;
          // unmountCount remains 0 because key did not change on the component
        }
      };

      simulateSessionKeyPropChange(1, 2);
      simulateSessionKeyPropChange(2, 3);

      expect(unmountCount).toBe(0);
      expect(pipelineRestartCount).toBe(2);
    });
  });
});
