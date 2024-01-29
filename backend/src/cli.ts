import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { OnsRecord } from './model.js'
import { appendOnsRecords } from './db.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { unhash } from './utils.js'
import { decryptONSValue } from './encryption.js'

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
    if (row.backup_owner) {
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

if(process.argv[2] === 'migrate') {
  if (!process.argv[3]) {
    console.error('Usage: node out/cli.js migrate <path_to_ons.db>')
    process.exit(1)
  }
  await migrateOnsDb(process.argv[3])
} else if(process.argv[2] === 'add_cleartext') {
  await migrateHashedNamesAndEncryptedValues()
} else {
  console.error('Usage: node out/cli.js migrate <path_to_ons.db> | node out/cli.js add_cleartext')
  process.exit(1)
}