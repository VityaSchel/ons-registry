import { OnsRecord } from '@/shared/model/ons-record'
import { store } from '@/shared/store'

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
export async function fetchList(options: { query?: string, offset?: number, limit?: number, type?: string, sort_by?: string, sort_dir?: string }, fetchOptions?: { signal: AbortSignal }) {
  await awaitCacheInitialization()
  const state = store.getState().searchStorage
  if (state.searchStorageType === 'local' && state.searchStorageData) {
    let mappings = state.searchStorageData.mappings
    if(options.query) {
      const query = options.query.toLowerCase()
      mappings = mappings.filter(mapping => {
        return Object.values(mapping).some(value => {
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query)
          } else {
            return false
          }
        })
      })
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
    // TODO: add hashing and check if name_hash matches and send server request
    const mappings = state.searchStorageData.mappings.filter(mapping => mapping.name === name)
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