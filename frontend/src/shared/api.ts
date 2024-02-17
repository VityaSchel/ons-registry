import { decryptONSValue, hash } from '@/shared/encryption'
import { OnsRecord } from '@/shared/model/ons-record'
import { store } from '@/shared/store'
import { matchFound } from '@/shared/store/slices/search-storage'

async function awaitCacheInitialization() {
  if (store.getState().searchStorage.searchStorageType === 'initializing') {
    await new Promise(resolve => {
      const unsubscribe = store.subscribe(() => {
        if (store.getState().searchStorage.searchStorageType !== 'initializing') {
          resolve(undefined)
          unsubscribe()
        }
      })
    })
  }
}

type FetchListResponse = { ok: true, mappings: OnsRecord[], total: number } | { ok: false, error: string }
export async function fetchList(options: { query?: string, offset?: number, limit?: number, owner?: string, type?: string, sort_by?: string, sort_dir?: string }, fetchOptions?: { signal: AbortSignal }) {
  await awaitCacheInitialization()
  const state = store.getState().searchStorage
  if (state.searchStorageType === 'local' && state.searchStorageData) {
    let mappings = state.searchStorageData.mappings
    if(options.query) {
      const query = options.query.toLowerCase()
      mappings = mappings.filter(mapping => mapping.name && mapping.name.toLowerCase().includes(query))
    }
    if (options.owner) {
      if (options.owner.length === 160) {
        mappings = mappings.filter(mapping => mapping.owner.keypair === options.owner || mapping.backupOwner.keypair === options.owner)
      } else {
        mappings = mappings.filter(mapping => mapping.owner.oxen === options.owner || mapping.backupOwner.oxen === options.owner)
      }
    }
    if (options.sort_by) {
      mappings.sort((a, b) => {
        if (options.sort_dir === 'asc') {
          // @ts-expect-error ...
          return a[options.sort_by] > b[options.sort_by] ? 1 : -1
        } else {
          // @ts-expect-error ...
          return a[options.sort_by] < b[options.sort_by] ? 1 : -1
        }
      })
    }
    return { 
      ok: true, 
      ...(options.offset ?
        options.limit ? {
          mappings: mappings.slice(options.offset, options.offset + options.limit),
        } : {
          mappings: mappings.slice(options.offset)
        } : {
          mappings: mappings.slice(0, options.limit)
        }
      ),
      total: mappings.length 
    } as FetchListResponse
  } else {
    return await fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
      limit: String(options.limit),
      ...(options.offset && { offset: String(options.offset) }),
      ...(options.query && { query: options.query }),
      ...(options.owner && { owner: options.owner }),
      ...(options.type && { type: options.type }),
      ...(options.sort_by && { sort_by: options.sort_by }),
      ...(options.sort_dir && { sort_dir: options.sort_dir })
    }), { signal: fetchOptions?.signal })
      .then(res => res.json()) as FetchListResponse
  }
}

type FetchRecordResponse = { ok: true, mappings: OnsRecord[], total: number } | { ok: false, error: string }

export async function fetchRecord(name: string, fetchOptions?: { signal: AbortSignal }) {
  await awaitCacheInitialization()
  const state = store.getState().searchStorage
  if (state.searchStorageType === 'local' && state.searchStorageData) {
    let mappings = state.searchStorageData.mappings.filter(mapping => mapping.name === name)
    if (mappings.length === 0) {
      const hashedName = await hash(name)
      mappings = state.searchStorageData.mappings.filter(mapping => mapping.nameHash === hashedName)
      if(mappings.length > 0) {
        console.log('New match found :O', mappings)
        mappings = mappings.map(r => ({ ...r, name }))
        const encryptedMappings = mappings
          .filter(r => r.sessionIdEncrypted)
          .map(r => r.sessionIdEncrypted as string)
        const decryptedMappings = new Map<string, string>()
        for (const encryptedValue of encryptedMappings) {
          const decryptedValue = await decryptONSValue(encryptedValue, name)
          if (decryptedValue) {
            decryptedMappings.set(encryptedValue, decryptedValue)
          }
        }
        store.dispatch(matchFound({ hash: hashedName, name, decryptedMappings }))
        mappings = mappings.map(r => ({ 
          ...r, 
          name, 
          sessionId: decryptedMappings.get(r.sessionIdEncrypted as string) || null
        }))
      }
    }
    return {
      ok: true,
      mappings: mappings,
      total: mappings.length
    } as FetchRecordResponse
  } else {
    return await fetch(process.env.NEXT_PUBLIC_API_URL + '/session/' + name, { signal: fetchOptions?.signal })
      .then(res => res.json()) as FetchRecordResponse
  }
}