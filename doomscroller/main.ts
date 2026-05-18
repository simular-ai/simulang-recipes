import { App, FocusPolicy, Visibility, GroundingModel } from '@simular-ai/simulib-js'
import { moveTo, scrollDown, screenCenter, sleep } from './controls.ts'
import { getLikesAndShares, getVideoLink } from './tiktok.ts'
import { sendDM } from './slack.ts'
import { VIDEOS_TO_SCROLL, MIN_LIKES, MIN_SHARES, SLACK_FRIEND, SCROLL_PAUSE_MS } from './config.ts'
import { fmt } from './utils.ts'

const model = GroundingModel.default()
const [centerX, centerY] = screenCenter()

process.on('SIGINT', () => { console.log('\nInterrupted.'); process.exit(0) })

const browser = App.defaultBrowser()
browser.open('https://www.tiktok.com', FocusPolicy.Steal, Visibility.Show, true)
await sleep(3000)
moveTo(centerX, centerY)

console.log(`Scrolling through ${VIDEOS_TO_SCROLL} videos, looking for likes > ${MIN_LIKES.toLocaleString()} and shares > ${MIN_SHARES.toLocaleString()}\n`)

let watched = 0
let shared  = 0

while (watched < VIDEOS_TO_SCROLL) {
  await sleep(SCROLL_PAUSE_MS)

  const { likes, shares } = getLikesAndShares()

  console.log(`Video ${watched + 1}: likes=${fmt(likes)} shares=${fmt(shares)}`)

  if (likes >= MIN_LIKES && shares >= MIN_SHARES) {
    console.log(`  ✓ Meets threshold — sharing to ${SLACK_FRIEND}`)

    const link = await getVideoLink(model)
    if (!link) {
      console.log('  Could not get link — skipping')
    } else {
      await sendDM(link, SLACK_FRIEND, model)
      console.log(`  Sent to ${SLACK_FRIEND}: ${link}`)
      shared++
    }

    browser.open('https://www.tiktok.com', FocusPolicy.Steal, Visibility.Show, true)
    await sleep(3000)
    moveTo(centerX, centerY)
  }

  watched++
  moveTo(centerX, centerY)
  scrollDown()
}

console.log(`\nDone — watched ${watched} videos, shared ${shared}.`)
process.exit(0)
