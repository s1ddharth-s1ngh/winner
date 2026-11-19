// AES-256-GCM for the stored Garmin API key. The user id is bound as additional data,
// so a ciphertext copied to another user's row does not decrypt.
// Secret: GARMIN_ENC_KEY = any random string of 32+ characters; the AES key is its SHA-256.

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function importKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('GARMIN_ENC_KEY must be at least 32 characters.')
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encrypt(plain: string, userId: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
    await importKey(secret),
    new TextEncoder().encode(plain),
  )
  return `${b64(iv)}.${b64(new Uint8Array(ct))}`
}

export async function decrypt(stored: string, userId: string, secret: string): Promise<string> {
  const [iv, ct] = stored.split('.')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv), additionalData: new TextEncoder().encode(userId) },
    await importKey(secret),
    unb64(ct),
  )
  return new TextDecoder().decode(plain)
}
