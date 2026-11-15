// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import { DATASET } from './config'
import { createDataSource } from './lib/data'

export const dataSource = createDataSource(`${import.meta.env.BASE_URL}data/${DATASET}/`)
