import { uint8arrayToBase64 } from '@/shared/utils'
import blake2 from 'blake2b'
import sodiumAead from 'sodium-javascript/crypto_aead'
import sodiumSecretbox from 'sodium-javascript/crypto_secretbox'
import sodiumSecretbox from 'sodium-javascript/crypto_hash'

export async function hash(input: string) {
  const enc = new TextEncoder()
  return await uint8arrayToBase64(blake2(32)
    .update(enc.encode(input))
    .digest('binary'))
}

const ED25519_PUBLIC_KEY_LENGTH = 32
const SESSION_PUBLIC_KEY_BINARY_LENGTH = 1 + ED25519_PUBLIC_KEY_LENGTH
function decryptXChachaWithKey(message: Uint8Array, nonce: Uint8Array, key: Uint8Array) {
  const decBuffer = Buffer.alloc(message.byteLength - sodiumAead.crypto_aead_chacha20poly1305_ietf_ABYTES)
  sodiumAead.crypto_aead_chacha20poly1305_ietf_decrypt(
    decBuffer,
    null,
    message,
    null,
    nonce,
    key
  )
  return decBuffer.toString('hex')
}

function decryptSecretboxWithKey(message: Uint8Array, nonce: Uint8Array, key: Uint8Array) {
  const decBuffer = new Uint8Array(message.byteLength - sodiumSecretbox.crypto_secretbox_MACBYTES)
  if (!sodiumSecretbox.crypto_secretbox_open_easy(
    decBuffer,
    message,
    nonce,
    key
  )) {
    throw new Error('could not verify data')
  } else {
    return decBuffer
  }
}

function generateKey(unhashedName: string, algorithm: 'blake2b' | 'argon2id13') {
  const enc = new TextEncoder()
  if (algorithm === 'blake2b') {
    const key = blake2(32)
      .update(enc.encode(unhashedName))
      .digest()
    return blake2(32, key)
      .update(enc.encode(unhashedName))
      .digest()
  } else {
    const out = new Uint8Array(sodiumAead.crypto_aead_chacha20poly1305_ietf_KEYBYTES)
    const OLD_ENC_SALT = new Uint8Array(sodium.crypto_pwhash_SALTBYTES)
    sodium.crypto_pwhash(
      out,
      Buffer.from(unhashedName),
      OLD_ENC_SALT,
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_MODERATE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    )
    return out
  }
}

function splitEncryptedValue(encryptedValue: Buffer, legacyFormat: boolean): [Buffer, Buffer] {
  if (legacyFormat) {
    return [encryptedValue, Buffer.alloc(sodiumSecretbox.crypto_secretbox_NONCEBYTES)]
  } else {
    const messageLength = encryptedValue.length - sodiumAead.crypto_aead_chacha20poly1305_ietf_NPUBBYTES
    const nonce = encryptedValue.subarray(messageLength)
    const message = encryptedValue.subarray(0, messageLength)
    return [message, nonce]
  }
}

export function decryptONSValue(value: string, unhashedName: string) {
  const encryptedValue = Buffer.from(value, 'hex')
  const legacyFormat = encryptedValue.length === SESSION_PUBLIC_KEY_BINARY_LENGTH + sodiumSecretbox.crypto_secretbox_MACBYTES
  try {
    const key = generateKey(unhashedName, legacyFormat ? 'argon2id13' : 'blake2b')
    const [message, nonce] = splitEncryptedValue(encryptedValue, legacyFormat)
    if (legacyFormat) {
      return decryptSecretboxWithKey(message, nonce, key)
    } else {
      return decryptXChachaWithKey(message, nonce, key)
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'could not verify data') {
      return null
    } else {
      throw e
    }
  }
}