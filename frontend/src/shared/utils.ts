import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function blockToDate(block: number) {
  const dateOf650kBlock = new Date('2020-10-24T10:42:00.000Z')
  if (block < 650000) {
    return null
  } else {
    return new Date(dateOf650kBlock.getTime() + (block - 650000) * 120 * 1000)
  }
}