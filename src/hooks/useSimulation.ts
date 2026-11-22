import { useCallback, useEffect, useRef, useState } from 'react'
import type { SensitivityResult, SimRequest, SimResponse, WorkerRequest, WorkerResponse } from '../data/types'

export function useSimulation() {
  const workerRef = useRef<Worker | null>(null)
  const [response, setResponse] = useState<SimResponse | null>(null)
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [running, setRunning] = useState(false)
  const [sensitivityResults, setSensitivityResults] = useState<SensitivityResult[] | null>(null)
  const [sensitivityRunning, setSensitivityRunning] = useState(false)

  useEffect(() => {
    const worker = new Worker(new URL('../simulation/sim.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'progress') {
        setProgress({ completed: msg.completed, total: msg.total })
      } else if (msg.type === 'simulateDone') {
        setResponse(msg.response)
        setRunning(false)
        setProgress(null)
      } else if (msg.type === 'sensitivityDone') {
        setSensitivityResults(msg.results)
        setSensitivityRunning(false)
        setProgress(null)
      }
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const runSimulation = useCallback((request: SimRequest) => {
    if (!workerRef.current) return
    setRunning(true)
    const message: WorkerRequest = { type: 'simulate', request }
    workerRef.current.postMessage(message)
  }, [])

  const runSensitivity = useCallback(
    (request: SimRequest, teamId: string, candidateGameIds: string[], trialsPerScenario = 400) => {
      if (!workerRef.current) return
      setSensitivityRunning(true)
      setSensitivityResults(null)
      const message: WorkerRequest = { type: 'sensitivity', request, teamId, candidateGameIds, trialsPerScenario }
      workerRef.current.postMessage(message)
    },
    []
  )

  return { response, progress, running, runSimulation, sensitivityResults, sensitivityRunning, runSensitivity }
}
