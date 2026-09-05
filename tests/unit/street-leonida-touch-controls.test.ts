import { describe, expect, it } from 'vitest';

import {
  TOUCH_JOYSTICK_RUN_THRESHOLD,
  resolveTouchJoystickInput,
} from '../../src/features/street-leonida/walk-world';

describe('Street Leonida touch controls', () => {
  it('maps every point on the stick surface to proportional analog movement', () => {
    expect(resolveTouchJoystickInput(0, 0, 48)).toEqual({
      axes: { right: 0, forward: 0 },
      intensity: 0,
      knob: { x: 0, y: 0 },
      running: false,
    });

    const halfwayForward = resolveTouchJoystickInput(0, -24, 48);
    expect(halfwayForward.axes).toEqual({ right: 0, forward: 0.5 });
    expect(halfwayForward.intensity).toBe(0.5);
    expect(halfwayForward.knob).toEqual({ x: 0, y: -24 });
    expect(halfwayForward.running).toBe(false);
  });

  it('clamps drags beyond the rim and enables running only at a full push', () => {
    const atRunThreshold = resolveTouchJoystickInput(TOUCH_JOYSTICK_RUN_THRESHOLD * 50, 0, 50);
    const beyondRim = resolveTouchJoystickInput(120, -160, 50);

    expect(atRunThreshold.running).toBe(true);
    expect(beyondRim.axes.right).toBeCloseTo(0.6, 10);
    expect(beyondRim.axes.forward).toBeCloseTo(0.8, 10);
    expect(beyondRim.intensity).toBe(1);
    expect(Math.hypot(beyondRim.knob.x, beyondRim.knob.y)).toBeCloseTo(50, 10);
    expect(beyondRim.running).toBe(true);
  });

  it('fails closed for unusable pointer geometry', () => {
    expect(resolveTouchJoystickInput(Number.NaN, 10, 40).axes).toEqual({
      right: 0,
      forward: 0,
    });
    expect(resolveTouchJoystickInput(10, 10, 0).running).toBe(false);
  });
});
