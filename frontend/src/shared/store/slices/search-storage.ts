import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'
import { OnsRecord } from '@/shared/model/ons-record'

interface SearchStorageState {
  searchStorageType: 'initializing' | 'local' | 'remote'
  searchStorageData: { mappings: OnsRecord[], total: number } | null
  searchStorageLastUpdate: Date | null
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
      state.searchStorageLastUpdate = action.payload.updatedAt
    },
    setSearchStorageData: (state, action: PayloadAction<{ mappings: OnsRecord[], total: number }>) => {
      state.searchStorageData = action.payload
    }
  }
})

export const { setSearchStorageType, setSearchStorageData } = counterSlice.actions

export const selectSearchStorageState = (state: RootState) => state.searchStorage

export default counterSlice.reducer