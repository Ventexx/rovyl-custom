import type { UIConfig } from '../types';

// Baseline is the existing look, including fully visible tiles (menuOpacity was unused).
export const WHEEL_DEFAULTS = {
  menuRadius: 140, iconSize: 64, appSpacing: 10,
  wheelOpacity: 1, wheelDimming: 0.28, labelSize: 12, tileRoundness: 18,
} as const;

const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

export function wheelAppearance(config: UIConfig) {
  return {
    opacity: bounded(config.wheelOpacity, WHEEL_DEFAULTS.wheelOpacity, 0.35, 1),
    // Keep existing profiles visually unchanged. New dimming is actual alpha, with a true zero.
    dimming: bounded(config.wheelDimming, 0.22 + bounded(config.backdropOpacity, 0.2, 0, 1) * 0.3, 0, 0.8),
    labelSize: bounded(config.labelSize, WHEEL_DEFAULTS.labelSize, 10, 20),
    tileRoundness: bounded(config.tileRoundness, WHEEL_DEFAULTS.tileRoundness, 0, 46),
  };
}
