import argon2 from 'argon2-browser'

const crypto_pwhash_SALTBYTES = 16
const crypto_pwhash_MEMLIMIT_MODERATE = 268435456
const crypto_pwhash_OPSLIMIT_MODERATE = 3
const crypto_aead_xchacha20poly1305_ietf_KEYBYTES = 32

self.addEventListener('message', async event => {
  if(typeof event.data === 'object' && event.data.type === 'hash' && 'plain' in event.data) {
    const OLD_ENC_SALT = new Uint8Array(crypto_pwhash_SALTBYTES)
    const result = await argon2.hash({
      pass: event.data.plain,
      salt: OLD_ENC_SALT,
      time: crypto_pwhash_OPSLIMIT_MODERATE,
      mem: crypto_pwhash_MEMLIMIT_MODERATE / 1024,
      hashLen: crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
      parallelism: 1,
      type: argon2.ArgonType.Argon2id
    })
    self.postMessage({ type: 'hash_result', hash: result })
  }
})