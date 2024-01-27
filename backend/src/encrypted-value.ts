import sodium from 'sodium-native'
import blake2 from 'blake2'

// Converted from:
// - oxen-core/src/oxen_economy.h,
// - oxen-core/src/cryptonote_core/oxen_name_system.cpp,
// - oxen-core/src/cryptonote_core/oxen_name_system.h

// Constants
enum mapping_type {
  session = 0,
    wallet = 1,
    lokinet = 2,  // the type value stored in the database; counts as 1-year when used in a buy tx.
    lokinet_2years,
    lokinet_5years,
    lokinet_10years,
    _count,
    update_record_internal,
}
const is_lokinet_type = (t: mapping_type): boolean => {
  return t >= mapping_type.lokinet && t <= mapping_type.lokinet_10years;
}
const OLD_ENCRYPTION_NONCE = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES, 0);
const isLokinetType = (type) => type === 'lokinet' || type === 'lokinet2';
const assert = (...args) => true
const SESSION_DISPLAY_NAME_MAX = 64;
const ed25519_public_key_length = 32
const SESSION_PUBLIC_KEY_BINARY_LENGTH = 1 + ed25519_public_key_length
const LOKINET_ADDRESS_BINARY_LENGTH = ed25519_public_key_length
const ONS_WALLET_TYPE_PRIMARY = 0x00;
const ONS_WALLET_TYPE_SUBADDRESS = 0x01;
const ONS_WALLET_TYPE_INTEGRATED = 0x02;

// Enums
const ons_sql_type = {
  save_owner: 0,
  save_setting: 1,
  save_mapping: 2,
  pruning: 3,
  get_sentinel_start: 4,
  get_mapping: 5,
  get_mappings: 6,
  get_mappings_by_owner: 7,
  get_mappings_by_owners: 8,
  get_mapping_counts: 9,
  get_owner: 10,
  get_setting: 11,
  get_sentinel_end: 12,
  internal_cmd: 13,
};

const ons_db_setting_column = {
  id: 0,
  top_height: 1,
  top_hash: 2,
  version: 3,
};

const owner_record_column = {
  id: 0,
  address: 1,
};

const mapping_record_column = {
  id: 0,
  type: 1,
  name_hash: 2,
  encrypted_value: 3,
  txid: 4,
  owner_id: 5,
  backup_owner_id: 6,
  update_height: 7,
  expiration_height: 8,
  _count: 9,
};

// Helper function for creating a Buffer from a string
function strToBuffer(str) {
  return Buffer.from(str, 'utf-8');
}

// Helper function for creating a string from a Buffer
function bufferToStr(buffer) {
  return buffer.toString('utf-8');
}

// MappingValue class
class MappingValue {
  buffer: Buffer
  len: number
  encrypted: boolean

  constructor(buffer: Buffer, len, encrypted) {
    this.buffer = buffer;
    this.len = len;
    this.encrypted = encrypted;
  }

