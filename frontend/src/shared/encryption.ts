import { uint8arrayToHex, uint8arrayToBase64, hexToUint8array } from '@/shared/utils'
import blake2 from 'blake2b'
import sodium from 'libsodium-wrappers'

export async function hash(input: string) {
  const enc = new TextEncoder()
  return await uint8arrayToBase64(blake2(32)
    .update(enc.encode(input))
    .digest('binary'))
}

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

const hashChannel = new BroadcastChannel('sw-messages')
function generateKey(unhashedName: string, algorithm: 'blake2b' | 'argon2id13') {
  return new Promise<Uint8Array>(resolve => {
    const enc = new TextEncoder()
    if (algorithm === 'blake2b') {
      const key = blake2(32)
        .update(enc.encode(unhashedName))
        .digest()
      resolve(blake2(32, key)
        .update(enc.encode(unhashedName))
        .digest())
    } else {
      const sw = navigator.serviceWorker.controller
      if (!sw) return console.error('Service Worker not ready')
      sw.postMessage({ type: 'hash', plain: unhashedName })
      const subscription = (event: MessageEvent<{ type: 'hash_result', result: import('argon2-browser').Argon2BrowserHashResult, plain: string }>) => {
        if (
          typeof event.data === 'object' 
          && event.data.type === 'hash_result' 
          && 'result' in event.data
          && event.data.plain === unhashedName
        ) {
          hashChannel.removeEventListener('message', subscription)
          resolve(event.data.result.hash)
        }
      }
      hashChannel.addEventListener('message', subscription)
    }
  })
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
  const encryptedValue = hexToUint8array(value)
  const legacyFormat = encryptedValue.length === SESSION_PUBLIC_KEY_BINARY_LENGTH + sodium.crypto_secretbox_MACBYTES
  try {
    const key = await generateKey(unhashedName, legacyFormat ? 'argon2id13' : 'blake2b')
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