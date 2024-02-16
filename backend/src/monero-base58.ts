import moneroBase58 from 'base58-monero'
import keccak from 'keccak'

export function oxenToKeypair(oxen: string) {
  return moneroBase58.decode(oxen).subarray(1, -4).toString('hex') + Buffer.alloc(16).toString('hex')
}

enum Network {
  mainnet = 0x72
}

export function getChecksum(network: Network, data: Buffer) {
  return keccak('keccak256').update(Buffer.from([network])).update(data).digest().subarray(0, 4)
}

export function keypairToOxen(network: Network, keypair: string) {
  const publicKey = Buffer.from(keypair, 'hex').subarray(0, 64)
  return moneroBase58.encode(Buffer.concat([
    Buffer.from([network]), 
    publicKey,
    getChecksum(network, publicKey)
  ]))
}

export const generateOwners = (ownerString: string) => {
  if (ownerString.length === 160) {
    return { keypair: ownerString, oxen: keypairToOxen(0x72, ownerString) }
  } else {
    return { oxen: ownerString, keypair: oxenToKeypair(ownerString) }
  }
}