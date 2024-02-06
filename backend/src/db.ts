import { decryptONSValue } from './encryption.js'
import { Db, OnsRecord } from './model.js'
import { generateOwners } from './monero-base58.js'
import { OnsMapping } from './schema.js'
import { unhash } from './utils.js'

export async function appendOnsRecords(ons: Db, onsRecord: OnsRecord[]) {
  console.log('Appending', onsRecord.length, 'ONS records')
  for (const record of onsRecord) {
    if (record.payment_id) {
      const exists = await checkIfExists(ons, record.name_hash, record.payment_id)
      if (exists) {
        console.log('Skipping', record.name_hash, 'because it is duplicate with payment_id', record.payment_id)
        continue
      }
    }
    const unhashedName = await unhash(record.name_hash, ons)
    const decryptedValue = unhashedName === null ? null : decryptONSValue(record.value, unhashedName)
    let owners: { keypair: string | null, oxen: string | null } = { keypair: null, oxen: null }
    let backupOwners: { keypair: string | null, oxen: string | null } = { keypair: null, oxen: null }
    if(record.action === 'update' && !record.owner) {
      const existingMapping = await ons.get<OnsMapping>('SELECT * FROM mappings WHERE name_hash = ?', record.name_hash)
      if (existingMapping) {
        owners = { keypair: existingMapping.owner, oxen: existingMapping.owner_oxen }
      }
    } else if (record.owner) {
      owners = generateOwners(record.owner)
    }
    if(record.action === 'update' && !record.backup_owner) {
      const existingMapping = await ons.get<OnsMapping>('SELECT * FROM mappings WHERE name_hash = ?', record.name_hash)
      if (existingMapping) {
        backupOwners = { keypair: existingMapping.backup_owner, oxen: existingMapping.backup_owner_oxen }
      }
    } else if (record.backup_owner) {
      backupOwners = generateOwners(record.backup_owner)
    }
    await ons.run(
      'INSERT INTO mappings (name_hash, unhashed_name, owner, owner_oxen, backup_owner, backup_owner_oxen, type, value, decrypted_value, transaction_id, updated_at_block, expires_at_block, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      record.name_hash,
      unhashedName,
      owners.keypair,
      owners.oxen,
      backupOwners.keypair,
      backupOwners.oxen,
      record.type,
      record.value,
      decryptedValue,
      record.transaction_id,
      record.updated_at_block,
      record.expires_at_block,
      record.action
    )
  }
  console.log('Finished adding', onsRecord.length, 'ONS records')
}

async function checkIfExists(ons: Db, nameHash: string, paymentId: string) {
  return await ons.get('SELECT * FROM mappings WHERE name_hash = ? AND payment_id = ? AND payment_id IS NOT NULL', [
    nameHash,
    paymentId
  ])
}