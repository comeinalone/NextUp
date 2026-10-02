import { useCallback, useEffect, useState } from 'react'

export function useManagerResource(loader) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  const load = useCallback(async () => {
    setState((current) => ({ ...current, error: null, loading: true }))
    try {
      const data = await loader()
      setState({ data, error: null, loading: false })
    } catch (error) {
      setState({ data: null, error, loading: false })
    }
  }, [loader])

  useEffect(() => {
    let active = true
    loader().then(
      (data) => { if (active) setState({ data, error: null, loading: false }) },
      (error) => { if (active) setState({ data: null, error, loading: false }) },
    )
    return () => { active = false }
  }, [loader])

  return { ...state, reload: load }
}
