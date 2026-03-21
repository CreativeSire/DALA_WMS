import { createApp } from './app.js'
import { env } from './config/env.js'

const app = createApp()

app.listen(env.PORT, () => {
  console.log(`dala-wms-server listening on port ${env.PORT}`)
})
