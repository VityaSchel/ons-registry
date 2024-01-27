export type OnsRecord = {
  transactionId: string;
  updatedAtBlock: number;
  expiresAtBlock: number;
  action: 'create' | 'update' | 'delete' | null;
  sessionIdEncrypted?: string | undefined;
  owner: string;
  backupOwner: string;
  sessionId: string | null;
  nameHash?: string | undefined;
  name: string | null;
}