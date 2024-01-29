import React from 'react'
import { useTranslation } from 'next-i18next'
import { OnsRecord } from '@/shared/model/ons-record'
import { ONSRecordsTable } from '@/entities/ons-record-table'
import cx from 'classnames'
import { Button } from '@/shared/shadcn/ui/button'
import Link from 'next/link'
import { LuKeySquare } from 'react-icons/lu'
import OxenLogoFull from '@/assets/oxen-logo-full.svg'
import { SortingState } from '@tanstack/react-table'
import { Pagination as TablePagination } from '@/entities/table-pagination'

export function Search() {
  const { t, i18n } = useTranslation('common')
  const [mode, setMode] = React.useState<'names' | 'by_author'>('names')

  const [searchResults, setSearchResults] = React.useState<null | OnsRecord[]>(null)
  const [resultsForQuery, setResultsForQuery] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [exactResults, setExactResults] = React.useState<null | OnsRecord[]>(null)
  const [recentOns, setRecentOns] = React.useState<null | OnsRecord[]>(null)
  const [total, setTotal] = React.useState<null | number>(null)
  const [recentOnsTotal, setRecentOnsTotal] = React.useState<null | number>(null)
  const [displaying, setDisplaying] = React.useState<{ from: number, to: number } | null>()

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
      setTotal(recentOnsTotal)
      setDisplaying({ from: 0, to: recentOns?.length ?? 0 })
    }
  }, [searchQuery, recentOnsTotal])

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
              setDisplaying({ from: 0, to: mappings.length })
              setTotal(total)
            })
          if(mode === 'names') {
            const exactSearchResults = exactSearch(searchQuery)
            exactSearchResults.promise
              .then(mappings => {
                console.log('exactSEarch', mappings)
                setExactResults(mappings)
              })
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
    getRecentOns()
      .then((records) => {
        setRecentOns(
          records.mappings
            .sort((a, b) => b.updatedAtBlock - a.updatedAtBlock)
        )
        setDisplaying({ from: 0, to: records.mappings.length })
        setTotal(records.total)
        setRecentOnsTotal(records.total)
      })
  }, [])

  const getRecentOns = (sort?: SortingState) => {
    return new Promise<{ mappings: OnsRecord[], total: number }>(resolve => {
      fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
        limit: '100',
        type: 'session',
        ...(sort && {
          sort_by: sort[0].id,
          sort_dir: sort[0].desc ? 'DESC' : 'ASC'
        })
      }))
        .then(res => res.json())
        .then(json => {
          const records = json as { mappings: OnsRecord[], total: number } | { ok: false, error: string }
          if ('error' in records) throw new Error(records.error)
          resolve(records)
        })
        .catch(err => console.error(err))
    })
  }

  const search = (searchQuery: string, mode: 'names' | 'by_author', sort?: SortingState) => {
    const abortController = new AbortController()

    const promise = new Promise<{ mappings: OnsRecord[], total: number }>(resolve => {
      fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
        ...(mode === 'names' && searchQuery && { query: searchQuery }),
        limit: '100',
        type: 'session',
        ...(mode === 'by_author' && { owner: searchQuery }),
        ...(sort && {
          sort_by: sort[0].id,
          sort_dir: sort[0].desc ? 'DESC' : 'ASC'
        })
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

  const handleSortResults = async (sort: SortingState) => {
    setSearchResults(null)
    const { promise } = search(searchQuery, mode, sort)
    const results = await promise
    setSearchResults(results.mappings)
    setTotal(results.total)
  }

  const handleSortRecent = async (sort: SortingState) => {
    setRecentOns(null)
    const records = await getRecentOns(sort)
    setRecentOns(records.mappings)
    setTotal(records.total)
    setRecentOnsTotal(records.total)
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

  const hasMore = displaying && displaying.to < (total ?? 0)

  const handleLoad = async (offset: number) => {
    const result = await fetch(process.env.NEXT_PUBLIC_API_URL + '/list?' + new URLSearchParams({
      ...(searchQuery && { query: searchQuery }),
      limit: '100', 
      offset: String(offset),
      type: 'session'
    }))
      .then(res => res.json()) as { ok: true, mappings: OnsRecord[], total: number } | { ok: false, error: string }
    if ('error' in result) throw new Error(result.error)
    return result.mappings as OnsRecord[]
  }

  const handleLoadMore = async () => {
    const records = await handleLoad(displaying?.to ?? 0)
    if (showRecent) {
      setRecentOns([
        ...recentOns as OnsRecord[],
        ...records
      ])
    } else {
      setSearchResults([
        ...searchResults as OnsRecord[],
        ...records
      ])
    }
    setDisplaying({ from: displaying?.from ?? 0, to: Math.min((displaying?.to ?? 0)+records.length, total ?? Number.MAX_SAFE_INTEGER) })
  }

  const handleChangePage = async (page: number) => {
    const records = await handleLoad((page - 1) * 100)
    if (showRecent) {
      setRecentOns(records)
    } else {
      setSearchResults(records)
    }
    setDisplaying({ from: (page - 1) * 100, to: Math.min(page * 100, total ?? Number.MAX_SAFE_INTEGER)})
  }

  console.log(displaying, recentOns?.length, recentOns)

  return (
    <div className='flex flex-col gap-8 items-center max-w-full'>
      <div className='flex flex-col gap-2 max-w-full relative'>
        <span className='absolute left-8 top-6 transition-opacity duration-150 pointer-events-none text-ellipsis overflow-hidden max-w-full line-clamp-1 break-all' style={{
          width: 'calc(100% - 4rem)',
          opacity: mode === 'by_author' ? 1 : 0,
          color: searchQuery.length === 0 
            ? '#aaaaaa' 
            : searchQuery.length === 160
              ? '#2563eb'
              : '#5cc4ba'
        }}>
          {searchQuery.length === 0 ? (
            <span>{t('search.search_by_owner_type')}</span>
          ) : searchQuery.length === 160 ? (
            <span className='flex items-center'>
              <LuKeySquare color='#2563eb' className='mr-2' />
              ED25519 keypair
            </span>
          ) : (
            <span className='flex items-center'>
              <span className='block w-fit h-5 bg-[#5cc4ba] p-1 rounded-sm mr-2'>
                <OxenLogoFull className='h-full' />
              </span>
              Wallet
            </span>
          )}
        </span>
        <input
          type="text"
          className={cx('py-6 px-8 text-4xl rounded-lg shadow-lg shadow-slate-950/50 dark:shadow-slate-500/15 outline-none font-[Inter] bg-neutral-800 placeholder:text-neutral-600 max-w-full w-[800px] border-2 border-transparent transition-all duration-75 h-[92px]', {
            '!border-red-500': searchQuery && !isValidONSName,
            'text-sm pt-6 pb-0': mode === 'by_author'
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
              onClick={() => {
                if(searchQuery.length > 64) {
                  setSearchQuery('')
                }
                setMode('names')
                setResultsForQuery('')
              }}
            >{t('search.search_names')}</Button>
            <span className='text-neutral-600'>|</span>
            <Button
              variant='link' 
              className='p-0'
              disabled={mode === 'by_author'}
              onClick={() => {
                setMode('by_author')
                setResultsForQuery('')
              }}
            >{t('search.search_by_owner')}</Button>
          </div>
          <Link href='https://hloth.dev' className='text-sm text-indigo-900' target='_blank' rel='noreferrer'>
            by hloth
          </Link>
        </div>
      </div>
      <div className='mt-4 h-2 w-full flex gap-5 text-muted-foreground text-sm md:text-base'>
        {searchQuery && mode === 'by_author' && (<>
          {total && <span>
            {t('statistics.this_person_owns').replace('{total}', String(total ?? 0))}
          </span>}
          {total && total > 0 && <span>
            {t('statistics.this_person_money').replace('{totalSum}', String(total * 7 ?? 0))}
            {' '}{i18n.language === 'ru' 
              ? <>(≈{(total * 7 * 60 * 0.8).toFixed(2)}RUB)</>
              : <>(≈{(total * 7 * 0.8).toFixed(2)}USD)</>
            }
          </span>}
        </>)}
      </div>
      <div className='mt-6 w-full flex flex-col gap-6 items-center'>
        <ONSRecordsTable
          data={showRecent ? recentOns : searchResults}
          exactResults={exactResults}
          loading={showRecent ? recentOns === null : (searchResults === null && exactResults === null)}
          onSortChange={showRecent ? handleSortRecent : handleSortResults}
        />
        <div className='flex flex-col gap-2 items-center'>
          {Boolean(hasMore) && <Button variant='outline' onClick={handleLoadMore}>
            {t('pagination.load_more')}
          </Button>}
        </div>
        <div className='flex gap-2 items-center justify-between w-full'>
          {Boolean(total && !loading) && <span className='text-sm font-normal'>{t('pagination.showing')
            .replace('{showing}', showRecent ? String(recentOns?.length) : String(searchResults?.length))
            .replace('{total}', String(total))
          }</span>}
          {Boolean(total) && total && (
            <TablePagination
              page={(displaying ? displaying.from / 100 : 0) + 1}
              onChange={handleChangePage}
              totalPages={Math.ceil(total / 100)}
            />
          )}
        </div>
      </div>
    </div>
  )
}