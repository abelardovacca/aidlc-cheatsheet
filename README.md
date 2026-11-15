# aidlc-cheatsheet

Interactive visual cheatsheet for [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows).

Open `index.html` in a browser (no build, no server, no dependencies).

- **Scopes** across the top: pick one to hide (or dim) the phases, stages, files and steps it doesn't run.
- **Depth / test strategy / ceremony switches** show the selected scope's defaults.
- **Phases** side by side; click a stage to expand what it does, its input and output files
  (hover a file to see animated lines flowing from the stages that produce it, or to the stages that consume it) and its **flow diagram**: the same seven
  lanes for every stage (context → questions → summary → generate → review → learnings → gate, from
  `stage-protocol.md`), with the stage's own steps placed in their lanes and loops drawn as arrows
  (follow-ups, summary changes, plan approval, adversarial review, sensor refusal, gate revisions).
  Lanes and steps a scope turns off are greyed out or hidden.
- **Project tree** of an AI-DLC workspace for the selected scope. Click a file to jump to the stage that writes it.
- **Commands** tab (`index.html#commands`): chat commands (`/aidlc …`, or `$aidlc` on Codex) and terminal
  commands (`aidlc …`) grouped by topic, with a filter and click-to-copy. Hand-curated in `commands.js`
  from the CLI and install guides; update it when those change.

Deep links: `index.html?scope=mvp&open=requirements-analysis,code-generation`.

## Refreshing the data

`aidlc-data.js` is generated from the stage and scope frontmatter in the sibling repo:

```sh
python3 scripts/extract.py            # defaults to ../aidlc/aidlc-workflows
python3 scripts/extract.py /path/to/aidlc-workflows
```

Needs Python 3 with PyYAML. Stage summaries, step gates (which steps depend on a scope setting) and
the lane rules (which flow lane each step belongs to) are hand-written in `scripts/extract.py`. Review them when upstream stages change.
