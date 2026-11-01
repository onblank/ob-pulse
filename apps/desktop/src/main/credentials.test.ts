import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EncryptedCredentialStore, validApiToken, type SecretCipher } from './credentials.js';

const temporaryDirectories: string[] = [];

async function temporaryFile(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'obpulse-credentials-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'lmstudio-api-token.enc.json');
}

function cipher(options: { available?: boolean; rotate?: boolean } = {}): SecretCipher {
  return {
    available: async () => options.available ?? true,
    encrypt: async (value) => Buffer.from(`encrypted:${Array.from(value).reverse().join('')}`),
    decrypt: async (value) => ({
      result: value
        .toString()
        .replace(/^encrypted:/, '')
        .split('')
        .reverse()
        .join(''),
      shouldReEncrypt: options.rotate ?? false,
    }),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe('encrypted runtime credentials', () => {
  it('validates tokens without retaining surrounding whitespace', () => {
    expect(validApiToken('  lms-token_123  ')).toBe('lms-token_123');
    expect(() => validApiToken('token with spaces')).toThrow('Invalid');
    expect(() => validApiToken('')).toThrow('Invalid');
  });

  it('persists only encrypted bytes and decrypts them on load', async () => {
    const filePath = await temporaryFile();
    const store = new EncryptedCredentialStore(filePath, cipher());

    await store.save('lms-secret-token');

    await expect(store.exists()).resolves.toBe(true);
    expect(await readFile(filePath, 'utf8')).not.toContain('lms-secret-token');
    await expect(store.load()).resolves.toBe('lms-secret-token');
  });

  it('refuses persistence without protected OS storage', async () => {
    const store = new EncryptedCredentialStore(await temporaryFile(), cipher({ available: false }));
    await expect(store.save('lms-secret-token')).rejects.toThrow('unavailable');
  });

  it('rewrites ciphertext when the OS reports key rotation', async () => {
    const filePath = await temporaryFile();
    let encryptions = 0;
    const rotatingCipher: SecretCipher = {
      available: async () => true,
      encrypt: async (value) => {
        encryptions += 1;
        return Buffer.from(`encrypted:${Array.from(value).reverse().join('')}`);
      },
      decrypt: async (value) => ({
        result: value
          .toString()
          .replace(/^encrypted:/, '')
          .split('')
          .reverse()
          .join(''),
        shouldReEncrypt: true,
      }),
    };
    const store = new EncryptedCredentialStore(filePath, rotatingCipher);
    await store.save('lms-secret-token');

    await expect(store.load()).resolves.toBe('lms-secret-token');
    expect(encryptions).toBe(2);
  });

  it('rejects malformed storage and clears configured credentials', async () => {
    const filePath = await temporaryFile();
    const store = new EncryptedCredentialStore(filePath, cipher());
    await writeFile(filePath, '{"version":1,"ciphertext":"***"}', 'utf8');
    await expect(store.load()).rejects.toThrow('Malformed');
    await store.clear();
    await expect(store.exists()).resolves.toBe(false);
    await expect(store.load()).resolves.toBeNull();
  });
});
