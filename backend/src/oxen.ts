import fs from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { ons } from './index.js'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { decryptONSValue } from './encryption.js'
import { unhash } from './utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

async function openConfig() {
  const configPath = __dirname + '../db/config.json'
  try {
    await fs.access(configPath)
  } catch {
    const newConfig = { currentBlock: 0 }
    await fs.writeFile(configPath, JSON.stringify(newConfig))
    return newConfig
  }
  return JSON.parse(await fs.readFile(configPath, 'utf-8')) as { currentBlock: number }
}

const config = await openConfig()

type BlockHeader = {
  hash: string
  num_txes: number
  height: number
}

type OnsExtra = {
  ons: {
    name_hash: string
    owner?: string
    blocks?: true
    backup_owner?: string
    type: 'session' | 'lokinet' | 'wallet'
    update?: true
    buy?: true
    renew?: true
    value: string
  }
  payment_id?: string
  pubkey?: string
}

type OnsRecord = {
  name_hash: string
  owner?: string
  backup_owner?: string
  type: 'session' | 'lokinet' | 'wallet'
  value: string
  transaction_id: string
  updated_at_block: number
  expires_at_block?: number
  action?: 'update' | 'buy' | 'renew'
}

export async function sync() {
  const blocks = await fetch('http://public-eu.optf.ngo:22023/json_rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '0', method: 'get_block_count', params: {} })
  })
    .then(req => req.json()) as { result: { count: number } }
  const latestBlock = blocks.result.count - 1
  const currentBlock = config.currentBlock
  if(currentBlock !== latestBlock) {
    console.log(`Syncing from block ${currentBlock} to ${latestBlock}`)

    const totalNumber = latestBlock - currentBlock
    const batchSize = 2500
    const blocks: BlockHeader[] = []
    for (let i = 1; i <= totalNumber; i += batchSize) {
      const blocksChunk = await fetch('http://public-eu.optf.ngo:22023/json_rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jsonrpc: '2.0', 
          id: '0', 
          method: 'get_block_headers_range', 
          params: {
            start_height: currentBlock + i,
            end_height: Math.min(currentBlock + i + batchSize - 1, latestBlock)
          }
        })
      })
        .then(req => req.json()) as { result: { headers: BlockHeader[] } }
      blocks.push(
        ...blocksChunk.result.headers
          .filter(block => block.num_txes > 0)
      )
    }
    console.log(`Found ${blocks.length} blocks with transactions`)

    const transactions: string[] = []
    for(let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      console.log(`Fetching block ${i+1}/${blocks.length} (${block.height}) ${block.hash}`)
      const blockInfo = await fetch('http://public-eu.optf.ngo:22023/json_rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '0',
          method: 'get_block',
          params: {
            height: block.height
          }
        })
      })
        .then(req => req.json()) as { result: { tx_hashes: string[] } }
      transactions.push(...blockInfo.result.tx_hashes)
    }
    console.log(`Found ${transactions.length} transactions`)

    if (transactions.length > 0) {

      const transactionsInfo = await fetch('http://public-eu.optf.ngo:22023/get_transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txs_hashes: transactions,
          tx_extra: true
        })
      })
        .then(req => req.json()) as { txs: { extra: object, tx_hash: string, block_height: number }[] }
      
      const onsRelatedTransactions = transactionsInfo.txs
        .filter(tx => 'extra' in tx && 'ons' in tx.extra)
        .map(tx => {
          const extra = tx.extra as OnsExtra
          return {
            name_hash: Buffer.from(extra.ons.name_hash, 'hex').toString('base64'),
            owner: extra.ons.owner,
            backup_owner: extra.ons.backup_owner,
            type: extra.ons.type,
            value: extra.ons.value,
            transaction_id: tx.tx_hash,
            action: ('buy' in extra.ons 
              ? 'buy' 
              : 'update' in extra.ons 
                ? 'update' 
                : 'renew') as 'buy' | 'update' | 'renew',
            updated_at_block: tx.block_height,
            ...('blocks' in extra && typeof extra.blocks === 'number' && { 
              expires_at_block: tx.block_height + extra.blocks 
            }),
          }
        })
      console.log('Filtered', onsRelatedTransactions.length, 'transactions related to ONS')
      await appendOnsRecords(onsRelatedTransactions)
    }

    await fs.writeFile(__dirname + '../db/config.json', JSON.stringify({ currentBlock: latestBlock + 1 }), 'utf-8')
  } else {
    console.log('Up to date!')
  }
}

async function appendOnsRecords(onsRecord: OnsRecord[]) {
  console.log('Appending', onsRecord.length, 'ONS records')
  for(const record of onsRecord) {
    const unhashedName = await unhash(record.name_hash)
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

/** Use when need to migrate ons.db from oxend to backend ons.db */
async function migrateOnsDb(pathToOnsDb: string) {
  const onsDb = await open({
    filename: pathToOnsDb,
    driver: sqlite3.Database
  })
  const rows = await onsDb.all('SELECT * FROM mappings')
  const onsRecords: OnsRecord[] = []
  for(const row of rows) {
    const owner = await onsDb.get('SELECT address FROM owner WHERE id = (?)', row.owner_id) as { address: Buffer }
    let backupOwner: { address: Buffer } | undefined
    if (row.backup_owner) {
      backupOwner = await onsDb.get('SELECT address FROM owner WHERE id = (?)', row.backup_owner) as { address: Buffer }
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

  await appendOnsRecords(onsRecords)
}

/** Use when need to add unhashed_name and decrypted_value columns */
async function migrateHashedNamesAndEncryptedValues() {

}