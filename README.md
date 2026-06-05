# Dayflow for Obsidian

Bring [Dayflow](https://github.com/JerryZLiu/Dayflow) into your Obsidian vault.

This plugin reads Dayflow's `chunks.sqlite` **read-only** and writes daily + weekly notes into your vault, with inline SVG charts, Bases dashboards, optional ActivityWatch enrichment, and a side-pane Today view that refreshes after every sync.

**Local-first. Zero network calls.** (Except optional `localhost:5600` when you opt in to ActivityWatch enrichment.)

---

## What you get

### Daily notes
A `> [!info] Day at a glance` callout at the top, then your standup, intentions, full timeline (with thumbs-up/down ratings inline), reflections, distractions, top apps, and goal categories. Frontmatter exposes every signal — `total_minutes`, `focus_pct`, `categories`, `top_apps`, etc. — so Bases and Dataview can slice it freely.

<img width="500" alt="image" src="https://github.com/user-attachments/assets/7e35768e-c575-4cf8-a9c3-c64e5ed0a076" />
<img width="500" alt="image" src="https://github.com/user-attachments/assets/5ee36710-7b44-4b42-8f44-5fac59dcea4b" />


### Weekly notes
Inline SVG charts that read in both light and dark themes:
- **Treemap** of time per category
- **Bar chart** of category totals
- **Focus heatmap** — hours × days
- **Sankey** of app-to-app transitions

<img width="500" alt="image" src="https://github.com/user-attachments/assets/f883e4c7-f5af-4e4a-a10e-175ec63210b5" />
<img width="500" alt="image" src="https://github.com/user-attachments/assets/21213720-ad81-416f-8ba7-b6aec43ee3a7" />
<img width="500" alt="image" src="https://github.com/user-attachments/assets/a845cd60-9b5e-425e-8d68-2474949c2d27" />


### Side-pane Today view
A live-rendered view of today's note with a refresh button and last-sync indicator. Refreshes automatically after every sync.

<img width="700" alt="image" src="https://github.com/user-attachments/assets/793c0279-bf5c-4730-9b27-8b89868ea3e9" />


### Bases dashboards
One click installs three `.base` files:
- **Recent days** — card gallery of the last 30 days
- **Weekly review** — sortable table of every weekly note
- **Focus performance** — table grouped by goal hit / close / miss

<img width="700" alt="image" src="https://github.com/user-attachments/assets/191770b0-cee5-483d-98d0-2e7cf7ad4885" />


### ActivityWatch enrichment (opt-in)
Flip a toggle to query your local ActivityWatch and get precise per-app minutes under every Dayflow timeline card, plus a full per-day app breakdown. Web-tab noise filtered to active-browser windows only.

### Status bar + commands
- Status bar: `Dayflow · synced 12m ago` — click to sync now
- Commands: `Sync now`, `Open today's note`, `Open this week's note`, `Open Today side pane`
- Ribbon icons: sync + Today view

---

## Install

### Via [BRAT](https://github.com/TfTHacker/obsidian42-brat) (recommended for now)
1. Install BRAT from Obsidian's community plugin store
2. `Cmd+P → BRAT: Add a beta plugin`
3. Paste `caezium/obsidian-dayflow-plugin`
4. Enable **Dayflow** in Settings → Community plugins

### Manual install
1. Download `main.js`, `manifest.json`, `styles.css`, `sql-wasm.wasm` from the latest [release](https://github.com/caezium/obsidian-dayflow-plugin/releases)
2. Place them in `<vault>/.obsidian/plugins/dayflow/`
3. Reload Obsidian, then enable **Dayflow** in Settings → Community plugins

### Requirements
- macOS (Dayflow.app is macOS-only)
- [Dayflow](https://dayflow.space) installed and recording activity
- Obsidian 1.5.0 or newer

---

## Setup

After enabling the plugin:

1. Open **Settings → Dayflow**
2. Confirm the **Output folder** (default `30_resources/Dayflow`)
3. Click **Install Bases dashboards** to drop the three `.base` files
4. (Optional) Toggle **Enable ActivityWatch sync** if you have ActivityWatch running
5. Trigger your first sync: `Cmd+P → Dayflow: Sync now`

Your daily and weekly notes appear under the configured folder. Open the side pane via `Cmd+P → Open Today side pane` or by clicking the activity icon in the ribbon.

---

## Settings

| Group | Setting | Default | What it does |
|---|---|---|---|
| Output | `outputFolder` | `30_resources/Dayflow` | Vault folder for all generated notes |
| Sync | `syncDays` | `3` | How many days back each sync covers |
| Sync | `skipDaysBefore` | (empty) | YYYY-MM-DD lower bound. Days before this are never synced. |
| Sync | `syncOnStartup` | `true` | Run a sync 5s after Obsidian opens |
| Sync | `intervalMinutes` | `30` | Background sync interval. `0` disables. |
| Sync | `dbPath` | (empty) | Override path to `chunks.sqlite` |
| Formatting | `categoryWikilinks` | `true` | Render categories as `[[wikilinks]]` |
| Formatting | `includeDeleted` | `false` | Include cards marked deleted in Dayflow |
| Formatting | `appendToDailyNote` | `false` | Stamp a callout into your existing Daily Notes file |
| ActivityWatch | `awEnabled` | `false` | Off by default — flip on if you have AW running |
| ActivityWatch | `awUrl` | `http://localhost:5600` | Your AW server URL |
| ActivityWatch | `awWebBrowserOnly` | `true` | Filter web events to active-browser windows only |

---

## Privacy

- **Read-only SQLite** — the plugin opens `chunks.sqlite` with `wasmBinary` + `sql.js` in read-only mode. It cannot modify Dayflow's data, even by accident.
- **Zero network calls by default.** The only network code path is the optional ActivityWatch enrichment, which only ever talks to `localhost:5600`.
- **No telemetry.** No analytics, no error reporting, no remote logging.
- **Desktop-only.** `isDesktopOnly: true` in the manifest. Runtime guard via `Platform.isMobile` means even if loaded on mobile, the plugin no-ops cleanly with a one-line explainer.
- **Build provenance.** Every release is built in GitHub Actions and signed with a [sigstore](https://www.sigstore.dev/) attestation linking the binary to its exact source commit. Verify with `gh attestation verify main.js --owner caezium`.

You can audit the network surface with `grep -RIE 'fetch\(|axios|requestUrl|XMLHttpRequest|https?://' src/`. The only matches will be inside `src/data/activitywatch.ts` (gated behind the `awEnabled` toggle) and the SVG XML namespace (`http://www.w3.org/2000/svg`) which is not a network call.

---

## Build

```bash
git clone https://github.com/caezium/obsidian-dayflow-plugin
cd obsidian-dayflow-plugin
npm install
npm run build   # type-check + bundle to main.js
```

Output: `main.js` (CJS bundle, ~150 KB), `sql-wasm.wasm` (~644 KB) copied from `node_modules/sql.js/dist/`. Drop those + `manifest.json` + `styles.css` into `<vault>/.obsidian/plugins/dayflow/`.

---

## Architecture notes

- **`src/db.ts`** — `sql.js` wrapper. Reads `sql-wasm.wasm` via Node `fs` and passes it via `wasmBinary` because `sql.js`'s default `fetch()` path fails in Electron's renderer.
- **`src/data/`** — One module per Dayflow table: timeline, journal, standup, goals, ratings, observations. Each gracefully degrades when a table is missing (for older Dayflow schemas).
- **`src/aggregators/`** — Pure functions that turn rows into category breakdowns, per-app totals, focus heatmaps, etc.
- **`src/viz/`** — Pure-JS SVG generators (treemap, heatmap, sankey, bars). All text uses `fill="currentColor"` so it inherits the user's theme.
- **`src/exporters/`** — Daily-note + weekly-note + Bases + daily-note-stamp.
- **`src/ui/today-view.ts`** — Side-pane `ItemView` that uses `MarkdownRenderer.render()` to embed today's note.
- **`src/data/activitywatch.ts`** — REST calls via Obsidian's `requestUrl` (fetch/axios are CORS-blocked). Auto-discovers window/web/afk buckets.

---

## Acknowledgements

- [Dayflow](https://github.com/JerryZLiu/Dayflow) by Jerry Liu — the app that captures everything

---

## License

MIT — see [LICENSE](LICENSE).
