import { Button } from '@/shared/shadcn/ui/button'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons'
import _ from 'lodash'

export type PaginationData = {
  currentPage: number
  pages: number
}

const MAX_ITEMS = 5
export function Pagination({ totalPages, page, onChange }: {
  totalPages: number
  page: number
  onChange: (page: number) => void
}) {
  const OFFSET = (MAX_ITEMS - 1) / 2
  const minVisible = page - OFFSET
  const maxVisible = page + OFFSET + 1

  const PageButton = ({ n }: { n: number }) => {
    return (
      <Button
        onClick={() => n !== page && onChange(n)}
        variant={n === page ? 'default' : 'outline'}
        size='icon'
      >
        {n}
      </Button>
    )
  }

  return (
    <div className='flex gap-2'>
      <PaginationButton
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeftIcon />
      </PaginationButton>

      {totalPages > 0 && (<PageButton n={1} />)}
      {minVisible > 2 && <PaginationButton disabled>...</PaginationButton>}
      {totalPages > 2 && _.range(minVisible, maxVisible)
        .filter(i => i > 1 && i < totalPages)
        .map(i => (
          <PageButton n={i} key={i} />
        ))
      }
      {maxVisible < totalPages - 1 && <PaginationButton disabled>...</PaginationButton>}
      {totalPages > 1 && (<PageButton n={totalPages} />)}

      <PaginationButton
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
      >
        <ChevronRightIcon />
      </PaginationButton>
    </div>
  )
}

function PaginationButton({ onClick, children, active, disabled }: React.PropsWithChildren<{
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  active?: boolean
  disabled?: boolean
}>) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      variant={active ? 'default' : 'outline'}
      size='icon'
    >
      {children}
    </Button>
  )
}