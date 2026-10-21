import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WIDGET_PREFERENCES,
  calculateWidgetPosition,
  loadWidgetPreferences,
  parseWidgetPreferences,
  saveWidgetPreferences,
} from './preferences.js';

const temporaryDirectories: string[] = [];

async function temporaryFile(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'obpulse-preferences-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'preferences.json');
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('widget preferences', () => {
  it('accepts only supported positions, opacities and contrast values', () => {
    expect(
      parseWidgetPreferences({ position: 'bottom-left', opacity: 0.85, highContrast: true }),
    ).toEqual({ position: 'bottom-left', opacity: 0.85, highContrast: true });
    expect(() =>
      parseWidgetPreferences({ position: 'center', opacity: 0.85, highContrast: true }),
    ).toThrow('Unsupported widget position');
    expect(() =>
      parseWidgetPreferences({ position: 'tray', opacity: 0, highContrast: false }),
    ).toThrow('Unsupported widget opacity');
  });

  it('falls back safely when the file is missing or malformed', async () => {
    const filePath = await temporaryFile();
    await expect(loadWidgetPreferences(filePath)).resolves.toEqual(DEFAULT_WIDGET_PREFERENCES);
    await writeFile(filePath, '{not-json', 'utf8');
    await expect(loadWidgetPreferences(filePath)).resolves.toEqual(DEFAULT_WIDGET_PREFERENCES);
  });

  it('writes and reloads a validated preference set', async () => {
    const filePath = await temporaryFile();
    const expected = { position: 'top-left' as const, opacity: 0.95, highContrast: true };
    await expect(saveWidgetPreferences(filePath, expected)).resolves.toEqual(expected);
    await expect(loadWidgetPreferences(filePath)).resolves.toEqual(expected);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(expected);
  });

  it('anchors to a selected corner and clamps tray placement to the work area', () => {
    const area = { x: 100, y: 50, width: 1200, height: 800 };
    const size = { width: 360, height: 430 };
    expect(calculateWidgetPosition('bottom-left', size, area)).toEqual({ x: 116, y: 404 });
    expect(
      calculateWidgetPosition('tray', size, area, { x: 1260, y: 820, width: 30, height: 30 }),
    ).toEqual({ x: 930, y: 382 });
  });
});
