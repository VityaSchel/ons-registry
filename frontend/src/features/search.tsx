import React from 'react'
import { useTranslation } from 'next-i18next'
import { OnsRecord } from '@/shared/model/ons-record'
import { ONSRecordsTable } from '@/entities/ons-record-table'
import cx from 'classnames'

export function Search() {
  const { t } = useTranslation('common')
  const [searchResults, setSearchResults] = React.useState<null | OnsRecord[]>(null)
  const [resultsForQuery, setResultsForQuery] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [exactResults, setExactResults] = React.useState<null | OnsRecord[]>(null)
  const [recentOns, setRecentOns] = React.useState<null | OnsRecord[]>(null)
  const isValidONSName = React.useMemo(() => {
    return new RegExp('^\\w([\\w-]*[\\w])?$', 'g')
      .test(searchQuery)
  }, [searchQuery])

  React.useEffect(() => {
    if(searchQuery === '') {
      setResultsForQuery('')
    }
  }, [searchQuery])

  React.useEffect(() => {
    if(isValidONSName) {
      if(searchQuery !== resultsForQuery) {
        setSearchResults(null)
        setExactResults(null)
        if (searchQuery) {
          const abortSearch = search(searchQuery)
          const abortExactSearch = exactSearch(searchQuery)
          return () => {
            abortSearch()
            abortExactSearch()
          }
        }
      }
    }
  }, [searchQuery, isValidONSName, resultsForQuery])

  React.useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
      limit: '100'
    }))
      .then(res => res.json())
      .then(json => {
        const records = json as OnsRecord[]
        setRecentOns(
          records.sort((a, b) => b.updatedAtBlock - a.updatedAtBlock)
        )
      })
      .catch(err => console.error(err))
  }, [])

  const search = (searchQuery: string) => {
    const abortController = new AbortController()
    fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
      ...(searchQuery && { query: searchQuery }),
      limit: '100'
    }), { signal: abortController.signal })
      .then(res => res.json())
      .then(json => {
        setSearchResults(json as OnsRecord[])
        setResultsForQuery(searchQuery)
      })
      .catch(err => console.error(err))

    return () => abortController.abort()
  }

  const exactSearch = (searchQuery: string) => {
    const abortController = new AbortController()
    fetch(
      process.env.NEXT_PUBLIC_API_URL + '/session/' + searchQuery, 
      { signal: abortController.signal }
    )
      .then(res => res.json())
      .then(json => {
        const result = json as OnsRecord[] | { ok: false, error: string }
        if ('error' in result) {
          if(result.error === 'not_found') {
            setExactResults(null)
            return
          } else {
            throw new Error(result.error)
          }
        } else {
          setExactResults(result)
        }
      })
      .catch(err => console.error(err))

    return () => abortController.abort()
  }

  const showRecent = !((searchQuery) ? (resultsForQuery !== '' || isValidONSName) : false)

  return (
    <div className='flex flex-col gap-20 items-center max-w-full'>
      <input
        type="text"
        className={cx('py-6 px-8 text-4xl rounded-lg shadow-lg shadow-slate-950/50 dark:shadow-slate-500/15 outline-none font-[Inter] bg-neutral-800 placeholder:text-neutral-600 max-w-full w-[800px] border-2 border-transparent transition-all duration-75', {
          '!border-red-500': searchQuery && !isValidONSName,
        })}
        placeholder={t('search.placeholder')}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value.replaceAll(' ', ''))}
        maxLength={64}
      />
      {!showRecent ? (
        <ONSRecordsTable
          data={searchResults}
          exactResults={exactResults}
          loading={searchResults === null && exactResults === null}
        />
      ) : (
        <ONSRecordsTable
          data={recentOns ?? []}
          loading={recentOns === null}
        />
      )}
    </div>
  )
}