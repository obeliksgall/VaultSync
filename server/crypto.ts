import crypto from 'crypto';

export interface EncryptedPayload {
  version: number;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
  exportedAt: string;
}

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
const DIGEST = 'sha512';

export function encryptConfiguration(plainData: object, passwordPlain: string): EncryptedPayload {
  if (!passwordPlain || passwordPlain.length < 9) {
    throw new Error('Hasło szyfrowania konfiguracji musi mieć co najmniej 9 znaków.');
  }

  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(passwordPlain, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const jsonStr = JSON.stringify(plainData);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted,
    exportedAt: new Date().toISOString(),
  };
}

export function decryptConfiguration(rawPayload: any, passwordPlain: string): any {
  if (!rawPayload) {
    throw new Error('Brak danych pliku konfiguracji.');
  }

  let payload: EncryptedPayload;
  if (typeof rawPayload === 'string') {
    try {
      payload = JSON.parse(rawPayload.trim());
    } catch {
      throw new Error('Nieprawidłowy format pliku zaszyfrowanej konfiguracji (plik nie jest poprawnym formatem JSON).');
    }
  } else {
    payload = rawPayload;
  }

  // Support if payload is wrapped inside { package: ... }
  if ((payload as any).package && typeof (payload as any).package === 'object') {
    payload = (payload as any).package;
  }

  if (!payload || !payload.ciphertext || !payload.salt || !payload.iv || !payload.tag) {
    throw new Error('Nieprawidłowy format pliku zaszyfrowanej konfiguracji (brak wymaganych pól ciphertext, salt, iv lub tag).');
  }

  try {
    const salt = Buffer.from(payload.salt, 'hex');
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');
    const key = crypto.pbkdf2Sync(passwordPlain, salt, ITERATIONS, KEY_LENGTH, DIGEST);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (err: any) {
    if (err.message && err.message.includes('JSON')) {
      throw new Error('Odszyfrowana zawartość nie jest poprawnym obiektem konfiguracyjnym JSON.');
    }
    // Auth tag failure, wrong key, or tampering
    throw new Error('Błędne hasło deszyfrowania lub plik kopii zapasowej jest uszkodzony.');
  }
}
