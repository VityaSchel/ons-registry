import React from 'react'
import { useTranslation } from 'next-i18next'
import { OnsRecord } from '@/shared/model/ons-record'
import { ONSRecordsTable } from '@/entities/ons-record-table'
import cx from 'classnames'
import { Button } from '@/shared/shadcn/ui/button'
import Link from 'next/link'

export function Search() {
  const { t } = useTranslation('common')
  const [mode, setMode] = React.useState<'names' | 'by_author'>('names')

  const [searchResults, setSearchResults] = React.useState<null | OnsRecord[]>(null)
  const [resultsForQuery, setResultsForQuery] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [exactResults, setExactResults] = React.useState<null | OnsRecord[]>(null)
  const [recentOns, setRecentOns] = React.useState<null | OnsRecord[]>(null)
  const [total, setTotal] = React.useState<null | number>(null)

  const isValidONSName = React.useMemo(() => {
    return new RegExp('^\\w([\\w-]*[\\w])?$', 'g')
      .test(searchQuery)
  }, [searchQuery])

  const isValidOwner = React.useMemo(() => {
    return new RegExp('^[0-9a-fA-F]+$', 'g')
      .test(searchQuery)
  }, [searchQuery])

  const isValidQuery = isValidONSName || isValidOwner

  React.useEffect(() => {
    if(searchQuery === '') {
      setResultsForQuery('')
    }
  }, [searchQuery])

  React.useEffect(() => {
    if (isValidQuery) {
      if(searchQuery !== resultsForQuery) {
        setSearchResults(null)
        setExactResults(null)
        if (searchQuery) {
          const searchResults = search(searchQuery, mode)
          searchResults.promise
            .then(({ mappings, total }) => {
              setSearchResults(mappings)
              setTotal(total)
            })
          if(mode === 'names') {
            const exactSearchResults = exactSearch(searchQuery)
            exactSearchResults.promise
              .then(setExactResults)
            Promise.all([searchResults.promise, exactSearchResults.promise])
              .then(() => {
                setResultsForQuery(searchQuery)
              })
            return () => {
              searchResults.abort()
              exactSearchResults.abort()
            }
          } else {
            searchResults.promise.then(() => {
              setResultsForQuery(searchQuery)
            })
            return () => {
              searchResults.abort()
            }
          }
        }
      }
    }
  }, [searchQuery, isValidQuery, resultsForQuery, mode])

  React.useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
      limit: '100',
      type: 'session'
    }))
      .then(res => res.json())
      .then(json => {
        const records = json as { mappings: OnsRecord[], total: number } | { ok: false, error: string }
        if ('error' in records) throw new Error(records.error)
        setRecentOns(
          records.mappings.sort((a, b) => b.updatedAtBlock - a.updatedAtBlock)
        )
        setTotal(records.total)
      })
      .catch(err => console.error(err))
  }, [])

  const search = (searchQuery: string, mode: 'names' | 'by_author') => {
    const abortController = new AbortController()

    const promise = new Promise<{ mappings: OnsRecord[], total: number }>(resolve => {
      fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
        ...(mode === 'names' && searchQuery && { query: searchQuery }),
        limit: '100',
        type: 'session',
        ...(mode === 'by_author' && { owner: searchQuery })
      }), { signal: abortController.signal })
        .then(res => res.json())
        .then(json => {
          const result = json as { ok: true, mappings: OnsRecord[], total: number } | { ok: false, error: string }
          if ('error' in result) throw new Error(result.error)
          resolve({ 
            mappings: result.mappings,
            total: result.total
          })
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          console.error(err)
        })
    })

    return {
      abort: () => abortController.abort(), promise: promise 
    }
  }

  const exactSearch = (searchQuery: string) => {
    const abortController = new AbortController()

    const promise = new Promise<OnsRecord[] | null>(resolve => {
      fetch(
        process.env.NEXT_PUBLIC_API_URL + '/session/' + searchQuery, 
        { signal: abortController.signal }
      )
        .then(res => res.json())
        .then(json => {
          const result = json as { ok: true, mappings: OnsRecord[], total: number } | { ok: false, error: string }
          if ('error' in result) {
            if(result.error === 'NOT_FOUND') {
              resolve(null)
              return
            } else {
              throw new Error(result.error)
            }
          } else {
            resolve(result.mappings)
          }
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          console.error(err)
        })
    })

    return {
      abort: () => abortController.abort(), promise
    }
  }

  const showRecent = !((searchQuery) ? (resultsForQuery !== '' || isValidONSName) : false)

  const loading = showRecent
    ? recentOns === null
    : searchResults === null && exactResults === null

  const tableContents = showRecent
    ? recentOns
    : searchResults

  const handleLoadMore = () => {
    fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
      ...(searchQuery && { query: searchQuery }),
      limit: '100',
      max_block: String(tableContents?.[tableContents?.length - 1]?.updatedAtBlock ?? 0),
      type: 'session'
    }))
      .then(res => res.json())
      .then(json => {
        const result = json as { ok: true, mappings: OnsRecord[], total: number } | { ok: false, error: string }
        if ('error' in result) throw new Error(result.error)
        if(showRecent) {
          setRecentOns([
            ...recentOns as OnsRecord[],
            ...result.mappings
          ])
        } else {
          setSearchResults([
            ...searchResults as OnsRecord[],
            ...result.mappings
          ])
        }
        setTotal(result.total)
      })
      .catch(err => {
        console.error(err)
      })
  }

  return (
    <div className='flex flex-col gap-8 items-center max-w-full'>
      <div className='flex flex-col gap-2'>
        <input
          type="text"
          className={cx('py-6 px-8 text-4xl rounded-lg shadow-lg shadow-slate-950/50 dark:shadow-slate-500/15 outline-none font-[Inter] bg-neutral-800 placeholder:text-neutral-600 max-w-full w-[800px] border-2 border-transparent transition-all duration-75', {
            '!border-red-500': searchQuery && !isValidONSName,
          })}
          placeholder={mode === 'names' ? t('search.placeholder') : t('search.search_by_owner')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value.replaceAll(' ', ''))}
          maxLength={mode === 'names' ? 64 : 160}
        />
        <div className='flex justify-between items-center'>
          <div className='flex items-center gap-2 ml-2'>
            <Button
              variant='link'
              className='p-0'
              disabled={mode === 'names'}
              onClick={() => setMode('names')}
            >{t('search.search_names')}</Button>
            <span className='text-neutral-600'>|</span>
            <Button
              variant='link' 
              className='p-0'
              disabled={mode === 'by_author'}
              onClick={() => setMode('by_author')}
            >{t('search.search_by_owner')}</Button>
          </div>
          <Link href='https://hloth.dev' className='text-sm text-indigo-900' target='_blank' rel='noreferrer'>
            by hloth
          </Link>
        </div>
      </div>
      <div className='mt-12 w-full'>
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
      <div className='flex flex-col gap-2 items-center'>
        {Boolean(total && !loading) && <span className='text-sm font-normal'>{t('pagination.showing')
          .replace('{showing}', showRecent ? String(recentOns?.length) : String(searchResults?.length))
          .replace('{total}', String(total))
        }</span>}
        <Button variant='outline' onClick={handleLoadMore}>
          {t('pagination.load_more')}
        </Button>
      </div>
    </div>
  )
}