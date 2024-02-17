import { OnsRecord } from '@/shared/model/ons-record'
import { blockToDate } from '@/shared/utils'
import { ArrowUpDown } from 'lucide-react'
import { LuKeySquare } from 'react-icons/lu'
import OxenLogo from '@/assets/oxen-logo.svg'
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useTranslation } from 'next-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/shadcn/ui/table'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/shared/shadcn/ui/tabs'
import React from 'react'
import { Button } from '@/shared/shadcn/ui/button'
import { Skeleton } from '@/shared/shadcn/ui/skeleton'
import { GoQuestion } from 'react-icons/go'
import copy from 'copy-to-clipboard'
import { toast } from 'sonner'
import { Key } from 'ts-key-enum'
import { RowDetails } from '@/entities/row-details'
import { Tooltip } from '@/shared/ui/tooltip'
import { OnsRecordOwner } from '@/entities/ons-record-owner'

export function ONSRecordsTable({ data, loading = false, exactResults, onSortChange }: {
  data: OnsRecord[] | null
  loading?: boolean
  exactResults?: OnsRecord[] | null
  onSortChange: (sorting: SortingState) => void
}) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  const [ownerDisplay, setOwnerDisplay] = React.useState<'keypair' | 'oxen'>('oxen')

  const columns: ColumnDef<OnsRecord>[] = React.useMemo(() => [
    {
      accessorKey: 'name',
      header: t('ons_record.name_unhashed.label'),
      size: 100,
      cell: ({ row }) => (
        row.getValue('name') ? (
          <span className='text-ellipsis overflow-hidden max-w-full'>
            {row.getValue('name') as string}
          </span>
        ) : (
          <span className='text-neutral-600 flex gap-2 items-center'>
            {t('ons_record.name_hashed.label')}
            <Tooltip content={<p className='max-w-80 text-white'>{t('ons_record.name_hashed.hint')}</p>}>
              <GoQuestion />
            </Tooltip>
          </span>
        )
      ),
    },
    {
      accessorKey: 'sessionId',
      header: t('ons_record.value.label'),
      cell: ({ row }) => {
        const name = row.getValue('name') as string | null
        const sessionID = row.getValue('sessionId') as string | null

        const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation()
          if (!sessionID) return
          copy(sessionID)
          toast.success(t('ons_record.value.copied'))
        }

        return (
          sessionID ? (
            <Tooltip delayDuration={200} content={
              <p className='max-w-80 text-white'>
                {t('copy')}
              </p>
            }>
              {(props) => (
                <button 
                  onClick={handleCopy} 
                  className='text-ellipsis overflow-hidden max-w-full block' 
                  {...props}
                >
                  {sessionID}
                </button>
              )}
            </Tooltip>
          ) : (
            <span className='text-neutral-600 flex gap-2 items-center'>
              {name ? t('ons_record.value_encrypted.label_legacy_argon2') : t('ons_record.value_encrypted.label_hashed_name')}
              <Tooltip content={
                <p className='max-w-80 text-white'>
                  {name ? t('ons_record.value_encrypted.hint_legacy_argon2') : t('ons_record.value_encrypted.hint_hashed_name')}
                </p>
              }>
                {(props) => (
                  <button onClick={e => e.stopPropagation()} {...props}>
                    <GoQuestion />
                  </button>
                )}
              </Tooltip>
            </span>
          )
        )
      },
      size: 200,
    },
    {
      accessorKey: 'owner',
      header: () => (
        <div className='flex justify-between items-center w-full gap-2'>
          <span>{t('ons_record.owner.label')}</span>
          <Tabs
            value={ownerDisplay}
            onValueChange={value => setOwnerDisplay(value as 'keypair' | 'oxen')}
            className='h-auto'
          >
            <TabsList className='h-auto'>
              <TabsTrigger value='keypair'>
                <LuKeySquare size={12} />
              </TabsTrigger>
              <TabsTrigger value='oxen'>
                <OxenLogo size={12} className='w-3 h-3' />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      ),
      cell: ({ row }) => {
        const owner = row.getValue('owner') as { keypair: string, oxen: string }

        return (
          <OnsRecordOwner 
            owner={owner} 
            ownerDisplay={ownerDisplay} 
          />
        )
      },
      size: 100,
    },
    {
      accessorKey: 'updatedAtBlock',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('ons_record.updated_at_time.label')}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const updatedAtBlock = row.getValue('updatedAtBlock') as number
        const content = updatedAtBlock >= 650000
          ? Intl.DateTimeFormat([language], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          }).format(blockToDate(updatedAtBlock) as Date)
          : '[Before 24 oct 2020]'
        // className='hidden md:block'
        return (<>
          <span>{content}</span>
        </>)
      },
      size: 100,
    }
  ], [language, t, ownerDisplay])
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'updatedAtBlock', desc: true }])
  const tableRows = React.useMemo(() => {
    return exactResults ? [
      ...exactResults ?? [], 
      ...(data ?? []).filter(mapping => !exactResults?.some(t => t.transactionId === mapping.transactionId))
    ] : data ?? []
  }, [data, exactResults])
  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (sort) => {
      if (typeof sort === 'function') {
        onSortChange(sort(sorting))
      } else {
        onSortChange(sort)
      }

      setSorting(sort)
    },
    manualSorting: true,
    state: {
      sorting,
    },
    getRowId: (row) => row.transactionId,
  })

  const columnWidths = ['33%', '67%', '33%', '200px']

  const [detailsOpen, setDetailsOpen] = React.useState<OnsRecord | false>(false)
  const handleOpenDetails = (record: OnsRecord) => {
    setDetailsOpen(record)
  }

  return (
    <div className="rounded-md border max-w-full md:w-[1200px]">
      <RowDetails record={detailsOpen} onClose={() => setDetailsOpen(false)} />
      <Table className='w-[800px] md:w-full max-w-[800px] md:max-w-full table-fixed'>
        <TableHeader className='w-full max-w-full'>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead 
                    key={header.id}
                    style={{ width: columnWidths[header.index] }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </TableHead>
                )
              })} 
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className='w-full max-w-full'>
          {loading ? (
            [...new Array(3)].map((_, index) => (
              <TableRow key={index}>
                {columnWidths.map((width, i) => (
                  <TableCell className="text-center" style={{ width }} key={i}>
                    <Skeleton className="w-full h-[20px]"/>
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const isExactMatch = Boolean(row.getValue('name')
                  && exactResults
                  && exactResults.some(r => r.name === row.getValue('name')))
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className='w-full max-w-full cursor-pointer'
                    onClick={() => handleOpenDetails(row.original)}
                    onKeyDown={e => {
                      if (e.key === ' ' || e.key === 'Spacebar' || e.key === Key.Enter) { 
                        e.preventDefault()
                        handleOpenDetails(row.original)
                      }
                    }}
                    tabIndex={0}
                  >
                    {row.getVisibleCells().map((cell, i) => (
                      <TableCell key={cell.id} style={{
                        width: columnWidths[i],
                        ...(isExactMatch && { paddingTop: 40 })
                      }}>
                        {isExactMatch && i === 0 && (
                          <span className='absolute t-0 -mt-8 text-md font-normal text-gray-600 bg-slate-900 px-2 py-1 rounded-md'>
                            {t('search.exact_result')}
                          </span>
                        )}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t('search.no_results')}
                </TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  )
}