// AES-256-GCM for the stored Garmin API key. The user id is bound as additional data,
// so a ciphertext copied to another user's row does not decrypt.
// Secret: GARMIN_ENC_KEY = 32 random bytes, base64 (e.g. `openssl rand -base64 32`).

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function importKey(secretB64: string): Promise<CryptoKey> {
  const raw = unb64(secretB64)
  if (raw.length !== 32) throw new Error('GARMIN_ENC_KEY must be 32 bytes, base64 encoded.')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encrypt(plain: string, userId: string, secretB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
    await importKey(secretB64),
    new TextEncoder().encode(plain),
  )
  return `${b64(iv)}.${b64(new Uint8Array(ct))}`
}

export async function decrypt(stored: string, userId: string, secretB64: string): Promise<string> {
  const [iv, ct] = stored.split('.')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv), additionalData: new TextEncoder().encode(userId) },
    await importKey(secretB64),
    unb64(ct),
  )
  return new TextDecoder().decode(plain)
}
