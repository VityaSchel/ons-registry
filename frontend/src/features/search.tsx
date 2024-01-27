import React from 'react'
import { useTranslation } from 'next-i18next'

export function Search() {
  const { t } = useTranslation('common')
  const [searchResults, setSearchResults] = React.useState<null | >(null)

  return (
    <input
      type="text"
      className='py-6 px-8 text-4xl rounded-lg shadow-lg shadow-slate-950/50 dark:shadow-slate-500/15 focus:outline-none font-[Inter] bg-neutral-800 placeholder:text-neutral-600'
      placeholder={t('search.placeholder')}
    />
    {searchResults ? (
      <ONSRecordsTable 
        data={searchResults}
      />
    ) : (
      <ONSRecordsTable 
        data={[]}
      />
    )}
  )
}