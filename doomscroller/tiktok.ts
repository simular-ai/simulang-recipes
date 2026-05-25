import {
  AccessibilityTree,
  TraversalOrder,
  Clipboard,
  GroundingModel,
  screenshotFull,
  type AccessibilityNodeJs,
  type Instance,
} from '@simular-ai/simulang-js'
import { click, sleep } from './controls.ts'

export interface Counts {
  likes: number
  shares: number
}

// Read counts from the browser's accessibility tree by PID — this works even
// when the browser isn't the frontmost window (e.g. Slack briefly took focus
// while we were sending the previous link).
export function getLikesAndShares(browser: Instance): Counts {
  const nodes = AccessibilityTree.fromPid(browser.pid).find(TraversalOrder.BreadthFirst)
  const current = (matches: AccessibilityNodeJs[]) =>
    matches.sort((a, b) => a.boundingBox.top - b.boundingBox.top).at(-2)

  const likeNode = current(nodes.filter((n) => n.name.toLowerCase().startsWith('like video')))
  const shareNode = current(nodes.filter((n) => n.name.toLowerCase().startsWith('share video')))

  return {
    likes: parseCount(likeNode?.name ?? ''),
    shares: parseCount(shareNode?.name ?? ''),
  }
}

export async function getVideoLink(browser: Instance, model: GroundingModel): Promise<string | null> {
  const tree = AccessibilityTree.fromPid(browser.pid)
  const nodes = tree.find(TraversalOrder.BreadthFirst)

  const shareNode = nodes
    .filter((n) => n.name.toLowerCase().startsWith('share video'))
    .sort((a, b) => a.boundingBox.top - b.boundingBox.top)[0]

  // The TikTok window may live on a non-primary monitor — capture the screen
  // it is actually on rather than guessing.
  const screen = browser.windows()[0]?.screen()
  if (!screen) throw new Error('TikTok browser window not found')

  if (shareNode?.refId !== undefined) {
    tree.activate(shareNode.refId)
  } else {
    click(...screenshotFull(false, screen).ground(model, 'share button'))
  }
  await sleep(800)

  click(...screenshotFull(false, screen).ground(model, 'copy link button'))
  await sleep(500)

  return new Clipboard().getString()
}

function parseCount(raw: string): number {
  const m = raw
    .toLowerCase()
    .replace(/,/g, '')
    .match(/(\d+(?:\.\d+)?)\s*([km])/)
  if (m) {
    const n = parseFloat(m[1])
    return m[2] === 'k' ? n * 1_000 : n * 1_000_000
  }
  const plain = raw.replace(/,/g, '').match(/\d+/)
  return plain ? parseInt(plain[0], 10) : 0
}
