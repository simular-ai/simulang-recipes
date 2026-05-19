import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const config = {
  redmartBaseUrl: 'https://www.lazada.sg',
  redmartCartUrl: 'https://cart.lazada.sg/cart',
  saveFilePath: join(__dirname, '..', 'save.json'),
  pageLoadDelayMs: 3000,
  delayBetweenItemsMs: 1500,
}
