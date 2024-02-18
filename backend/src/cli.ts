import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { OnsRecord } from './model.js'
import { appendOnsRecords } from './db.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { unhash } from './utils.js'
import { decryptONSValue } from './encryption.js'
import { OnsMapping } from './schema.js'
import { generateOwners, keypairToOxen, oxenToKeypair } from './monero-base58.js'
import fs from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'
const pathToOnsDb = __dirname + '../db/ons.db'

/** Use when need to migrate ons.db from oxend to backend ons.db */
async function migrateOnsDb(pathToOldDb: string) {
  const oldOnsDB = await open({
    filename: pathToOldDb,
    driver: sqlite3.Database
  })
  const rows = await oldOnsDB.all('SELECT * FROM mappings')
  const onsRecords: OnsRecord[] = []
  for (const row of rows) {
    const owner = await oldOnsDB.get('SELECT address FROM owner WHERE id = (?)', row.owner_id) as { address: Buffer }
    let backupOwner: { address: Buffer } | undefined
    if (row.backup_owner_id) {
      backupOwner = await oldOnsDB.get('SELECT address FROM owner WHERE id = (?)', row.backup_owner) as { address: Buffer }
    }
    const onsRecord = {
      name_hash: row.name_hash,
      type: ['session', 'wallet', 'lokinet'][row.type] as 'session' | 'wallet' | 'lokinet',
      value: row.encrypted_value.toString('hex'),
      owner: owner.address.toString('hex'),
      backup_owner: backupOwner ? backupOwner.address.toString('hex') : undefined,
      transaction_id: row.txid.toString('hex'),
      updated_at_block: row.update_height,
      expires_at_block: row.expiration_height ?? undefined,
      date: 0,
    } satisfies OnsRecord
    onsRecords.push(onsRecord)
  }

  const ons = await open({
    filename: pathToOnsDb,
    driver: sqlite3.Database
  })
  await appendOnsRecords(ons, onsRecords)
}

/** Use when need to add unhashed_name and decrypted_value columns */
async function migrateHashedNamesAndEncryptedValues() {
  const ons = await open({
    filename: pathToOnsDb,
    driver: sqlite3.Database
  })
  const rows = await ons.all<OnsRecord[]>('SELECT * FROM mappings WHERE type IS "session" AND unhashed_name IS NULL')
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    console.log('Processing', i + 1, '/', rows.length, row.name_hash)
    const unhashedName = await unhash(row.name_hash, ons)
    if (unhashedName === null) {
      console.log('Skipping because name_hash is not in hashes table')
      continue
    }
    ons.run('UPDATE mappings SET unhashed_name = ?, decrypted_value = ? WHERE name_hash = ?;', [
      unhashedName,
      decryptONSValue(row.value, unhashedName),
      row.name_hash,
    ])
  }
}

/** Use to generate hashes of all combinations of strings */
async function enrichRainbowTable() {
  // To calculate number of combinations:
  // (BigInt(36)*(BigInt(37)**(BigInt(LENGTH)-BigInt(2)))*BigInt(36)).toLocaleString()
  // where LENGTH is the MAX length of the string (it also counts all below)
  // There is 21933699727911487466966075301664254680425194110984302784931456773551261151469297401147661302393383824 combinations of all OXEN names
  const generateListOfStrings = (length: number) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz1234567890-'
    const strings: string[] = []
    const f = (prefix: string) => {
      if (prefix.length === length) {
        strings.push(prefix)
        return
      }
      for (const char of chars) {
        f(prefix + char)
      }
    }
    f('')
    return strings
      .filter(str => !(str.startsWith('-') || str.endsWith('-')))
  }
}

async function decryptValue(value: string, name: string) {
  console.log('Decrypted value:', decryptONSValue(value, name))
}

async function addOxenWalletsAndKeypairs() {
  const ons = await open({
    filename: __dirname + '../db/ons.db',
    driver: sqlite3.Database
  })
  const rows = await ons.all<OnsMapping[]>('SELECT * FROM mappings')
  for(let i = 0; i < rows.length; i++) {
    console.log(i+'/'+rows.length, Math.round(i / rows.length * 100) + '%')
    const row = rows[i]
    if(row.owner.length === 160) {
      const oxen = keypairToOxen(0x72, row.owner)
      await ons.run('UPDATE mappings SET owner_oxen = ? WHERE owner = ?', oxen, row.owner)
    } else if(row.owner.length === 95) {
      const keypair = oxenToKeypair(row.owner)
      await ons.run('UPDATE mappings SET owner = ?, owner_oxen = ? WHERE owner = ?', keypair, row.owner, row.owner)
    } else {
      throw new Error(row.owner)
    }
    if (row.backup_owner) {
      if(row.backup_owner.length === 160) {
        const oxen = keypairToOxen(0x72, row.owner)
        await ons.run('UPDATE mappings SET backup_owner_oxen = ? WHERE backup_owner = ?', oxen, row.backup_owner)
      } else if(row.owner.length === 95) {
        const keypair = oxenToKeypair(row.owner)
        await ons.run('UPDATE mappings SET backup_owner = ?, backup_owner_oxen = ? WHERE backup_owner = ?', keypair, row.backup_owner, row.backup_owner)
      } else {
        throw new Error(row.backup_owner)
      }
    }
  }
}

