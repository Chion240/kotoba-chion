import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn/ui 标准 className 合并助手。
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
