// import tweetnacl from 'tweetnacl'
// const { secretbox } = tweetnacl;
// import tweetnaclUtil from "tweetnacl-util";
// const {
//   decodeUTF8,
//   encodeUTF8,
//   encodeBase64,
//   decodeBase64
// } = tweetnaclUtil;
import sodium from 'sodium-native'
import blake2 from 'blake2'

const decrypt = (messageWithNonce: string, keyUint8Array: Buffer) => {
  const messageWithNonceAsUint8Array = Buffer.from(messageWithNonce, 'hex')
  const nonce = messageWithNonceAsUint8Array.subarray(messageWithNonceAsUint8Array.length - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const message = messageWithNonceAsUint8Array.subarray(
    0,
    messageWithNonceAsUint8Array.length - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
  )

  const decBuffer = Buffer.alloc(message.byteLength - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES)
  const actualLength = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    decBuffer,
    null,
    message,
    null,
    nonce,
    keyUint8Array
  )

  return decBuffer.toString('hex')
};

const generateKey = (unhashed: string) => {
  const key = blake2.createHash('blake2b', { digestLength: 32 })
    .update(Buffer.from(unhashed))
    .digest()
  return blake2.createKeyedHash('blake2b', key, { digestLength: 32 })
    .update(Buffer.from(unhashed))
    .digest()
}
