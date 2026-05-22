# Contributing to SimuLang Recipes

We'd love to have your recipe here! Here's everything you need to know to get it in.

## How It Works

1. Fork this repo and create a branch for your recipe
2. Add a new folder at the root — see naming tips below
3. Follow the recipe structure and README template
4. Open a PR with a short description of what your recipe does
5. We'll review it and may suggest small tweaks before merging

## Naming Your Folder

Use kebab-case, and name it after what the recipe **does** rather than how it works:

| Good | Bad |
|------|-----|
| `gmail-inbox-summarizer` | `automation-1` |
| `github-pr-reviewer` | `my-script` |
| `notion-daily-planner` | `test` |

## What to Include

```
your-recipe-name/
├── main.ts          # Your Simulang script (required)
├── README.md        # Docs following the template below (required)
├── package.json     # Dependencies (required if you use any npm packages)
├── package-lock.json  # Committed deliberately for reproducibility
└── ...              # Any other files your recipe needs
```

If your script uses vision grounding or `AskModel`, it needs `OPENROUTER_API_KEY`. Document this in your README's **How to Run** section — users set it once in their shell profile (`export OPENROUTER_API_KEY=...` in `~/.zshrc`), not per-recipe.

## README Template

Each recipe README should have these 6 sections:

```markdown
# Recipe Name

## Description
2–3 sentences on what this automates, which apps or sites it touches,
and which Simulang APIs it uses.

## Demo
<!-- A GIF or video showing the automation running -->
![Demo](demo.gif)

## Key APIs Used
- `App.defaultBrowser().open()` — launches and attaches to the browser
- `tree.find()` — searches the accessibility tree by role and label
- `tree.activate(refId)` — clicks an element
- `tree.setValue(refId, text)` — types into a text field

## How to Run
**Prerequisites:**
- Simulang installed (`simulang run` available in your terminal)
- `OPENROUTER_API_KEY` required — [see setup instructions](README.md#api-key-setup) *(or "No API key required" if none needed)*

**Steps:**
1. `cd your-recipe-name`
2. `simulang run main.ts`

Tip: `simulang run -i` opens an interactive REPL — great for exploring the accessibility tree before writing the full script.

## Workflow Diagram
\```
[Open app] → [Snapshot tree] → [Find element] → [Act on refId] → [Output result]
\```

## Notes
Anything worth knowing — limitations, gotchas, or ways to adapt this recipe.
```

## Before You Submit

- [ ] Script runs end-to-end without errors (`simulang run main.ts`)
- [ ] Demo GIF or video included (strongly recommended — dramatically increases discoverability)
- [ ] No hardcoded secrets — env vars documented in README if any are needed
- [ ] README has all 6 sections
- [ ] Folder name is kebab-case and describes the automation
