# Doomscroller

## Description

Scrolls TikTok's For You feed and watches for videos that cross a like and share threshold. When one is found, it copies the link via TikTok's share sheet and sends it to a friend on Slack. Uses the accessibility tree to read counts and vision grounding to navigate the share sheet and Slack sidebar.

## Demo

![Demo](demo.gif)

## Key APIs Used

- `AccessibilityTree.fromForeground()` — reads live like and share counts from TikTok's page
- `screenshot.ground(model, concept)` — locates the copy link button in the share sheet and the friend's DM in Slack's sidebar
- `Clipboard` — reads the video link after TikTok copies it to clipboard
- `App.exactName()` / `App.defaultBrowser()` — switches focus between TikTok and Slack
- `MouseController` — re-centers the cursor over the feed before each scroll

## How to Run

**Prerequisites:**

- simulang installed (`simulang run` available in your terminal)
- Slack desktop app installed and logged in
- `OPENROUTER_API_KEY` required — [see setup instructions](../README.md#api-key-setup)

**Steps:**

1. `cd doomscroller`
2. `npm install`
3. Edit `config.ts` to set your thresholds and the Slack friend's name
4. `simulang run main.ts`

## Workflow Diagram

```
[Open TikTok] → [Center cursor]
  → loop:
      [Read like/share counts from accessibility tree]
      → [Threshold met?]
      → yes: [Activate share button via tree refId]
             → [Ground copy link button → click]
             → [Read clipboard]
             → [Open Slack → ground DM in sidebar → click]
             → [Find compose textbox from tree → type link → send]
             → [Return to TikTok → center cursor]
      → [Center cursor → scroll down]
```

## Notes

- **Why tree for counts, grounding for the rest?** TikTok exposes like and share counts as labelled accessibility nodes (`"Like video 757.8K likes"`), so they can be read with zero model calls. The share sheet and Slack sidebar have no stable accessible names, so grounding fills that gap.
- **Two nodes per video:** TikTok preloads the next video, so the tree always has two like/share node pairs. The script picks the one with the smallest top y — that's the current video.
- **Slack DM visibility:** Grounding only finds the friend if their DM is visible in the sidebar. Make sure Slack is open and the conversation is in view before running.
- **Tuning:** Edit `config.ts` to change `MIN_LIKES`, `MIN_SHARES`, `VIDEOS_TO_SCROLL`, and `SLACK_FRIEND`.
