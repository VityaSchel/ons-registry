export type OnsRecord = {
  transactionId: string;
  updatedAtBlock: number;
  expiresAtBlock: number;
  action: 'create' | 'update' | 'delete' | null;
  sessionIdEncrypted?: string | undefined;
  owner: { oxen: string, keypair: string }
  backupOwner: { oxen: string | null, keypair: string | null };
  sessionId: string | null;
  nameHash?: string | undefined;
  name: string | null;
  blockCreatedAt: string
}