async function checkOxenWalletsAndKeypairs() {
  const ons = await open({
    filename: __dirname + '../db/ons.db',
    driver: sqlite3.Database
  })
  const rows = await ons.all<OnsMapping[]>('SELECT * FROM mappings')
  for(let i = 0; i < rows.length; i++) {
    console.log(i+'/'+rows.length, Math.round(i / rows.length * 100) + '%')
    const row = rows[i]
    if(row.owner.length === 160) {
      const oxen = keypairToOxen(0x72, row.owner)
      if(row.owner_oxen !== oxen) {
        throw new Error('Owner mismatch')
      }
    } else if(row.owner.length === 95) {
      const keypair = oxenToKeypair(row.owner)
      if(row.owner !== keypair) {
        throw new Error('Owner mismatch')
      }
    } else {
      throw new Error(row.owner)
    }
    if (row.backup_owner) {
      if(row.backup_owner.length === 160) {
        const oxen = keypairToOxen(0x72, row.owner)
        if(row.backup_owner_oxen !== oxen) {
          throw new Error('Backup owner mismatch')
        }
      } else if(row.owner.length === 95) {
        const keypair = oxenToKeypair(row.owner)
        if(row.backup_owner !== keypair) {
          throw new Error('Backup owner mismatch')
        }
      } else {
        throw new Error(row.backup_owner)
      }
    }
  }

}

async function fixBackupOwner(onsDbPath: string) {
  const onsSrc = await open({
    filename: onsDbPath,
    driver: sqlite3.Database
  })
  const ons = await open({
    filename: __dirname + '../db/ons.db',
    driver: sqlite3.Database
  })
  const rows = await onsSrc.all('SELECT * FROM mappings')
  for(let i = 0; i < rows.length; i++) {
    console.log(i+'/'+rows.length, Math.round(i / rows.length * 100) + '%')
    const row = rows[i]
    if(row.backup_owner_id) {
      const backupOwnerRow = await onsSrc.get('SELECT address FROM owner WHERE id = (?)', row.backup_owner_id)
      const backupOwner = backupOwnerRow.address.toString('hex')
      const owners = generateOwners(backupOwner)
      await ons.run('UPDATE mappings SET backup_owner = ?, backup_owner_oxen = ? WHERE name_hash = ?', owners.keypair, owners.oxen, row.name_hash)
    }
  }
}

async function fixEncryptedValues() {
  const ons = await open({
    filename: __dirname + '../db/ons.db',
    driver: sqlite3.Database
  })
  const rows = await ons.all<OnsMapping[]>('SELECT * FROM mappings WHERE decrypted_value=value AND unhashed_name IS NOT NULL')
  for (const row of rows) {
    const decrypted = decryptONSValue(row.value, row.unhashed_name as string)
    if (decrypted !== row.decrypted_value) {
      await ons.run('UPDATE mappings SET decrypted_value = ? WHERE name_hash = ?', decrypted, row.name_hash)
    }
  }
}

async function fixSwitchedValues() {
  const ons = await open({
    filename: __dirname + '../db/ons.db',
    driver: sqlite3.Database
  })
  const rows = await ons.all<OnsMapping[]>('SELECT * FROM mappings WHERE LENGTH(owner_oxen) = 160')
  for (const row of rows) {
    console.log('Repairing', row.name_hash, row.owner_oxen, row.backup_owner_oxen)
    await ons.run('UPDATE mappings SET owner = ?, owner_oxen = ? WHERE name_hash = ?', row.owner_oxen, row.owner, row.name_hash)
  }
  console.log('Repaired', rows.length, 'records')
}

async function addBlocksDates(blocksMappingsPath: string) {
  const mappings = await fs.readFile(blocksMappingsPath, 'utf-8')
  const ons = await open({
    filename: __dirname + '../db/ons.db',
    driver: sqlite3.Database
  })
  const blocks = JSON.parse(mappings)
  const rows = await ons.all<OnsMapping[]>('SELECT * FROM mappings')
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    console.log(i+'/'+rows.length, Math.round(i / rows.length * 100) + '%')
    if (!row.updated_at_block) {
      console.warn('Skipping', row.name_hash, 'because it has no updated_at_block')
      continue
    }
    const timestamp = blocks[row.updated_at_block]
    if(!timestamp) {
      console.warn('Skipping', row.updated_at_block, 'because it has no timestamp')
      continue
    }
    await ons.run('UPDATE mappings SET block_created_at = ? WHERE updated_at_block = ?', timestamp, row.updated_at_block)
  }
  console.log('Repaired', rows.length, 'records')
}

switch(process.argv[2]) {
  case 'migrate':
    if (!process.argv[3]) {
      console.error('Usage: node out/cli.js migrate <path_to_ons.db>')
      process.exit(1)
    }
    await migrateOnsDb(process.argv[3])
    break
  case 'add_cleartext':
    await migrateHashedNamesAndEncryptedValues()
    break
  case 'decrypt_value':
    await decryptValue(process.argv[3], process.argv[4])
    break
  case 'add_wallets_and_keypairs':
    await addOxenWalletsAndKeypairs()
    break
  case 'check_wallets_and_keypairs':
    await checkOxenWalletsAndKeypairs()
    break
  case 'fix_backup_owner':
    await fixBackupOwner(process.argv[3])
    break
  case 'fix_encrypted_values':
    await fixEncryptedValues()
    break
  case 'fix_switched_values':
    await fixSwitchedValues()
    break
  case 'add_blocks_dates':
    await addBlocksDates(process.argv[3])
    break
  default:
    console.error('Usage: node out/cli.js migrate <path_to_ons.db>\n | node out/cli.js add_cleartext\n | node out/cli.js decrypt_value <value> <name>\n | node out/cli.js add_wallets_and_keypairs\n | node out/cli.js check_wallets_and_keypairs\n | node out/cli.js fix_backup_owner <path_to_ons.db> \n | node out/cli.js fix_encrypted_values\n | node out/cli.js fix_switched_values\n | node out/cli.js add_blocks_dates <path_to_blocks_mappings.db>')
    process.exit(1)
}