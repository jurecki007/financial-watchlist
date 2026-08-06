/**
 * Parses ROADMAP.md into the projection published at /roadmap.
 *
 * Content is opted IN, never out: this reads checkbox lines under `### Phase N`
 * headings and the name column of the add-ons table, and nothing else. The file
 * also holds build-strategy notes written for us rather than for an audience,
 * so no future edit to it can reach the live page.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ItemState = "shipped" | "blocked" | "pending";

export type Item = {
  state: ItemState;
  /** The item itself, with any trailing annotation split off. */
  text: string;
  /** The part after an em dash: a PR number, a live URL, what it waits on. */
  note?: string;
};

export type Group = {
  /** Bold sub-heading inside a phase, e.g. "Landing page". */
  label?: string;
  items: Item[];
};

export type Phase = {
  number: number;
  title: string;
  groups: Group[];
  shipped: number;
  total: number;
};

export type Roadmap = {
  phases: Phase[];
  /** Add-on names only. Effort and impact columns are never read. */
  next: { name: string; done: boolean }[];
  shipped: number;
  total: number;
};

const CHECKBOX = /^-\s+\[( |x)\]\s+(.*)$/i;
const PHASE_HEADING = /^###\s+Phase\s+(\d+)\s*[—-]\s*(.+)$/;
/**
 * Entirely bold, not merely starting with a bold clause — otherwise
 * "**Phase 1 complete.** Two follow-ups…" becomes a heading.
 */
const GROUP_LABEL = /^\*\*(.+?)\*\*:?\s*$/;
const MVP_HEADING = /^##\s+.*MVP/;
const ADDON_HEADING = /^##\s+.*Add-ons/;

/** Strips markdown that would render as literal punctuation in JSX. */
function clean(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/~~/g, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\*/g, "")
    .trim();
}

/** Read from the prose the author already writes, so there is no second place to sync. */
function stateOf(checked: boolean, note: string | undefined): ItemState {
  if (checked) return "shipped";
  if (note && /blocked|waiting on/i.test(note)) return "blocked";
  return "pending";
}

function parseItem(checked: boolean, body: string): Item {
  // Split on the em dash that separates an item from its annotation. Only the
  // first one — later dashes belong to the note.
  const [head, ...rest] = body.split(/\s+—\s+/);
  const note = rest.length ? clean(rest.join(" — ")) : undefined;
  return { state: stateOf(checked, note), text: clean(head), note };
}

export function parseRoadmap(markdown: string): Roadmap {
  const lines = markdown.split("\n");
  const phases: Phase[] = [];
  const next: { name: string; done: boolean }[] = [];

  let section: "none" | "mvp" | "addons" = "none";
  let phase: Phase | null = null;
  let group: Group | null = null;

  for (const line of lines) {
    if (MVP_HEADING.test(line)) {
      section = "mvp";
      continue;
    }
    if (ADDON_HEADING.test(line)) {
      section = "addons";
      phase = null;
      continue;
    }
    // Any other level-2 heading closes the allowlisted region. This is what
    // makes new sections private by default.
    if (/^##\s+/.test(line)) {
      section = "none";
      phase = null;
      continue;
    }

    if (section === "mvp") {
      const heading = line.match(PHASE_HEADING);
      if (heading) {
        phase = {
          number: Number(heading[1]),
          title: clean(heading[2]),
          groups: [],
          shipped: 0,
          total: 0,
        };
        phases.push(phase);
        group = null;
        continue;
      }
      if (!phase) continue;

      const checkbox = line.match(CHECKBOX);
      if (checkbox) {
        if (!group) {
          group = { items: [] };
          phase.groups.push(group);
        }
        const item = parseItem(checkbox[1].toLowerCase() === "x", checkbox[2]);
        group.items.push(item);
        phase.total += 1;
        if (item.state === "shipped") phase.shipped += 1;
        continue;
      }

      const label = line.match(GROUP_LABEL);
      if (label && !line.startsWith("- ")) {
        group = { label: clean(label[1]), items: [] };
        phase.groups.push(group);
      }
      continue;
    }

    if (section === "addons" && line.startsWith("|")) {
      const cells = line.split("|").map((c) => c.trim());
      // | # | Add-on | Effort | Impact |  →  cells[2] is the name.
      // Columns 3 and 4 are deliberately never read.
      const name = cells[2];
      if (!name || /^-+$/.test(name) || name === "Add-on") continue;
      next.push({ name: clean(name), done: name.includes("~~") });
    }
  }

  // Drop phases that parsed to nothing rather than rendering an empty shell.
  const kept = phases.filter((p) => p.total > 0);

  return {
    phases: kept,
    next,
    shipped: kept.reduce((n, p) => n + p.shipped, 0),
    total: kept.reduce((n, p) => n + p.total, 0),
  };
}

/** Reads ROADMAP.md from the repo root at build time. */
export function loadRoadmap(): Roadmap {
  const markdown = readFileSync(join(process.cwd(), "ROADMAP.md"), "utf8");
  return parseRoadmap(markdown);
}
