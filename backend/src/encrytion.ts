import blake2 from 'blake2'
import crypto from 'crypto'
import argon2 from 'argon2'
import sodium from 'sodium-native'
import { ons } from './index.js'

export function hash(input) {
  return blake2.createHash('blake2b', { digestLength: 32 })
    .update(Buffer.from(input))
    .digest('base64')
}

function decryptWithKey(messageWithNonce: string, keyUint8Array: Buffer) {
  const messageWithNonceAsUint8Array = Buffer.from(messageWithNonce, 'hex')
  const nonce = messageWithNonceAsUint8Array.subarray(messageWithNonceAsUint8Array.length - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const message = messageWithNonceAsUint8Array.subarray(
    0,
    messageWithNonceAsUint8Array.length - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
  )

  const decBuffer = Buffer.alloc(message.byteLength - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    decBuffer,
    null,
    message,
    null,
    nonce,
    keyUint8Array
  )

  return decBuffer.toString('hex')
}

export function decryptONSValue(value: string, unhashedName: string) {
  const generateKey = (unhashed: string) => {
    const key = blake2.createHash('blake2b', { digestLength: 32 })
      .update(Buffer.from(unhashed))
      .digest()
    return blake2.createKeyedHash('blake2b', key, { digestLength: 32 })
      .update(Buffer.from(unhashed))
      .digest()
  }
  return decryptWithKey(value, generateKey(unhashedName))
}

export async function dehash(hash: string): Promise<string | null> {
  const dehashed = await ons.get<{ hash: string, string: string }>('SELECT * FROM hashes WHERE hash = (?)', hash)
  if (dehashed) {
    return dehashed.string
  } else {
    return null
  }
}