  valueNonce(type) {
    let head, tail;
    head = this.buffer.slice(0, this.len);

    if (type === 'session' && this.len !== SESSION_PUBLIC_KEY_BINARY_LENGTH + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES + sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES ||
      this.len < sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES) {
      tail = OLD_ENCRYPTION_NONCE;
    } else {
      tail = head.slice(this.len - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      head = head.slice(0, this.len - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    }

    return [head, tail];
  }

  toReadableValue(nettype, type) {
    let result;

    if (isLokinetType(type)) {
      throw new Error('Lokinet ONS is not implemented')
      // result = toBase32z(this.toView()) + ".loki";
    } else if (type === 'wallet') {
      throw new Error('Wallet ONS is not implemented')
      // const addr = getWalletAddressInfo();
      // if (addr) {
      //   result = getAddressAsString(nettype, addr.isSubaddress, addr.address);
      // } else {
      //   result = toHex(this.toView());
      // }
    } else {
      result = this.buffer.toString('hex')
    }

    return result;
  }

  encrypt(name, nameHash, deprecatedHeavy = false) {
    assert(!this.encrypted);
    if (this.encrypted) {
      return false;
    }

    assert([...name].every(c => c.toLowerCase() === c)); // Assuming name is in lowercase

    const encryptionLen = this.len + (deprecatedHeavy ? sodium.crypto_secretbox_MACBYTES :
      sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES + sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

    if (encryptionLen > this.buffer.length) {
      console.error(`Encrypted value pre-allocated buffer too small=${this.buffer.length}, required=${encryptionLen}`);
      return false;
    }

    const encBuffer = Buffer.alloc(encryptionLen);
    const skey = new secretboxSecretKey();

    if (deprecatedHeavy) {
      if (nameToEncryptionKeyArgon2(name, skey)) {
        sodium.crypto_secretbox_easy(
          encBuffer, 
          this.buffer,
          // this.len, 
          OLD_ENCRYPTION_NONCE, 
          skey.data
        )
        this.encrypted = true;
      }
    } else {
      nameToEncryptionKey(name, nameHash, skey);
      const nonce = encBuffer.slice(encryptionLen - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

      sodium.randombytes_buf(nonce);

      sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        encBuffer,
        this.buffer,
        null,
        null,
        nonce,
        skey.data
      )
      this.encrypted = true;
    }

    if (this.encrypted) {
      this.len = encryptionLen;
      this.buffer = encBuffer;
    }

    return this.encrypted;
  }

  decrypt(name: string, type: 'session' | 'lokinet' | 'wallet', nameHash: string) {
    assert(this.encrypted);
    if (!this.encrypted) {
      return false;
    }

    assert([...name].every(c => c.toLowerCase() === c)); // Assuming name is in lowercase

    let decLength;
    let decBuffer;
    const skey = new secretboxSecretKey();

    switch (type) {
      case 'session':
        decLength = SESSION_PUBLIC_KEY_BINARY_LENGTH;
        break;
      case 'lokinet':
        decLength = LOKINET_ADDRESS_BINARY_LENGTH;
        break;
      case 'wallet':
        // if (this.len - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES -
        //   sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES === WALLET_ACCOUNT_BINARY_LENGTH_INC_PAYMENT_ID ||
        //   this.len - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES -
        //   sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES === WALLET_ACCOUNT_BINARY_LENGTH_NO_PAYMENT_ID) {
        //   decLength = this.len - sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES -
        //     sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
        // } else {
        //   console.error("Invalid wallet mapping_type length passed to MappingValue::decrypt");
        //   return false;
        // }
        throw new Error('Wallet ONS is not implemented')
        break;
      default:
        console.error("Invalid mapping_type passed to MappingValue::decrypt");
        return false;
    }

    const expectedLen = decLength + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES +
      sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
    if (this.len !== expectedLen) {
      console.error(`Encrypted value size is invalid=${this.len}, expected=${expectedLen}`);
      return false;
    }

    const [enc, nonce] = this.valueNonce(type);

    nameToEncryptionKey(name, nameHash, skey);
    const actualLength = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      Buffer.alloc(0), // was null
      enc,
      Buffer.alloc(0), // was null
      null,
      nonce,
      skey.data
    );

    this.encrypted = !(actualLength === decLength);

    if (!this.encrypted) {
      this.len = decLength;
      this.buffer = decBuffer;
    }

    return !this.encrypted;
  }

  makeEncrypted(name: string, nameHash: string, deprecatedHeavy: boolean) {
    const result = new MappingValue(this.buffer, this.len, this.encrypted);
    result.encrypt(name, nameHash, deprecatedHeavy);
    assert(result.encrypted);
    return result;
  }

  makeDecrypted(name: string, nameHash: string) {
    const result = new MappingValue(this.buffer, this.len, this.encrypted);
    result.encrypt(name, nameHash);
    assert(!result.encrypted);
    return result;
  }

  getWalletAddressInfo() {
    assert(!this.encrypted);
    if (this.encrypted) {
      return null;
    }

    const addrInfo = {
      address: {
        m_spend_public_key: Buffer.alloc(32),
        m_view_public_key: Buffer.alloc(32),
      },
      has_payment_id: false,
      is_subaddress: false,
      payment_id: Buffer.alloc(8),
    };

    let bufPos = this.buffer.slice(1);
    bufPos.copy(addrInfo.address.m_spend_public_key, 0, 0, 32);
    bufPos = bufPos.slice(32);
    bufPos.copy(addrInfo.address.m_view_public_key, 0, 0, 32);

    if (this.buffer[0] === ONS_WALLET_TYPE_INTEGRATED) {
      bufPos = bufPos.slice(32);
      bufPos.copy(addrInfo.payment_id, 0, 0, 8);
      addrInfo.has_payment_id = true;
    } else if (this.buffer[0] === ONS_WALLET_TYPE_SUBADDRESS) {
      addrInfo.is_subaddress = true;
    } else {
      assert(this.buffer[0] === ONS_WALLET_TYPE_PRIMARY);
    }

    return addrInfo;
  }
}

function nameToBase64Hash(name) {
  return blake2.createHash('blake2b', { digestLength: 32 })
    .update(Buffer.from(name))
    .digest('base64')
}

function nameToHash(name) {
  return blake2.createHash('blake2b', { digestLength: 32 })
    .update(Buffer.from(name))
    .digest('hex')
}

class secretboxSecretKey {
  data: Buffer

  constructor() {
    this.data = Buffer.alloc(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  }

  set(hash) {
    // assert(this.data.length === sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
    // assert(this.data.length === crypto.hash.size());
    hash.copy(this.data);
    return this;
  }
}

function nameToEncryptionKey(name, nameHash, out) {
  assert(out.data.length === sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);

  // const nameHash_ = nameHash ? nameHash : nameToHash(name);
  out.set(nameToHash(name/*, nameHash_)*/));
}

function nameToEncryptionKeyArgon2(name, out) {
  assert(out.data.length === sodium.crypto_secretbox_KEYBYTES);

  sodium.crypto_pwhash(
    out.data,
    Buffer.from(name),
    Buffer.alloc(0),
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  )
  return out.data.length !== 0
}

const buffer = Buffer.from('71772d0deba03d42d84f5e7fe3e619eab6adf1809a03be32e9a546378647346069180213b360bd19e4931985770ba51c54bfa1d8c53a92357c0c170af90a743dc2b4960eff150ea407', 'utf-8')
const len = buffer.length
const encrypted = false
const mappingValue = new MappingValue(buffer, len, encrypted)
mappingValue.decrypt('hloth', 'session', nameToBase64Hash('hloth'))
console.log(mappingValue.buffer.toString('utf-8'))