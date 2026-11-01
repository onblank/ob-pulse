import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface SecretCipher {
  available(): Promise<boolean>;
  encrypt(value: string): Promise<Buffer>;
  decrypt(value: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
}

interface StoredCredential {
  readonly version: 1;
  readonly ciphertext: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedCredential(value: unknown): StoredCredential {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !['version', 'ciphertext'].includes(key))
  )
    throw new Error('Malformed encrypted credential');
  if (value.version !== 1 || typeof value.ciphertext !== 'string')
    throw new Error('Malformed encrypted credential');
  if (
    value.ciphertext.length === 0 ||
    value.ciphertext.length > 16_384 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value.ciphertext)
  )
    throw new Error('Malformed encrypted credential');
  return { version: 1, ciphertext: value.ciphertext };
}

function missingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

export function validApiToken(value: unknown): string {
  if (typeof value !== 'string') throw new Error('LM Studio API token must be a string');
  const token = value.trim();
  if (
    token.length === 0 ||
    token.length > 4096 ||
    Array.from(token).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x20 || code === 0x7f;
    })
  )
    throw new Error('Invalid LM Studio API token');
  return token;
}

export class EncryptedCredentialStore {
  constructor(
    private readonly filePath: string,
    private readonly cipher: SecretCipher,
  ) {}

  available(): Promise<boolean> {
    return this.cipher.available();
  }

  async exists(): Promise<boolean> {
    try {
      await access(this.filePath);
      return true;
    } catch (error) {
      if (missingFile(error)) return false;
      throw error;
    }
  }

  async load(): Promise<string | null> {
    let serialized: string;
    try {
      serialized = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (missingFile(error)) return null;
      throw error;
    }
    if (!(await this.cipher.available()))
      throw new Error('Secure credential storage is unavailable');
    const stored = storedCredential(JSON.parse(serialized));
    const decrypted = await this.cipher.decrypt(Buffer.from(stored.ciphertext, 'base64'));
    const token = validApiToken(decrypted.result);
    if (decrypted.shouldReEncrypt) await this.save(token);
    return token;
  }

  async save(value: unknown): Promise<void> {
    const token = validApiToken(value);
    if (!(await this.cipher.available()))
      throw new Error('Secure credential storage is unavailable');
    const encrypted = await this.cipher.encrypt(token);
    const stored: StoredCredential = { version: 1, ciphertext: encrypted.toString('base64') };
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(stored, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
      await rename(temporaryPath, this.filePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}
