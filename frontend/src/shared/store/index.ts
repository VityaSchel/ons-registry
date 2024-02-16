import { configureStore } from '@reduxjs/toolkit'
import searchStorageReducer from './slices/search-storage'

export const store = configureStore({
  reducer: {
    searchStorage: searchStorageReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActionPaths: ['payload.updatedAt']
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch