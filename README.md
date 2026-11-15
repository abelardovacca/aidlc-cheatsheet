# aidlc-cheatsheet

Interactive visual cheatsheet for [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) (AI-DLC).

**Live: <https://abelardovacca.github.io/aidlc-cheatsheet/>**

> Unofficial community project. Not affiliated with, endorsed by, or supported by Amazon Web Services.
> For authoritative behaviour, see the [AI-DLC documentation](https://github.com/awslabs/aidlc-workflows).

## What's in it

- **Scopes** across the top: pick one to filter the phases, stages, files and steps it runs.
  "Show skipped" brings back what the scope leaves out, greyed.
- **Depth, test strategy and ceremony switches** for the selected scope; hover for details.
- **Phases** side by side. Click a stage to see what it does, its input and output files, and its
  **flow diagram**: the same seven lanes for every stage (context → questions → summary → generate →
  review → learnings → gate, from `stage-protocol.md`), with the stage's own steps placed in their lanes
  and loops drawn as arrows.
- **File links**: hover a file to see animated lines to the stages that produce or consume it; click to
  pin them. When the other stage is open, the line connects file to file.
- **Project tree** of an AI-DLC workspace for the selected scope. Click a file to jump to the stage that writes it.
- **Commands** tab (`#commands`): chat commands (`/aidlc …`, or `$aidlc` on Codex) and terminal commands
  (`aidlc …`) grouped by topic, with a filter and click-to-copy.

Deep links: `?scope=mvp&open=requirements-analysis,code-generation`.

To run locally, open `index.html` in a browser. There is no build step.

## Refreshing the data

`aidlc-data.js` is generated from the stage and scope frontmatter in a local checkout of aidlc-workflows:

```sh
python3 scripts/extract.py            # defaults to ../aidlc/aidlc-workflows
python3 scripts/extract.py /path/to/aidlc-workflows
```

Needs Python 3 with PyYAML. Stage summaries, step gates (which steps depend on a scope setting) and the
lane rules (which flow lane each step belongs to) are hand-written in `scripts/extract.py`. The command
list in `commands.js` is hand-curated from the CLI and install guides. Review both when upstream changes.

## Publishing

Every push to `main` publishes the site to GitHub Pages through `.github/workflows/pages.yml`. It can
also be run by hand from the Actions tab.

## License

[MIT](LICENSE). Stage, scope and command content is derived from
[awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows), licensed under MIT-0.
