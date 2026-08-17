import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export function useTestSuites() {
  const [state, setState] = useState({ suites: [], loading: true, error: null })

  useEffect(() => {
    let active = true
    api.suites.list()
      .then((suites) => {
        if (active) setState({ suites, loading: false, error: null })
      })
      .catch((error) => {
        if (active) setState({ suites: [], loading: false, error })
      })
    return () => { active = false }
  }, [])

  return state
}
