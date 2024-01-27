import React from 'react'
import { useTranslation } from 'next-i18next'
import { OnsRecord } from '@/shared/model/ons-record'
import { ONSRecordsTable } from '@/entities/ons-record-table'

export function Search() {
  const { t } = useTranslation('common')
  const [searchResults, setSearchResults] = React.useState<null | OnsRecord[]>(null)
  const [searchQuery, setSearchQuery] = React.useState('')

  React.useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
      ...(searchQuery && { query: searchQuery }),
      limit: '100'
    }))
      .then(res => res.json())
      .then(json => {
        const records = json as OnsRecord[]
        setSearchResults(
          records.sort((a,b) => b.updatedAtBlock - a.updatedAtBlock)
        )
      })
      .catch(err => console.error(err))
  }, [searchQuery])

  return (
    <div className='flex flex-col gap-20 items-center max-w-full'>
      <input
        type="text"
        className='py-6 px-8 text-4xl rounded-lg shadow-lg shadow-slate-950/50 dark:shadow-slate-500/15 focus:outline-none font-[Inter] bg-neutral-800 placeholder:text-neutral-600 max-w-full w-[800px]'
        placeholder={t('search.placeholder')}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
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
    </div>
  )
}