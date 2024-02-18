import fs from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { ons } from './index.js'
import { BlockHeader, OnsExtra, OnsRecord } from './model.js'
import { appendOnsRecords } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const dryRun = false

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

export async function sync() {
  const config = await openConfig()
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
      const transactionsInfo: { 
        extra: object, 
        tx_hash: string, 
        block_height: number, 
        block_timestamp: number 
      }[] = []
      for(let txI = 0; txI < transactions.length; txI++) {
        const tx = transactions[txI]
        const transactionsResponse = await fetch('http://public-eu.optf.ngo:22023/get_transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txs_hashes: [tx],
            tx_extra: true
          })
        })
          .then(req => req.json()) as { txs: typeof transactionsInfo }
        console.log(`[${txI}/${transactions.length}] Fetched`, transactionsResponse.txs.length, 'transactions from txID', tx)
        transactionsInfo.push(...transactionsResponse.txs)
      }

      const onsRelatedTransactions: OnsRecord[] = transactionsInfo
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
            payment_id: extra.payment_id,
            date: tx.block_timestamp
          }
        })
      console.log('Filtered', onsRelatedTransactions.length, 'transactions related to ONS')
      if(dryRun) {
        console.log(onsRelatedTransactions)
      } else {
        await appendOnsRecords(ons, onsRelatedTransactions)
      }
    }

    await fs.writeFile(__dirname + '../db/config.json', JSON.stringify({ currentBlock: latestBlock + 1 }), 'utf-8')
  } else {
    console.log('Up to date!')
  }
}