# Portfolio knowledge graphs

## Framework decision

| | Cytoscape.js 3.34.3 | Sigma.js 4 |
|---|---|---|
| Rendering | Canvas; works without GPU acceleration | WebGL; strongest at very large rendered networks |
| Graph interactions | Built-in selection, events, styles, layouts and graph operations | Interactive rendering; Graphology supplies graph storage/algorithms |
| Pigeon fit | Best for a bounded, richly interactive desktop panel | Better if a future requirement is rendering tens of thousands of nodes simultaneously |

**Chosen: Cytoscape.js.** Pigeon supports machines with GPU acceleration disabled, and an overview containing every file and pairwise edge would be unreadable. Sigma's rendering scale is attractive, but not needed for the bounded overview/neighborhood approach. The yFiles showcase is visual inspiration (colored clusters, prominent hubs, fine links, pan/zoom), not a copied commercial component.

References: [Cytoscape.js documentation](https://js.cytoscape.org/), [Sigma.js](https://www.sigmajs.org/), [Sigma README](https://github.com/jacomyal/sigma.js), [yFiles example](https://www.yfiles.com/demos/showcase/knowledge-graphs/).

## Using the panel

- Toggle the colored network icon in the top bar. Thumbnails remain on its left; the inspector remains on its right.
- **Overview** displays 250, 600 (default), or 1,200 deterministically sampled files. Semantic clusters, file types, and tags are available as grouping modes.
- Click a hub to zoom into its sampled group. Click a file to select its thumbnail/inspector and explore its vector neighbors across the indexed portfolio, not just the overview sample.
- Focused neighborhoods contain at most 80 neighbors. They show cosine-based root connections and a bounded number of strong neighbor-to-neighbor connections.
- Drag to pan, scroll to zoom, or use zoom/fit controls. Nodes can be rearranged by dragging. Search highlights visible names/tags. A keyboard-accessible file list is available below the graph.
- View settings, last root and camera are kept separately for each portfolio. Hide/show retains the view.

## What connections mean

The graph reads actual stored EmbeddingGemma 2 embeddings. It normalizes and averages metadata (part 0) and the first content embedding (part 1) when available. Completed metadata-only files can therefore appear. This representative is deliberately bounded; it does **not** consider every later audio/video/document segment. Semantic search still searches all indexed segments.

Semantic groups are computed by deterministic clustering of the sampled representatives. Their connecting edges compare cluster centroids. Focused file edges compare representatives directly using cosine similarity. These are semantic similarities, **not authored facts or confidence probabilities**. Tag/type groups are metadata groupings, not inferred ontologies.

Overview sampling is explicitly indicated. Focus scans are bounded by 150,000 representative vector rows and a 14-second calculation deadline; partial scans are identified. The graph worker has a 192 MB JavaScript heap limit and an 18-second request timeout. No portfolio-wide all-pairs comparison is performed.

## Data and safety

The graph runs in a separate worker with SQLite opened read-only. Opening it does not initialize a model, download anything, change vectors, or modify checkpoints. It excludes unauthorized, encrypted, missing, deleted, pending, stale, metadata-dirty and incompatible-version entries. Results are revalidated against the current portfolio and fingerprints; changing portfolios cancels old requests. Locking/removing displayed assets clears and reloads the graph.

The panel is local/offline. Cytoscape is bundled with the application; no CDN is used.

## Analyze-now queue

Analyze now puts the selected scope at the front, handling its direct items before descendant items. It appends the interrupted scope behind previously queued scopes (FIFO). Once the selected subtree finishes, queued scopes resume; remaining unanalysed portfolio items are last. Overlapping scopes never duplicate pending work, and unchanged completed items reuse their index.

Each worker batch advances just **one segment**. Switching happens after that segment commits, not after completing the old file, preserving its cursor and vectors. Queue intent is persisted per portfolio and survives restart. Folder/collection/smart-folder scopes are resolved from the complete library, not the visible thumbnail window.

Analyze now explicitly overrides activity waits, like Continue; CPU/memory caps and memory-pressure safeguards remain enforced. Pause on activity can be re-enabled at any time. Technical details display the active scope and queued scopes.

Semantic search's similarity slider and backend default are **0.68**. The graph's independent connection threshold defaults to 0.50.
