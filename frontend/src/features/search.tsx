import React from 'react'
import { useTranslation } from 'next-i18next'
import { OnsRecord } from '@/shared/model/ons-record'
import { ONSRecordsTable } from '@/entities/ons-record-table'
import { Button } from '@/shared/shadcn/ui/button'
import Link from 'next/link'
import { SortingState } from '@tanstack/react-table'
import { Pagination as TablePagination } from '@/entities/table-pagination'
import { Input } from '@/features/input'
import { BuyNamesButton } from '@/features/buy-names-button'
import { SearchingStorageType } from '@/features/searching-storage-type'
import { fetchList, fetchRecord } from '@/shared/api'

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
  const [recentOnsLoaded, setRecentOnsLoaded] = React.useState<{ from: number, to: number } | null>()

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
      setDisplaying(recentOnsLoaded)
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
        setRecentOnsLoaded({ from: 0, to: records.mappings.length })
        setTotal(records.total)
        setRecentOnsTotal(records.total)
      })
  }, [])

  const getRecentOns = (sort?: SortingState) => {
    return new Promise<{ mappings: OnsRecord[], total: number }>(resolve => {
      fetchList({
        limit: 100,
        type: 'session',
        ...(sort && {
          sort_by: sort[0].id,
          sort_dir: sort[0].desc ? 'DESC' : 'ASC'
        })
      })
        .then(records => {
          if (!records.ok) throw new Error(records.error)
          resolve(records)
        })
        .catch(err => console.error(err))
    })
  }

  const search = (searchQuery: string, mode: 'names' | 'by_author', sort?: SortingState) => {
    const abortController = new AbortController()

    const promise = new Promise<{ mappings: OnsRecord[], total: number }>(resolve => {
      fetchList({
        ...(mode === 'names' && searchQuery && { query: searchQuery }),
        limit: 100,
        type: 'session',
        ...(mode === 'by_author' && { owner: searchQuery }),
        ...(sort && {
          sort_by: sort[0].id,
          sort_dir: sort[0].desc ? 'DESC' : 'ASC'
        })
      }, { signal: abortController.signal })
        .then(result => {
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
      fetchRecord(
        process.env.NEXT_PUBLIC_API_URL + '/session/' + searchQuery, 
        { signal: abortController.signal }
      )
        .then(result => {
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
    const result = await fetchList({
      ...(searchQuery && { query: searchQuery }),
      limit: 100, 
      offset: offset,
      type: 'session'
    })
    if ('error' in result) throw new Error(result.error)
    return result.mappings as OnsRecord[]
  }

  const handleLoadMore = async () => {
    const records = await handleLoad(displaying?.to ?? 0)
    const newDisplaying = { from: displaying?.from ?? 0, to: Math.min((displaying?.to ?? 0) + records.length, total ?? Number.MAX_SAFE_INTEGER) }
    if (showRecent) {
      setRecentOns([
        ...recentOns as OnsRecord[],
        ...records
      ])
      setRecentOnsLoaded(newDisplaying)
    } else {
      setSearchResults([
        ...searchResults as OnsRecord[],
        ...records
      ])
    }
    setDisplaying(newDisplaying)
  }

  const handleChangePage = async (page: number) => {
    const records = await handleLoad((page - 1) * 100)
    const newDisplaying = { from: (page - 1) * 100, to: Math.min(page * 100, total ?? Number.MAX_SAFE_INTEGER) }
    if (showRecent) {
      setRecentOns(records)
      setRecentOnsLoaded(newDisplaying)
    } else {
      setSearchResults(records)
    }
    setDisplaying(newDisplaying)
  }

  return (
    <div className='flex flex-col gap-8 items-center max-w-full'>
      <div className='flex flex-col gap-2 max-w-full relative'>
        <Input
          mode={mode}
          onChange={setSearchQuery}
          placeholder={mode === 'names' ? t('search.placeholder') : t('search.search_by_owner')}
          maxLength={mode === 'names' ? 64 : 160}
        />
        <BuyNamesButton
          loading={loading}
          state={(mode !== 'names' || showRecent) 
            ? 'default'
            : exactResults === null
              ? 'free'
              : 'taken'
          }
          name={searchQuery}
        />
        <div className='flex justify-between items-start 370:items-center flex-col 370:flex-row'>
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
        {Boolean(searchQuery) && mode === 'by_author' && (<>
          {Boolean(total) && <span>
            {t('statistics.this_person_owns').replace('{total}', String(total ?? 0))}
          </span>}
          {Boolean(total) && total && total > 0 && <span>
            {t('statistics.this_person_money').replace('{totalSum}', String(total * 7 ?? 0))}
            {' '}{i18n.language === 'ru' 
              ? <>(≈{(total * 7 * 60 * 0.8).toFixed(2)}RUB)</>
              : <>(≈{(total * 7 * 0.8).toFixed(2)}USD)</>
            }
          </span>}
        </>)}
      </div>
      <div className='w-full flex flex-col mt-6 gap-1'>
        <SearchingStorageType />
        <div className='flex flex-col gap-6 items-center'>
          <ONSRecordsTable
            data={showRecent ? recentOns : searchResults}
            exactResults={showRecent ? [] : exactResults}
            loading={showRecent ? recentOns === null : (searchResults === null && exactResults === null)}
            onSortChange={showRecent ? handleSortRecent : handleSortResults}
          />
          <div className='flex flex-col gap-2 items-center'>
            {Boolean(hasMore) && <Button variant='outline' onClick={handleLoadMore}>
              {t('pagination.load_more')}
            </Button>}
          </div>
          <div className='flex gap-2 items-center justify-between w-full flex-col sm:flex-row'>
            {(total && !loading) ? (
              <span className='text-sm font-normal'>{t('pagination.showing')
                .replace('{showing}', showRecent ? String(recentOns?.length) : String(searchResults?.length))
                .replace('{total}', String(total))
              }</span>
            ) : <span />}
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
    </div>
  )
}