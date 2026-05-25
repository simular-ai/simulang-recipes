import {
  App,
  FocusPolicy,
  Visibility,
  AccessibilityTree,
  AriaRole,
  TraversalOrder,
  GroundingModel,
  screenshotFull,
} from '@simular-ai/simulang-js'
import { click, typeText, pressEnter, sleep } from './controls.ts'

export async function sendDM(message: string, friend: string, model: GroundingModel): Promise<void> {
  const slack = App.exactName('Slack').open(null, FocusPolicy.Steal, Visibility.Show, true)
  await sleep(1000)

  // Capture the screen Slack is on — Slack may live on a different monitor
  // than the browser (a common dual-monitor layout).
  const slackScreen = slack.windows()[0]?.screen()
  if (!slackScreen) throw new Error('Slack window not found')

  click(...screenshotFull(true, slackScreen).ground(model, `"${friend}" direct message item in the Slack left sidebar`))
  await sleep(3000)

  const tree = AccessibilityTree.fromPid(slack.pid)
  const nodes = tree.find(TraversalOrder.BreadthFirst)

  const inputs = nodes.filter((n) => n.role === AriaRole.Textbox && n.refId !== undefined)
  if (!inputs.length) throw new Error('Could not find Slack message input')

  const input = inputs.reduce((lowest, n) => (n.boundingBox.bottom > lowest.boundingBox.bottom ? n : lowest))

  tree.focusElement(input.refId!)
  await sleep(200)
  typeText(message)
  await sleep(200)
  pressEnter()
  await sleep(500)
}
