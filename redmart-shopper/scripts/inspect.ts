import { App, FocusPolicy, Visibility, AccessibilityTree, TraversalOrder, AriaRole } from '@simular-ai/simulang-js'
import { config } from './config.ts'

const mode = process.argv[2] ?? 'search'
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function inspect() {
  const tree = AccessibilityTree.fromForeground()

  console.log('\n=== Buttons ===')
  const buttons = tree.find(TraversalOrder.BreadthFirst, AriaRole.Button, null, true, 50)
  buttons.forEach(b => console.log(`  [${b.refId}] "${b.name}"`))

  console.log('\n=== Links ===')
  const links = tree.find(TraversalOrder.BreadthFirst, AriaRole.Link, null, true, 20)
  links.forEach(l => console.log(`  [${l.refId}] "${l.name}"`))

  console.log('\n=== Window title ===')
  console.log(' ', tree.windowTitle)
}

if (mode === 'search') {
  // Inspect the search results page
  App.defaultBrowser().open(
    'https://www.lazada.sg/catalog/?q=oat%20milk&m=redmart',
    FocusPolicy.Steal, Visibility.Show, true,
  )
  await sleep(3000)
  inspect()
} else if (mode === 'product') {
  // Navigate to search, click the first product link, then inspect the product page
  App.defaultBrowser().open(
    'https://www.lazada.sg/catalog/?q=oat%20milk&m=redmart',
    FocusPolicy.Steal, Visibility.Show, true,
  )
  await sleep(3000)

  const searchTree = AccessibilityTree.fromForeground()
  const productLinks = searchTree.find(TraversalOrder.BreadthFirst, AriaRole.Link, null, true, 30)
  const firstProduct = productLinks.find(l => l.name.startsWith('Product'))

  if (firstProduct?.refId != null) {
    console.log(`Clicking: "${firstProduct.name.split('\n')[0]}"`)
    searchTree.activate(firstProduct.refId)
    await sleep(3000)
    inspect()
  } else {
    console.error('No product links found on search page')
  }
} else if (mode === 'cart') {
  // Navigate to cart page and inspect
  App.defaultBrowser().open(
    config.redmartCartUrl,
    FocusPolicy.Steal, Visibility.Show, true,
  )
  await sleep(3000)
  inspect()
} else {
  console.error(`Unknown mode: ${mode}`)
  console.log('Usage: npm run inspect -- [search|product|cart]')
}
