import { store } from '@/shared/store'
import { setSearchStorageData, setSearchStorageType } from '@/shared/store/slices/search-storage'
import { OnsRecord } from '@/shared/model/ons-record'

export async function fetchFullListForLocalUse() {
  try {
    const cachedList = await fetchAndCacheData(process.env.NEXT_PUBLIC_API_URL + '/list?limit=all')
    if (cachedList) {
      const cached = await cachedList.json() as { mappings: OnsRecord[], total: number }
      store.dispatch(setSearchStorageData(cached))
      const updatedAtDate = cachedList.headers.get('Date')
      console.log(cachedList.headers)
      store.dispatch(setSearchStorageType({ type: 'local', updatedAt: updatedAtDate ? new Date(updatedAtDate) : new Date() }))
    } else {
      store.dispatch(setSearchStorageType({ type: 'remote', updatedAt: new Date() }))
    }
  } catch (error) {
    console.error('Failed to fetch full list for local use', error)
  }
}

async function fetchAndCacheData(url: string) {
  const cache = await caches.open('ons-api-cache')
  const cachedResponse = await cache.match(url)

  const connection = navigator.connection
    || navigator.mozConnection
    || navigator.webkitConnection
  const shouldFetch =
    connection &&
    !connection.saveData &&
    connection.downlink !== undefined && 
    connection.downlink >= 2.0

  if (!shouldFetch) {
    if(cachedResponse) {
      return cachedResponse
    } else {
      return null
    }
  }

  const etag = cachedResponse?.headers.get('ETag')

  const fetchOptions = etag ? { headers: { 'If-None-Match': etag } } : {}

  try {
    const response = await fetch(url, fetchOptions)

    if (response.ok) {
      await cache.put(url, response.clone())
      return response
    } else if (response.status === 304 && cachedResponse) {
      return cachedResponse
    } else {
      throw new Error(await response.text())
    }
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse
    } else {
      throw error
    }
  }
}