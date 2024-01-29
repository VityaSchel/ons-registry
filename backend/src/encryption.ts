import blake2 from 'blake2'
import sodium from 'sodium-native'

const ED25519_PUBLIC_KEY_LENGTH = 32
const SESSION_PUBLIC_KEY_BINARY_LENGTH = 1 + ED25519_PUBLIC_KEY_LENGTH

export function hash(input) {
  return blake2.createHash('blake2b', { digestLength: 32 })
    .update(Buffer.from(input))
    .digest('base64')
}

function decryptXChachaWithKey(message: Buffer, nonce: Buffer, key: Buffer) {
  const decBuffer = Buffer.alloc(message.byteLength - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    decBuffer,
    null,
    message,
    null,
    nonce,
    key
  )
  return decBuffer.toString('hex')
}

function decryptSecretboxWithKey(message: Buffer, nonce: Buffer, key: Buffer) {
  const decBuffer = Buffer.alloc(message.byteLength - sodium.crypto_secretbox_MACBYTES)
  if(!sodium.crypto_secretbox_open_easy(
    decBuffer,
    message,
    nonce,
    key
  )) {
    throw new Error('could not verify data')
  } else {
    return decBuffer.toString('hex')
  }
}

function generateKey(unhashedName: string, algorithm: 'blake2b' | 'argon2id13') {
  if (algorithm === 'blake2b') {
    const key = blake2.createHash('blake2b', { digestLength: 32 })
      .update(Buffer.from(unhashedName))
      .digest()
    return blake2.createKeyedHash('blake2b', key, { digestLength: 32 })
      .update(Buffer.from(unhashedName))
      .digest()
  } else {
    const out = Buffer.alloc(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES)
    const OLD_ENC_SALT = Buffer.alloc(sodium.crypto_pwhash_SALTBYTES)
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
    return [encryptedValue, Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES)]
  } else {
    const messageLength = encryptedValue.length - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
    const nonce = encryptedValue.subarray(messageLength)
    const message = encryptedValue.subarray(0, messageLength)
    return [message, nonce]
  }
}

export function decryptONSValue(value: string, unhashedName: string) {
  const encryptedValue = Buffer.from(value, 'hex')
  const legacyFormat = encryptedValue.length === SESSION_PUBLIC_KEY_BINARY_LENGTH + sodium.crypto_secretbox_MACBYTES
  try {
    const key = generateKey(unhashedName, legacyFormat ? 'argon2id13' : 'blake2b')
    const [message, nonce] = splitEncryptedValue(encryptedValue, legacyFormat)
    if(legacyFormat) {
      return decryptSecretboxWithKey(message, nonce, key)
    } else {
      return decryptXChachaWithKey(message, nonce, key)
    }
  } catch(e) {
    if (e.message === 'could not verify data') {
      return null
    } else {
      throw e
    }
  }
}