import { env } from '../config/env.js'
import { deliverDueOpsSummaries } from './ops-summary-service.js'

let intervalHandle = null
let running = false

async function runCycle() {
  if (running) return
  running = true
  try {
    await deliverDueOpsSummaries()
  } catch (error) {
    console.error('ops-summary-scheduler failed:', error)
  } finally {
    running = false
  }
}

export function startOpsSummaryScheduler() {
  if (env.OPS_SUMMARY_SCHEDULER_ENABLED !== 'true') return
  if (intervalHandle) return

  runCycle()
  intervalHandle = setInterval(runCycle, env.OPS_SUMMARY_SCHEDULER_INTERVAL_MINUTES * 60 * 1000)
}
