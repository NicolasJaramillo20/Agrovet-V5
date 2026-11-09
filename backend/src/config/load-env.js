import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDirectory = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const projectDirectory = resolve(backendDirectory, '..')

dotenv.config({ path: resolve(projectDirectory, '.env.local') })
dotenv.config({ path: resolve(projectDirectory, '.env') })
dotenv.config({ path: resolve(backendDirectory, '.env') })
