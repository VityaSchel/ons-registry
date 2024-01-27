import { OnsRecord } from '@/shared/model/ons-record'
import { blockToDate } from '@/shared/utils'
import { ArrowUpDown } from 'lucide-react'
import _ from 'lodash'
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
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
import React from 'react'
import { Button } from '@/shared/shadcn/ui/button'
import { Skeleton } from '@/shared/shadcn/ui/skeleton'
import { GoQuestion } from 'react-icons/go'
import { LuKeySquare } from 'react-icons/lu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip'
import OxenLogo from '@/assets/oxen-logo.svg'

export function ONSRecordsTable({ data, loading = false, exactResults }: {
  data: OnsRecord[] | null
  loading?: boolean
  exactResults?: OnsRecord[] | null
}) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  const columns: ColumnDef<OnsRecord>[] = [
    {
      accessorKey: 'name',
      header: t('ons_record.name_unhashed.label'),
      size: 100,
      cell: ({ row }) => (
        <span className='text-ellipsis overflow-hidden max-w-full block'>
          {row.getValue('name') ?? (
            <span className='text-neutral-600 flex gap-2 items-center'>
              {t('ons_record.name_hashed.label')}
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button>
                      <GoQuestion />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className='bg-muted'>
                    <p className='max-w-80 text-white'>{t('ons_record.name_hashed.hint')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'sessionId',
      header: t('ons_record.value.label'),
      cell: ({ row }) => (
        <span className='text-ellipsis overflow-hidden max-w-full block'>
          {row.getValue('sessionId') ?? (
            <span className='text-neutral-600 flex gap-2 items-center'>
              {t('ons_record.value_encrypted.label')}
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button>
                      <GoQuestion />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className='bg-muted'>
                    <p className='max-w-80 text-white'>{t('ons_record.value_encrypted.hint')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          )}
        </span>
      ),
      size: 200,
    },
    {
      accessorKey: 'owner',
      header: t('ons_record.owner.label'),
      cell: ({ row }) => {
        const owner = row.getValue('owner') as string
        const isWallet = owner.length !== 160
        return (
          <div className='flex gap-2 items-center'>
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button className='w-12'>
                    {!isWallet ? (
                      <LuKeySquare color='#2563eb' />
                    ) : (
                      <OxenLogo />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent className='bg-muted'>
                  <p className='max-w-80 text-white'>
                    {isWallet ? t('ons_record.owner.owner_type_wallet') : t('ons_record.owner.owner_type_keypair')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className='text-ellipsis overflow-hidden max-w-full block'>
              {owner}
            </span>
          </div>
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
        return updatedAtBlock >= 650000
          ? Intl.DateTimeFormat([language], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          }).format(blockToDate(updatedAtBlock) as Date)
          : '[Before 24 oct 2020]'
      },
      size: 100,
    }
  ]
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'updatedAtBlock', desc: true }])
  const tableRows = React.useMemo(() => {
    return _.uniqBy([...exactResults ?? [], ...data ?? []], 'transactionId')
  }, [data, exactResults])
  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  })

  const columnWidths = ['33%', '67%', '33%', '200px']
  // const columnFlexes = ['1', '2', '1', '1']

  return (
    <div className="rounded-md border max-w-full w-[1200px]">
      <Table className='w-full max-w-full table-fixed'>
        <TableHeader className='w-full max-w-full'>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id} style={{
                    width: columnWidths[header.index],
                  }}>
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='w-full max-w-full'
                >
                  {row.getVisibleCells().map((cell, i) => (
                    <TableCell key={cell.id} style={{
                      width: columnWidths[i],
                    }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
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