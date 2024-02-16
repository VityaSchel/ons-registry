import { configureStore } from '@reduxjs/toolkit'
import searchStorageReducer from './slices/search-storage'

export const store = configureStore({
  reducer: {
    searchStorage: searchStorageReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch