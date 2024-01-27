export type OnsMapping = {
  name_hash: string
  owner: string
  backup_owner: string
  type: 'session' | 'wallet' | 'lokinet'
  value: string
  transaction_id: string
  action: 'create' | 'update' | 'delete' | null
  updated_at_block: number
  expires_at_block: number
}