import { App, FocusPolicy, Visibility } from '@simular-ai/simulang-js'
import { shop } from './shopper.ts'
import { loadSave, writeSave, isShopDue } from './save.ts'
import { config } from './config.ts'

const force = process.argv.includes('--force')

console.log('=== Redmart Shopper ===')

const save = loadSave()

if (!save.shoppingList?.length) {
  console.error('✗ shopping list is empty — add items via the shopping client (npm run client) first.')
  process.exit(1)
}

console.log(`${save.shoppingList.length} item(s) on list:`)
save.shoppingList.forEach(item => console.log(`  - ${item.name} x${item.qty}`))

if (!isShopDue(save.lastPurchaseDate, force)) process.exit(0)

console.log('\nstarting shop run...')
save.cartStatus = 'adding'
writeSave(save)

try {
  await shop(save.shoppingList)

  App.defaultBrowser().open(config.redmartCartUrl, FocusPolicy.Steal, Visibility.Show, true)

  save.lastPurchaseDate = new Date().toISOString().split('T')[0]
  save.cartStatus = 'ready'
  writeSave(save)
  console.log('\n✓ cart is ready — review and pay on Redmart.')
} catch (err) {
  save.cartStatus = 'error'
  writeSave(save)
  console.error(`\n✗ shop run failed: ${err}`)
}
