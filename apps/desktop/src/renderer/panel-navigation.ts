export type WindowMode = 'compact' | 'expanded';
export type PanelSurface = 'monitor' | 'settings';

export interface PanelNavigation {
  readonly mode: WindowMode;
  readonly surface: PanelSurface;
}

export function toggleSettings(navigation: PanelNavigation): PanelNavigation {
  if (navigation.surface === 'settings') return { mode: 'expanded', surface: 'monitor' };
  return { mode: 'expanded', surface: 'settings' };
}

export function toggleWindowMode(navigation: PanelNavigation): PanelNavigation {
  if (navigation.mode === 'compact') return { mode: 'expanded', surface: 'monitor' };
  return { mode: 'compact', surface: 'monitor' };
}

export function receiveWindowMode(navigation: PanelNavigation, mode: WindowMode): PanelNavigation {
  return { mode, surface: mode === 'compact' ? 'monitor' : navigation.surface };
}
