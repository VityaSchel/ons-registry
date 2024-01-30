import { decryptONSValue } from './encryption.js'
import { Db, OnsRecord } from './model.js'
import { unhash } from './utils.js'

export async function appendOnsRecords(ons: Db, onsRecord: OnsRecord[]) {
  console.log('Appending', onsRecord.length, 'ONS records')
  for (const record of onsRecord) {
    if (record.payment_id) {
      const exists = await checkIfExists(ons, record.name_hash, record.payment_id)
      if (exists) {
        console.log('Skipping', record.name_hash, 'because it is duplicate')
        continue
      }
    }
    const unhashedName = await unhash(record.name_hash, ons)
    const decryptedValue = unhashedName === null ? null : decryptONSValue(record.value, unhashedName)
    await ons.run(
      'INSERT INTO mappings (name_hash, unhashed_name, owner, backup_owner, type, value, decrypted_value, transaction_id, updated_at_block, expires_at_block, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      record.name_hash,
      unhashedName,
      record.owner,
      record.backup_owner,
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
  return await ons.run('SELECT * FROM mappings WHERE name_hash = ? AND payment_id = ?', [
    nameHash,
    paymentId
  ])
}