# MEET // NEURAL CORE

A recursive, data-driven "living neural network" portfolio. There are no pages
and no sections — every piece of content (About, Projects, Skills,
Experience, Research, Contact, Socials) is a node in one graph that the
visitor explores by hovering (preview) and clicking (lock open).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Click the pulsing node to trigger the boot
sequence.

```bash
npm run build && npm run start   # production build
```

## Edit your content — one place per topic

Everything on the site is generated from plain data files. You never need to
touch the rendering code to update content:

| What to change              | File                          |
| ---------------------------- | ------------------------------ |
| Name, tagline, About sentence, traits | `src/data/profile.ts`   |
| Projects + their architecture/tech/GitHub | `src/data/projects.ts` |
| Skills knowledge graph        | `src/data/skills.ts`          |
| Experience entries            | `src/data/experience.ts`      |
| Research / experiments        | `src/data/research.ts`        |
| Email, GitHub, LinkedIn, X links | `src/data/socials.ts`      |

Look for `// EDIT ME` comments — those mark the placeholder URLs
(`your-username`, `your-profile`, `you@example.com`) that need your real
links before deploying.

The `about` node has no children in the data — its content (the identity
sentence + role/interest/trait layers) is generated at runtime by the token
reconstruction engine in `src/components/neural/AboutTokens.tsx`, driven
entirely by `profile.ts`.

## How the graph works

- `src/lib/graph.ts` — the `GraphNodeDef` tree type + tree-walking utilities
  (parent map, node map, path-to-root).
- `src/data/graph.ts` — composes every data file into one tree rooted at
  `meet`.
- `src/lib/layout.ts` — radial layout engine: walks the tree and assigns an
  (x, y) to every node that is currently expanded (hovered or locked open).
  Nothing below an unopened branch gets a position, so this map doubles as
  "what should render right now."
- `src/hooks/useNeuralGraph.ts` — the interaction engine. Hover sets a
  transient `hoveredId` (children preview, no navigation). Click walks
  `activePath` from root to the clicked node (locks the branch open) or, if
  the same node is clicked again, pops one level back up. Action nodes
  (GitHub, email, LinkedIn…) fire immediately on click instead of expanding.
- `src/components/NeuralExperience.tsx` — orchestrates the four phases
  (`boot` → `landing` → `activation` → `network`) and renders the live graph:
  ambient canvas background + edges (`NeuralCanvas`), the recursive node
  buttons (`GraphNode`), the About token engine, and a contextual tooltip
  attached to whatever's hovered — no side panel, no modal.

## Accessibility & SEO

`src/components/AccessibleFallback.tsx` renders the same information as real
headings, paragraphs, and anchor tags. It's visually hidden (`.sr-fallback`
in `globals.css`) until focus lands inside it — reachable via the
"Skip visual experience" link in the top-left corner, so screen readers and
keyboard-only visitors still get the full portfolio content, and search
engines get real crawlable text.

`prefers-reduced-motion` is respected throughout: the boot/activation
sequences shorten dramatically and the core-pulse / ring-spin CSS animations
are disabled.

## Notes on this build

This was assembled and type-checked (`tsc --noEmit` against the project's
own `tsconfig.json`, using the ambient React types) in an environment
without registry access, so `npm install` has not been run here — dependency
versions in `package.json` are pinned to known-good releases but you should
run `npm install` yourself before `npm run dev`.
