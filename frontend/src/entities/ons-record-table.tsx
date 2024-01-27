import { OnsRecord } from '@/shared/model/ons-record'
import { blockToDate } from '@/shared/utils'
import {
  ColumnDef,
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

export function ONSRecordsTable({ data }: {
  data: OnsRecord[]
}) {
  const { t } = useTranslation('common')
  const columns: ColumnDef<OnsRecord>[] = [
    {
      accessorKey: 'name',
      header: t('ons_record.name_unhashed.label'),
    },
    {
      accessorKey: 'sessionId',
      header: t('ons_record.value.label'),
      cell: ({ row }) => (
        <span className='text-ellipsis overflow-hidden max-w-16 block'>{row.getValue('sessionId') as string}</span>
      )
    },
    {
      accessorKey: 'owner',
      header: t('ons_record.owner.label'),
      cell: ({ row }) => (
        <span className='text-ellipsis overflow-hidden max-w-16 block'>{row.getValue('owner') as string}</span>
      )
    },
    {
      accessorKey: 'updatedAtBlock',
      header: t('ons_record.updated_at_time.label'),
    }
  ]
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-md border max-w-full w-[1200px]">
      <Table className='w-full'>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
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
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
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
          )}
        </TableBody>
      </Table>
    </div>
    // <div className='max-w-[800px]'>
    //   <table>
    //     <tbody>
    //       {data.length ? (
    //         data.map(record => (
    //           <tr key={record.transactionId}>
    //             <td>{record.name}</td>
    //             <td className='text-ellipsis overflow-hidden max-w-4'>{record.sessionId}</td>
    //             <td className='text-ellipsis overflow-hidden max-w-4'>{record.owner}</td>
    //             <td>{record.updatedAtBlock >= 650000
    //               ? blockToDate(record.updatedAtBlock)!.toLocaleDateString()
    //               : 'unknown'
    //             }</td>
    //           </tr>
    //         ))
    //       ) : (
    //         <tr>
    //           <td colSpan={4}>
    //             <span>{t('search.no_results')}</span>
    //           </td>
    //         </tr>
    //       )}
    //     </tbody>
    //   </table>
    // </div>
  )
}