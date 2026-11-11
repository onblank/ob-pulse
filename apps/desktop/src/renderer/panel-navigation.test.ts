import { describe, expect, it } from 'vitest';
import { receiveWindowMode, toggleSettings, toggleWindowMode } from './panel-navigation';

describe('panel navigation', () => {
  it('opens settings in the expanded window from either monitor size', () => {
    expect(toggleSettings({ mode: 'compact', surface: 'monitor' })).toEqual({
      mode: 'expanded',
      surface: 'settings',
    });
    expect(toggleSettings({ mode: 'expanded', surface: 'monitor' })).toEqual({
      mode: 'expanded',
      surface: 'settings',
    });
  });

  it('returns from settings to the expanded monitor', () => {
    expect(toggleSettings({ mode: 'expanded', surface: 'settings' })).toEqual({
      mode: 'expanded',
      surface: 'monitor',
    });
  });

  it('always returns to the monitor when compacting', () => {
    expect(toggleWindowMode({ mode: 'expanded', surface: 'settings' })).toEqual({
      mode: 'compact',
      surface: 'monitor',
    });
    expect(receiveWindowMode({ mode: 'expanded', surface: 'settings' }, 'compact')).toEqual({
      mode: 'compact',
      surface: 'monitor',
    });
  });
});
