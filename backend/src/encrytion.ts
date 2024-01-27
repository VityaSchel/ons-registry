import blake2 from 'blake2'
import crypto from 'crypto'
import argon2 from 'argon2'

export function hash(input) {
  return blake2.createHash('blake2b', { digestLength: 32 })
    .update(Buffer.from(input))
    .digest('base64')
}

export async function decryptValue(encryptedValue: string, hashedName: string, dehashedName: string) {
  async function deriveKey(unhashedName) {
    // const key = await argon2.hash(unhashedName, { salt: false, type: argon2.argon2id, timeCost: 3, memoryCost: 262144, hashLength: 32 });
    // const key = '979eb2570f50fdcde6a29735e65592bc6243cf1c5281e7333e630ffdfb29f4b0'
    // return Buffer.from(key, 'binary')
    const nonce = Buffer.alloc(12);
    const cipher = crypto.createCipheriv('chacha20', Buffer.from(hashedName), nonce);

    // Encrypt a dummy block to obtain the key stream
    const dummyBlock = Buffer.alloc(16, 0); // Use a dummy block of zeros
    const encryptedDummyBlock = cipher.update(dummyBlock);

    // Use the encrypted dummy block as the encryption key
    // encryptedDummyBlock.copy(out);
  }

  const key = await deriveKey(dehashedName)
  const nonce = Buffer.alloc(12)
  const encryptedData = Buffer.from(encryptedValue, 'hex')
  // const decipher = crypto.createDecipheriv('chacha20-poly1305', key, nonce)
  // const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()])
  return //decryptedData.toString('utf8')
}

// console.log(await decryptValue('71772d0deba03d42d84f5e7fe3e619eab6adf1809a03be32e9a546378647346069180213b360bd19e4931985770ba51c54bfa1d8c53a92357c0c170af90a743dc2b4960eff150ea407', 'hloth'))