import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WidgetPosition, WidgetPreferences } from '@obpulse/contracts';

export const WIDGET_POSITIONS = [
  'tray',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const satisfies readonly WidgetPosition[];

export const WIDGET_OPACITIES = [0.75, 0.85, 0.95, 1] as const;

export const DEFAULT_WIDGET_PREFERENCES: WidgetPreferences = {
  position: 'tray',
  opacity: 1,
  highContrast: false,
};

interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function calculateWidgetPosition(
  position: WidgetPosition,
  windowSize: { readonly width: number; readonly height: number },
  workArea: Bounds,
  trayBounds?: Bounds,
): { x: number; y: number } {
  const margin = 16;
  const maximumX = workArea.x + workArea.width - windowSize.width;
  const maximumY = workArea.y + workArea.height - windowSize.height;
  const clampX = (value: number) => Math.max(workArea.x, Math.min(value, maximumX));
  const clampY = (value: number) => Math.max(workArea.y, Math.min(value, maximumY));

  if (position === 'tray' && trayBounds) {
    const trayIsBelowCenter = trayBounds.y > workArea.y + workArea.height / 2;
    return {
      x: clampX(trayBounds.x + trayBounds.width - windowSize.width),
      y: clampY(
        trayIsBelowCenter
          ? trayBounds.y - windowSize.height - 8
          : trayBounds.y + trayBounds.height + 8,
      ),
    };
  }

  const left = position === 'top-left' || position === 'bottom-left';
  const bottom = position === 'bottom-left' || position === 'bottom-right';
  return {
    x: clampX(left ? workArea.x + margin : maximumX - margin),
    y: clampY(bottom ? maximumY - margin : workArea.y + margin),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseWidgetPreferences(value: unknown): WidgetPreferences {
  if (!isRecord(value)) throw new Error('Widget preferences must be an object');
  if (!WIDGET_POSITIONS.includes(value.position as WidgetPosition)) {
    throw new Error('Unsupported widget position');
  }
  if (!WIDGET_OPACITIES.includes(value.opacity as (typeof WIDGET_OPACITIES)[number])) {
    throw new Error('Unsupported widget opacity');
  }
  if (typeof value.highContrast !== 'boolean') {
    throw new Error('High contrast preference must be boolean');
  }
  return {
    position: value.position as WidgetPosition,
    opacity: value.opacity as number,
    highContrast: value.highContrast,
  };
}

export async function loadWidgetPreferences(filePath: string): Promise<WidgetPreferences> {
  try {
    return parseWidgetPreferences(JSON.parse(await readFile(filePath, 'utf8')));
  } catch {
    return { ...DEFAULT_WIDGET_PREFERENCES };
  }
}

export async function saveWidgetPreferences(
  filePath: string,
  value: unknown,
): Promise<WidgetPreferences> {
  const preferences = parseWidgetPreferences(value);
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(preferences, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporaryPath, filePath);
  return preferences;
}
