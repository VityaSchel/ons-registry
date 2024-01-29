export type OnsMapping = {
  name_hash: string
  unhashed_name: string | null
  owner: string
  backup_owner: string
  type: 'session' | 'wallet' | 'lokinet'
  value: string
  decrypted_value: string | null
  transaction_id: string
  action: 'create' | 'update' | 'delete' | null
  updated_at_block: number
  expires_at_block: number
}