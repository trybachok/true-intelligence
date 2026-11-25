import { createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import bcrypt from 'bcrypt';

const deriveLegacyKey = promisify<string, string, number, Buffer>(scrypt);
const legacyHashPattern = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/;
const bcryptCost = 12;
const preHashPrefix = 'bcrypt-sha256:';
const bcryptHashPattern = /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const dummyHash =
  '$2b$12$yFmKapUO0g7fKuqVSqLgaOs3/j5OQl7YhwZW/lesUfz7IaMyi13L6';

function preHash(password: string): string {
  // A fixed-length input preserves the entire password within bcrypt's 72-byte limit.
  return createHash('sha256').update(password).digest('base64');
}

export async function hashPassword(password: string): Promise<string> {
  if (Buffer.byteLength(password) <= 72)
    return bcrypt.hash(password, bcryptCost);

  return preHashPrefix + (await bcrypt.hash(preHash(password), bcryptCost));
}

export async function verifyPassword(password: string, stored?: string) {
  const legacy = stored?.match(legacyHashPattern);
  // Check both formats on every attempt while the database contains legacy hashes.
  const legacyCandidate = await deriveLegacyKey(
    password,
    legacy?.[1] ?? 'dummy-account',
    64,
  );
  const usesPreHash = stored?.startsWith(preHashPrefix);
  const hash = usesPreHash ? stored?.slice(preHashPrefix.length) : stored;
  const usable =
    hash &&
    bcryptHashPattern.test(hash) &&
    (usesPreHash || Buffer.byteLength(password) <= 72);
  const input = usesPreHash ? preHash(password) : password;
  const matched = await bcrypt.compare(input, usable ? hash : dummyHash);
  if (legacy) {
    return {
      valid: timingSafeEqual(legacyCandidate, Buffer.from(legacy[2], 'hex')),
      legacy: true,
    };
  }

  return { valid: Boolean(usable) && matched, legacy: false };
}
