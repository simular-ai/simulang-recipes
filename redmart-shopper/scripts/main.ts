import { App, FocusPolicy, Visibility, initLogger as initSimulangLogger } from '@simular-ai/simulang-js'
import { shop } from './shopper.ts'
import { loadSave, writeSave, isShopDue } from './save.ts'
import { config } from './config.ts'
import { initLogger, log } from './logger.ts'

const force   = process.argv.includes('--force')
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v')
initLogger(verbose)

// In normal mode suppress simulang's [info] runtime lines; keep warn/error
if (!verbose) initSimulangLogger(null, 'warn')

log.info(`${'\x1b[1m'}Redmart Shopper${'\x1b[0m'}`)
log.rule()

const save = loadSave()

if (!save.shoppingList?.length) {
  log.error('✗ shopping list is empty — add items via the shopping client (npm run client) first.')
  process.exit(1)
}

log.info(`${save.shoppingList.length} item(s) on list:`)
save.shoppingList.forEach(item => log.info(`  · ${item.name} ×${item.qty}`))
log.rule()

if (!isShopDue(save.lastPurchaseDate, force)) process.exit(0)

log.info('')
save.cartStatus = 'adding'
writeSave(save)

try {
  await shop(save.shoppingList)

  App.defaultBrowser().open(config.redmartCartUrl, FocusPolicy.Steal, Visibility.Show, true)

  save.lastPurchaseDate = new Date().toISOString().split('T')[0]
  save.cartStatus = 'ready'
  writeSave(save)
  log.ok('\n✓ cart is ready — review and pay on Redmart.')
} catch (err) {
  save.cartStatus = 'error'
  writeSave(save)
  log.error(`\n✗ run failed: ${err}`)
}
