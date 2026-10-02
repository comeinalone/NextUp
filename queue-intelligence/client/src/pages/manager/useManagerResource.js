import { useCallback, useEffect, useRef, useState } from 'react'
import { managerApi } from '../../lib/managerApi'

// Live REST resources refresh at most once per five seconds, with a slow recovery
// poll. Socket resources still receive their snapshots immediately.
export function useManagerResource(loader, subscribe, live = false) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const loadRef = useRef(null)
  const reload = useCallback(() => loadRef.current?.(), [])
  const replaceData = useCallback((data) => {
    setState({ data, error: null, loading: false })
  }, [])

  useEffect(() => {
    let active = true
    let revision = 0
    let inFlight = null
    let timer = null
    let lastStarted = 0

    const schedule = () => {
      if (!active || timer !== null) return
      timer = setTimeout(() => {
        timer = null
        if (inFlight) schedule()
        else load()
      }, Math.max(100, 5000 - (Date.now() - lastStarted)))
    }
    const load = () => {
      if (inFlight) return inFlight
      lastStarted = Date.now()
      const startedRevision = revision
      setState((current) => ({ ...current, loading: true }))
      inFlight = loader().then(
        (data) => {
          if (active && revision === startedRevision) setState({ data, error: null, loading: false })
          return true
        },
        (error) => {
          if (active && revision === startedRevision) setState((current) => ({ ...current, error, loading: false }))
          return false
        },
      ).finally(() => { inFlight = null })
      return inFlight
    }
    loadRef.current = load
    const unsubscribe = subscribe?.((data) => {
      revision += 1
      if (active) setState({ data, error: null, loading: false })
    })
    const stopRefresh = live ? managerApi.subscribeOverview(schedule) : undefined
    const interval = live ? setInterval(schedule, 30000) : undefined
    load()
    return () => {
      active = false
      loadRef.current = null
      clearTimeout(timer)
      clearInterval(interval)
      unsubscribe?.()
      stopRefresh?.()
    }
  }, [loader, subscribe, live])

  return { ...state, reload, replaceData }
}
