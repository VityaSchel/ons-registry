import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'
import { OnsRecord } from '@/shared/model/ons-record'

interface SearchStorageState {
  searchStorageType: 'initializing' | 'local' | 'remote'
  searchStorageData: { mappings: OnsRecord[], total: number } | null
  searchStorageLastUpdate: number | null
}

const initialState: SearchStorageState = {
  searchStorageType: 'initializing',
  searchStorageData: null,
  searchStorageLastUpdate: null
}

export const counterSlice = createSlice({
  name: 'searchStorage',
  initialState,
  reducers: {
    setSearchStorageType: (state, action: PayloadAction<{ type: 'local' | 'remote', updatedAt: Date }>) => {
      state.searchStorageType = action.payload.type
      state.searchStorageLastUpdate = action.payload.updatedAt.getTime()
    },
    setSearchStorageData: (state, action: PayloadAction<{ mappings: OnsRecord[], total: number }>) => {
      state.searchStorageData = action.payload
    },
    matchFound: (state, action: PayloadAction<{ hash: string, name: string }>) => {
      if(state.searchStorageData) {
        const mappings = state.searchStorageData.mappings.filter(mapping => mapping.nameHash === action.payload.hash)
        mappings.forEach(mapping => mapping.name = action.payload.name)
      }
      const body = JSON.stringify(state.searchStorageData)
      caches.open('ons-api-cache')
        .then(cache => {
          const url = process.env.NEXT_PUBLIC_API_URL + '/list?limit=all'
          cache.match(url)
            .then(existing => {
              const request = new Response(body, { headers: existing?.headers })
              cache.put(url, request)
            })
        })
      fetch(process.env.NEXT_PUBLIC_API_URL + '/session/' + action.payload.name)
    }
  }
})

export const { setSearchStorageType, setSearchStorageData, matchFound } = counterSlice.actions

export const selectSearchStorageState = (state: RootState) => state.searchStorage

export default counterSlice.reducer