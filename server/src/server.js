import { createApp } from './app.js'
import { env } from './config/env.js'
import { ensureRuntimeSchema } from './lib/runtime-schema.js'
import { startOpsSummaryScheduler } from './services/ops-summary-scheduler.js'

const app = createApp()

async function start() {
  await ensureRuntimeSchema()
  app.listen(env.PORT, () => {
    console.log(`dala-wms-server listening on port ${env.PORT}`)
    startOpsSummaryScheduler()
  })
}

start().catch((error) => {
  console.error('Server startup failed:', error)
  process.exit(1)
})
