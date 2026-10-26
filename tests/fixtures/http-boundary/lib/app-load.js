import { cache } from 'react'
import { headers } from 'next/headers'
import { loadRequired } from './load'
export const loadApp = cache(async status => loadRequired(status, await headers()))
