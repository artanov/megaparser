import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

export function unwrap<T>(res: { data: { data: T; error: string | null } }): T {
  if (res.data.error) throw new Error(res.data.error)
  return res.data.data
}
