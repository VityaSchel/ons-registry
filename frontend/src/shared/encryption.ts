import { uint8arrayToHex, uint8arrayToBase64, hexToUint8array } from '@/shared/utils'
import blake2 from 'blake2b'
import sodium from 'libsodium-wrappers'
import argon2 from 'argon2-browser'

export async function hash(input: string) {
  const enc = new TextEncoder()
  return await uint8arrayToBase64(blake2(32)
    .update(enc.encode(input))
    .digest('binary'))
}

const crypto_pwhash_SALTBYTES = 16
const crypto_pwhash_MEMLIMIT_MODERATE = 268435456
const crypto_pwhash_OPSLIMIT_MODERATE = 3

const ED25519_PUBLIC_KEY_LENGTH = 32
const SESSION_PUBLIC_KEY_BINARY_LENGTH = 1 + ED25519_PUBLIC_KEY_LENGTH
function decryptXChachaWithKey(message: Uint8Array, nonce: Uint8Array, key: Uint8Array) {
  const decBuffer = new Uint8Array(message.byteLength - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  const result = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    decBuffer,
    message,
    null,
    nonce,
    key
  )
  return uint8arrayToHex(result)
}

function decryptSecretboxWithKey(message: Uint8Array, nonce: Uint8Array, key: Uint8Array) {
  const result = sodium.crypto_secretbox_open_easy(
    message,
    nonce,
    key
  )
  return uint8arrayToHex(result)
}

async function generateKey(unhashedName: string, algorithm: 'blake2b' | 'argon2id13') {
  const enc = new TextEncoder()
  if (algorithm === 'blake2b') {
    const key = blake2(32)
      .update(enc.encode(unhashedName))
      .digest()
    return blake2(32, key)
      .update(enc.encode(unhashedName))
      .digest()
  } else {
    const OLD_ENC_SALT = new Uint8Array(crypto_pwhash_SALTBYTES)
    // const out = sodium.crypto_pwhash(
    //   sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    //   enc.encode(unhashedName),
    //   OLD_ENC_SALT,
    //   sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    //   sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    //   sodium.crypto_pwhash_ALG_ARGON2ID13
    // )
    const out = await argon2.hash({
      pass: unhashedName,
      salt: OLD_ENC_SALT,
      time: crypto_pwhash_OPSLIMIT_MODERATE,
      mem: crypto_pwhash_MEMLIMIT_MODERATE,
      hashLen: sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
      parallelism: 1,
      type: argon2.ArgonType.Argon2id
    })
    return out.hash
  }
}

function splitEncryptedValue(encryptedValue: Uint8Array, legacyFormat: boolean): [Uint8Array, Uint8Array] {
  if (legacyFormat) {
    return [encryptedValue, new Uint8Array(sodium.crypto_secretbox_NONCEBYTES)]
  } else {
    const messageLength = encryptedValue.length - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
    const nonce = encryptedValue.subarray(messageLength)
    const message = encryptedValue.subarray(0, messageLength)
    return [message, nonce]
  }
}

export async function decryptONSValue(value: string, unhashedName: string) {
  console.time('startEncrypting')
  const encryptedValue = hexToUint8array(value)
  const legacyFormat = encryptedValue.length === SESSION_PUBLIC_KEY_BINARY_LENGTH + sodium.crypto_secretbox_MACBYTES
  try {
    const key = await generateKey(unhashedName, legacyFormat ? 'argon2id13' : 'blake2b')
    console.log('key', uint8arrayToHex(key))
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