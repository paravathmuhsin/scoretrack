import { Timestamp } from 'firebase/firestore'

export function ts(iso: string): Timestamp {
  return Timestamp.fromDate(new Date(iso))
}
