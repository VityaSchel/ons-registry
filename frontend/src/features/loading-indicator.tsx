import cx from 'classnames'
import Spinner from '@/assets/spinner.svg'

export function LoadingIndicator({ loading }: {
  loading: boolean
}) {
  return (
    <span className={cx('animate-spin transition-opacity duration-500 w-4 h-4', {
      'opacity-0': !loading,
    })}>
      <Spinner className='w-full h-full' />
    </span>
  )
}