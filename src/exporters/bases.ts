/**
 * Bases dashboard generator.
 *
 * Writes three .base files into the Dayflow output folder that surface the
 * frontmatter we already emit. Generated once on first sync (or on demand
 * via the settings button); we don't overwrite once the user has them so
 * customizations stick.
 */
import type { Vault } from 'obsidian';
import { writeIfChanged } from '../util/io.js';
import { fileExistsInVault } from '../util/io.js';

interface BaseSpec {
  filename: string;
  content: string;
}

const RECENT_DAYS_BASE = `# Last 30 Dayflow days as a card gallery. Click any card to open the note.
filters:
  and:
    - file.hasTag("dayflow")
    - file.hasTag("timeline")

formulas:
  hours: '(total_minutes / 60).toFixed(1) + "h"'
  top_category: 'if(categories, categories[0], "")'
  focus_status: 'if(focus_pct == null, "—", if(focus_pct >= 100, "✅ " + focus_pct + "%", focus_pct + "%"))'

properties:
  file.name:
    displayName: "Day"
  formula.hours:
    displayName: "Tracked"
  formula.top_category:
    displayName: "Top category"
  formula.focus_status:
    displayName: "Focus"
  total_cards:
    displayName: "Cards"

views:
  - type: cards
    name: "Recent days"
    limit: 30
    order:
      - file.name
      - formula.hours
      - formula.top_category
      - formula.focus_status
      - total_cards
`;

const WEEKLY_REVIEW_BASE = `# Every Dayflow weekly note in a single sortable table.
filters:
  and:
    - file.hasTag("dayflow")
    - file.hasTag("weekly")

formulas:
  hours: '(total_minutes / 60).toFixed(1) + "h"'
  top_category: 'if(categories, categories[0], "")'

properties:
  file.name:
    displayName: "Week"
  formula.hours:
    displayName: "Tracked"
  formula.top_category:
    displayName: "Top category"
  total_cards:
    displayName: "Cards"
  from:
    displayName: "From"
  to:
    displayName: "To"

views:
  - type: table
    name: "All weeks"
    order:
      - file.name
      - from
      - to
      - formula.hours
      - total_cards
      - formula.top_category
`;

const FOCUS_PERFORMANCE_BASE = `# Days where a focus goal was set — sorted by goal achievement.
filters:
  and:
    - file.hasTag("dayflow")
    - file.hasTag("timeline")
    - 'focus_target_minutes != null'

formulas:
  status: 'if(focus_pct >= 100, "✅ Hit", if(focus_pct >= 75, "🟡 Close", "🔴 Miss"))'
  target_h: '(focus_target_minutes / 60).toFixed(1) + "h"'
  actual_h: '(focus_actual_minutes / 60).toFixed(1) + "h"'

properties:
  file.name:
    displayName: "Day"
  formula.status:
    displayName: "Result"
  formula.actual_h:
    displayName: "Focused"
  formula.target_h:
    displayName: "Target"
  focus_pct:
    displayName: "%"

views:
  - type: table
    name: "Focus performance"
    order:
      - file.name
      - formula.status
      - focus_pct
      - formula.actual_h
      - formula.target_h
    groupBy:
      property: formula.status
      direction: DESC
`;

const SPECS: BaseSpec[] = [
  { filename: 'Recent days.base', content: RECENT_DAYS_BASE },
  { filename: 'Weekly review.base', content: WEEKLY_REVIEW_BASE },
  { filename: 'Focus performance.base', content: FOCUS_PERFORMANCE_BASE },
];

/**
 * Install Bases dashboards in the output folder. By default skips files
 * that already exist so user customizations survive; pass overwrite=true
 * to re-install from scratch.
 */
export async function installBases(
  vault: Vault,
  outputFolder: string,
  overwrite = false
): Promise<{ written: string[]; skipped: string[] }> {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const spec of SPECS) {
    const path = `${outputFolder.replace(/\/+$/, '')}/${spec.filename}`;
    if (!overwrite && (await fileExistsInVault(vault, path))) {
      skipped.push(path);
      continue;
    }
    await writeIfChanged(vault, path, spec.content);
    written.push(path);
  }
  return { written, skipped };
}
