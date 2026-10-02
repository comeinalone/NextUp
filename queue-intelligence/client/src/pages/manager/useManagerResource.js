import { useCallback, useEffect, useState } from 'react'

export function useManagerResource(loader, subscribe) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  const load = useCallback(async () => {
    setState((current) => ({ ...current, error: null, loading: true }))
    try {
      const data = await loader()
      setState({ data, error: null, loading: false })
    } catch (error) {
      setState((current) => ({ ...current, error, loading: false }))
    }
  }, [loader])

  const replaceData = useCallback((data) => {
    setState({ data, error: null, loading: false })
  }, [])

  useEffect(() => {
    let active = true
    loader().then(
      (data) => { if (active) setState({ data, error: null, loading: false }) },
      (error) => { if (active) setState((current) => ({ ...current, error, loading: false })) },
    )
    return () => { active = false }
  }, [loader])

  useEffect(() => {
    if (!subscribe) return undefined
    return subscribe((data) => setState({ data, error: null, loading: false }))
  }, [subscribe])

  return { ...state, reload: load, replaceData }
}
