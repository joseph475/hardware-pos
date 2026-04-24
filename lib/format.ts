import { format, parseISO } from "date-fns"

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value
}

export function formatDate(value: string | Date): string {
  return format(toDate(value), "MMM d, yyyy")
}

export function formatDateLong(value: string | Date): string {
  return format(toDate(value), "EEEE, MMMM d, yyyy")
}

export function formatTime(value: string | Date): string {
  return format(toDate(value), "h:mm a")
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n)
}
