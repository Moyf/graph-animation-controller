import type { DateFormat } from "./types"

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatDate(timestamp: number, format: DateFormat): string {
  const date = new Date(timestamp)
  switch (format) {
    case "iso":
      return date.toISOString().slice(0, 10)
    case "locale":
      return DATE_FORMATTER.format(date)
    case "localeDateTime":
      return DATE_TIME_FORMATTER.format(date)
    case "yearMonth":
      return date.toISOString().slice(0, 7)
    case "year":
      return date.toISOString().slice(0, 4)
  }
}
