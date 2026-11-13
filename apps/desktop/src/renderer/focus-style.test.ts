import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('keyboard focus visibility', () => {
  it('keeps a visible focus ring on native buttons, selectors and inputs', () => {
    const rule = styles.match(
      /button:focus-visible,\s*select:focus-visible,\s*input:focus-visible\s*\{([^}]+)\}/,
    );

    expect(rule?.[1]).toContain('outline: 2px solid var(--lime)');
    expect(rule?.[1]).toContain('outline-offset: 2px');
  });
});
