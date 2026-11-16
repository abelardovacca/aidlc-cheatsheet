(() => {
  "use strict";
  const D = window.AIDLC;
  if (!D) { document.body.innerHTML = "<p style='padding:32px'>aidlc-data.js is missing. Run <code>python3 scripts/extract.py</code>.</p>"; return; }

  const stageBy = Object.fromEntries(D.stages.map(s => [s.slug, s]));
  const scopeBy = Object.fromEntries(D.scopes.map(s => [s.name, s]));
  const phaseIdx = Object.fromEntries(D.phases.map(p => [p.id, p.number]));
  const LEVELS = ["Minimal", "Standard", "Comprehensive"];
  const DEPTH_TEXT = {
    Minimal: "1–2 page artifacts with key decisions only; optional sections skipped.",
    Standard: "Complete artifacts with every required section and concise rationale.",
    Comprehensive: "Expanded artifacts with optional sections, detailed justification and compliance cross-references.",
  };
  const TEST_TEXT = {
    Minimal: "About one test per requirement plus a happy-path floor per component. Unit tests.",
    Standard: "5–8 tests per component. Unit and integration, roughly 75 / 20 / 5.",
    Comprehensive: "10–15 tests per component. Unit, integration, E2E, plus performance and security when NFRs exist.",
  };

  // ---------- state ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  const params = new URLSearchParams(location.search);
  const state = {
    scope: scopeBy[params.get("scope")] ? params.get("scope") : "all",
    showSkipped: store.get("aidlc.showSkipped") === "1",
    open: new Set((params.get("open") || "").split(",").filter(k => stageBy[k])),
    sel: Object.fromEntries((params.get("sel") || "").split(",").filter(v => v.includes(":")).map(v => v.split(":"))),
    toggledDirs: new Set(),
    pins: new Set(),
    focus: null,
  };

  // ---------- helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tip = html => ` data-tip="${esc(html)}"`;
  const sc = () => (state.scope === "all" ? null : scopeBy[state.scope]);
  const inScope = s => state.scope === "all" || s.scopes.includes(state.scope);
  const isInit = s => s.phase === "initialization";
  const pc = phase => `--pc: var(--p${phaseIdx[phase]})`;
  const agent = a => (a || "").replace(/^aidlc-/, "").replace(/-agent$/, "");
  const scopesOf = s => D.scopes.filter(x => s.scopes.includes(x.name));
  const list = names => (names.length ? names.join(", ") : "none");
  const off = (label, kind = "skip") => ({ kind, label });

  // ---------- gates ----------
  function stepGate(g) {
    return {
      note: g.note,
      test(x) {
        const v = g.flag === "depth" ? x.depth : g.flag === "testStrategy" ? x.testStrategy : x[g.flag];
        return v === g.when ? off({ skip: "skipped", partial: "reduced", notice: "notice only" }[g.kind], g.kind) : null;
      },
    };
  }
  function evalGate(gate, s) {
    const x = sc();
    if (x) return { res: gate.test(x) };
    return { hits: scopesOf(s).filter(y => gate.test(y)), total: s.scopes.length };
  }
  function flagHtml(ev) {
    if (!ev) return "";
    if (ev.res !== undefined) return ev.res ? `<span class="flag ${ev.res.kind}">${esc(ev.res.label)}</span>` : "";
    return ev.hits.length ? `<span class="flag var">varies</span>` : "";
  }
  function whyHtml(note, ev) {
    if (ev.res !== undefined) {
      const head = ev.res ? `<b class="${ev.res.kind}">${esc(ev.res.label)} in ${esc(state.scope)}.</b>` : `<b class="on">Runs in full in ${esc(state.scope)}.</b>`;
      return `<p class="why">${head} ${esc(note)}</p>`;
    }
    const head = ev.hits.length ? `<b class="partial">Changed in ${esc(list(ev.hits.map(h => h.name)))}.</b>` : `<b class="on">Runs in full in every scope.</b>`;
    return `<p class="why">${head} ${esc(note)}</p>`;
  }

  // ---------- files ----------
  function stageDir(s) {
    if (s.slug === "reverse-engineering") return "aidlc/spaces/<space>/codekb/<repo>/";
    if (s.slug === "workspace-scaffold") return "aidlc/spaces/<space>/intents/<YYMMDD>-<label>/";
    if (isInit(s)) return "<record>/";
    if (s.perUnit) return `<record>/construction/{unit}/${s.slug}/`;
    return `<record>/${s.phase}/${s.slug}/`;
  }
  function stageOutputs(s) {
    const x = sc();
    const files = [];
    for (const a of s.produces) files.push({ art: a, file: D.artifacts[a].file });
    for (const a of s.optionalProduces) files.push({ art: a, file: D.artifacts[a].file, optional: true });
    for (const c of s.conditionalFiles) {
      const ok = !x || LEVELS.indexOf(x.testStrategy) >= LEVELS.indexOf(c.minTest);
      files.push({ file: c.file, cond: c.minTest === "Comprehensive" ? "comprehensive tests" : "standard+ tests", na: !ok, optional: true });
    }
    if (!isInit(s)) {
      files.push({ file: "memory.md", cond: "learnings", na: x && x.learnings === "off", optional: true });
      if (s.reviewer) files.push({ file: "reviews/review-NN.md", cond: "reviews", na: x && x.reviewCap === "none", optional: true });
    }
    return files;
  }
  function ref(slug) {
    const t = stageBy[slug];
    if (!inScope(t) && !state.showSkipped) return "";
    if (!inScope(t)) return `<span class="ref out"${tip(`<b>${esc(t.name)}</b><br><span class="dim">Not in ${esc(state.scope)}</span>`)}>${t.number}</span>`;
    return `<button type="button" class="ref" data-go="${slug}"${tip(`<b>${esc(t.name)}</b><br><span class="dim">${esc(t.summary)}</span>`)}>${t.number}</button>`;
  }

  // ---------- mini markdown ----------
  function md(text) {
    let html = "", inList = false, para = [];
    const inline = l => esc(l).replace(/`([^`]+)`/g, "<code>$1</code>");
    const flush = () => { if (para.length) { html += `<p>${inline(para.join(" "))}</p>`; para = []; } };
    for (const raw of text.split("\n")) {
      const l = raw.trim();
      const m = l.match(/^(?:[-*]|\d+\.)\s+(.*)/);
      if (m) { flush(); if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(m[1])}</li>`; continue; }
      if (inList && raw.startsWith("  ") && l) { html = html.replace(/<\/li>$/, ` ${inline(l)}</li>`); continue; }
      if (inList) { html += "</ul>"; inList = false; }
      if (!l) { flush(); continue; }
      para.push(l);
    }
    flush(); if (inList) html += "</ul>";
    return html;
  }

  // ---------- intro ----------
  const SWITCHES = [
    { label: "Sensors", key: "sensors", what: "Deterministic checks on stage outputs; blocking ones can hold the gate." },
    { label: "Learnings", key: "learnings", what: "Per-stage memory.md diary and a learnings step before each gate." },
    { label: "Summary check", key: "summary_confirmation", what: "A “does this look correct?” checkpoint after questions, before artifacts are written." },
    { label: "Plan approval", key: "plan_approval", what: "Stop to approve each code plan before Code Generation builds it." },
    { label: "Collaborators", key: "collaborators", what: "Support agents join the stage lead. Off runs every stage lead-only." },
    { label: "Reviews", key: "reviewCap", what: "Reviewer agents give a second look. Advisory caps them at one non-blocking pass.",
      state: v => (v === "full" ? "on" : v === "advisory" ? "mid" : "off"), text: v => (v === "full" ? "Reviews" : v === "advisory" ? "Advisory reviews" : "No reviews") },
    { label: "Walking skeleton", key: "skeleton", what: "The first unit is built as a thin end-to-end slice before the rest." },
    { label: "Strict guard", key: "guardPolicy", what: "Changed inputs reopen approval rather than being announced and carried forward.", state: v => (v === "strict" ? "on" : "off") },
  ];
  function levelTip(kind, level) {
    const texts = kind === "depth" ? DEPTH_TEXT : TEST_TEXT;
    const who = D.scopes.filter(y => y[kind] === level).map(y => y.name);
    return `<b>${level}</b><br>${esc(texts[level])}<br><span class="dim">Default for ${esc(list(who))}</span>`;
  }
  function metric(label, kind, x) {
    const lvl = x[kind], i = LEVELS.indexOf(lvl);
    const pips = [0, 1, 2].map(j => `<i class="${j <= i ? "f" : ""}"></i>`).join("");
    const override = kind === "depth" ? "/aidlc --depth &lt;level&gt;" : "/aidlc --test-strategy &lt;level&gt;";
    return `<span class="metric"${tip(`${levelTip(kind, lvl)}<br><span class="dim">Override: ${override}</span>`)}><span class="k">${label}</span><span class="pips">${pips}</span>${lvl}</span>`;
  }

  function renderIntro() {
    document.getElementById("ver").textContent = `aidlc v${D.source.version}`;
    const pill = (name, label, t) => `<button type="button" class="scope ${state.scope === name ? "on" : ""}" data-scope="${name}" role="tab" aria-selected="${state.scope === name}"${t ? tip(t) : ""}>${esc(label)}</button>`;
    document.getElementById("scopes").innerHTML = pill("all", "All stages", "") + D.scopes.map(x => {
      const n = D.stages.filter(s => s.scopes.includes(x.name)).length;
      return pill(x.name, x.name, `${esc(x.description)}<br><span class="dim">${n} stages · ${x.depth} depth</span>`);
    }).join("");

    const x = sc();
    const line = document.getElementById("scopeLine");
    const prof = document.getElementById("profile");
    if (!x) {
      line.innerHTML = `The full lifecycle: ${D.phases.length} phases, ${D.stages.length} stages. Pick a scope to see what it runs.`;
      prof.innerHTML = "";
      return;
    }
    const n = D.stages.filter(inScope).length;
    line.innerHTML = `<b>${esc(x.name)}</b>${esc(x.description)}<span class="count">${n} of ${D.stages.length} stages</span>`;
    const sw = SWITCHES.map(w => {
      const v = x[w.key];
      const st = w.state ? w.state(v) : v === "on" ? "on" : "off";
      const txt = w.text ? w.text(v) : w.label;
      const onIn = D.scopes.filter(y => (w.state ? w.state(y[w.key]) : y[w.key] === "on" ? "on" : "off") === "on").map(y => y.name);
      return `<span class="sw ${st}"${tip(`<b>${esc(txt)}</b> · ${st === "on" ? "on" : st === "mid" ? "capped" : "off"}<br>${esc(w.what)}<br><span class="dim">On in ${esc(list(onIn))}</span>`)}>${esc(txt)}</span>`;
    }).join("");
    prof.innerHTML = `${metric("Depth", "depth", x)}${metric("Tests", "testStrategy", x)}<span class="sep"></span><span class="cer">${sw}</span>
      <button type="button" class="toggle" data-toggle-skipped aria-pressed="${state.showSkipped}">Show skipped <span class="knob"></span></button>`;
  }

  // ---------- flow ----------
  const LANES = [
    { id: "context", name: "Context", what: "Load the consumed artifacts, the agent persona and its knowledge." },
    { id: "questions", name: "Questions", what: "Write <stage>-questions.md, choose how to answer (guided, file or chat), then resolve ambiguities with follow-ups." },
    { id: "summary", name: "Summary", what: "Confirm a bulleted summary of the answers before anything is generated." },
    { id: "generate", name: "Generate", what: "Write the stage's artifacts. Execution mode decides who does the work." },
    { id: "review", name: "Review", what: "A reviewer agent gives the work a second look before you see it." },
    { id: "learnings", name: "Learnings", what: "Keep the memory.md diary and take the learnings step before the gate." },
    { id: "gate", name: "Gate", what: "Completion summary, then you approve or request changes." },
  ];
  function laneInfo(lane, s) {
    const init = isInit(s);
    const has = s.steps.some(st => st.lane === lane);
    switch (lane) {
      case "questions": return { exists: has && !init, why: init ? "automatic" : "none" };
      case "summary": return { exists: s.summaryConfirmation, why: init ? "automatic" : "not used", test: x => (x.summary_confirmation === "off" ? off("off") : null) };
      case "review": return { exists: !!s.reviewer, why: init ? "automatic" : "no reviewer",
        test: x => (x.reviewCap === "none" ? off("off") : x.reviewCap === "advisory" && s.reviewClass !== "advisory" ? off("advisory", "partial") : null) };
      case "learnings": return { exists: !init, why: "automatic", test: x => (x.learnings === "off" ? off("off") : null) };
      default: return { exists: true };
    }
  }
  function laneState(lane, s) {
    const info = laneInfo(lane, s);
    if (!info.exists) return { ...info, status: "na" };
    if (!info.test) return { ...info, status: "on" };
    const ev = evalGate(info, s);
    if (ev.res !== undefined) return { ...info, ev, status: ev.res ? (ev.res.kind === "skip" ? "off" : "partial") : "on" };
    return { ...info, ev, status: ev.hits.length ? "varies" : "on" };
  }
  function protoItems(lane, s) {
    const x = sc();
    const out = [];
    const effClass = x && x.reviewCap === "advisory" ? "advisory" : s.reviewClass;
    const sensorGate = { test: y => (y.sensors === "off" ? off("off") : null) };
    if (lane === "summary" && !s.steps.some(st => st.lane === "summary"))
      out.push({ k: "p-summary", t: "Confirm the consolidated summary", note: "A bulleted summary of every answer: Looks correct, or Request changes to go back to the questions." });
    if (lane === "generate" && s.sensors.length)
      out.push({ k: "p-sensors", t: "Sensors check outputs as they are written", note: `Imports ${s.sensors.join(", ")}. Findings are advisory at write time.`, gate: sensorGate });
    if (lane === "review")
      out.push({ k: "p-review", t: effClass === "adversarial" ? `${agent(s.reviewer)} challenges, lead repairs` : `${agent(s.reviewer)} gives one advisory pass`,
        note: effClass === "adversarial" ? `Refute-and-repair loop, up to ${s.reviewMax || 2} passes, before the work reaches you.` : "One pass as decision support for your gate; findings never block." });
    if (lane === "learnings" && !s.steps.some(st => st.lane === "learnings"))
      out.push({ k: "p-learn", t: "Diary and learnings question", note: "The memory.md diary is kept while working; the learnings step runs right before the gate." });
    if (lane === "gate" && !isInit(s) && s.sensors.length)
      out.push({ k: "p-block", t: "Blocking sensors checked", note: "A blocking sensor can refuse to open the gate: fix the findings or override them.", gate: sensorGate });
    return out;
  }
  function loopsFor(s, lanes) {
    const x = sc();
    const L = [];
    const live = id => ["on", "partial", "varies"].includes(lanes[id].status);
    if (live("questions")) L.push({ from: "questions", to: "questions", label: "follow-ups", kind: "q", what: "Ambiguous or contradictory answers get follow-up questions until resolved." });
    if (live("summary") && live("questions")) L.push({ from: "summary", to: "questions", label: "request changes", kind: "q", what: "Revise answers before generation." });
    if (s.slug === "code-generation" && (!x || x.plan_approval === "on")) L.push({ from: "generate", to: "generate", label: "plan approval", kind: "q", what: "The code plan is approved, or revised, before code is generated." });
    if (live("review") && s.reviewClass === "adversarial" && !(x && x.reviewCap === "advisory"))
      L.push({ from: "review", to: "generate", label: `repair, ≤${s.reviewMax || 2}`, kind: "r", what: "The lead fixes reviewer findings and the reviewer looks again." });
    if (!isInit(s)) {
      if (s.sensors.length && (!x || x.sensors === "on")) L.push({ from: "gate", to: "generate", label: "sensor refusal", kind: "s", what: "A blocking sensor refused the gate: fix the findings, then retry." });
      L.push({ from: "gate", to: "generate", label: "request changes", kind: "g", what: "Your feedback is applied and the gate is presented again. Accept as-is is offered after 3 rounds." });
    }
    return L;
  }
  function item(s, key, num, title, ev, proto) {
    const cut = ev && ev.res && ev.res.kind === "skip";
    if (cut && !state.showSkipped) return "";
    return `<button type="button" class="item ${proto ? "proto" : ""} ${cut ? "cut" : ""} ${state.sel[s.slug] === key ? "sel" : ""}" data-sel="${esc(s.slug)}|${esc(key)}">
      <span class="n">${esc(num)}</span><span class="t">${esc(title)}</span>${flagHtml(ev)}</button>`;
  }
  function renderFlow(s) {
    const x = sc();
    const lanes = {};
    LANES.forEach(l => { lanes[l.id] = laneState(l.id, s); });
    const loops = loopsFor(s, lanes);
    const rows = LANES.map(l => {
      const st = lanes[l.id];
      if (st.status === "off" && !state.showSkipped) return "";
      let small = "";
      if (st.status === "off") small = `<small>off</small>`;
      else if (st.status === "partial") small = `<small class="partial">${esc(st.ev.res.label)}</small>`;
      else if (st.status === "varies") small = `<small class="var">varies</small>`;
      let laneTip = `<b>${l.name}</b><br>${esc(l.what)}`;
      if (st.ev && st.ev.hits) laneTip += `<br><span class="dim">Changed in ${esc(list(st.ev.hits.map(h => h.name)))}</span>`;
      let body;
      if (st.status === "na") body = `<div class="na-txt">${esc(st.why)}</div>`;
      else {
        let ctx = "";
        if (l.id === "generate") {
          const collabOff = x && x.collaborators === "off";
          const sup = s.support.map(a => (collabOff ? `<s>${esc(agent(a))}</s>` : esc(agent(a)))).join(", ");
          ctx = `<div class="lane-ctx">${esc(s.mode)} · ${esc(agent(s.lead))}${sup ? ` with ${sup}` : ""}${s.perUnit ? " · once per unit" : ""}</div>`;
        }
        if (l.id === "gate" && isInit(s)) ctx = `<div class="lane-ctx">auto-proceeds, no approval</div>`;
        const steps = s.steps.filter(t => t.lane === l.id).map(t => item(s, t.n, t.n, t.title, t.gate ? evalGate(stepGate(t.gate), s) : null, false));
        const protos = protoItems(l.id, s).map(p => item(s, p.k, "◇", p.t, p.gate ? evalGate(p.gate, s) : null, true));
        const tags = loops.map((o, i) => (o.from === l.id ? `<span class="ltag k-${o.kind}" data-loop="${i}"${tip(`<b>${esc(o.label)}</b><br>${esc(o.what)}`)}>↺ ${esc(o.label)}</span>` : "")).join("");
        body = ctx + steps.join("") + protos.join("") + (tags ? `<div class="loops-tags">${tags}</div>` : "");
      }
      return `<div class="lane ${st.status}" data-lane="${l.id}"><div class="lane-name"${tip(laneTip)}>${l.name}${small}</div><div class="lane-items">${body}</div></div>`;
    }).join("");

    const selKey = state.sel[s.slug];
    let detail = "";
    if (selKey) {
      const t = s.steps.find(z => z.n === selKey);
      if (t) {
        const g = t.gate ? stepGate(t.gate) : null;
        detail = `<h5>Step ${esc(t.n)} · ${esc(t.title)}</h5>${g ? whyHtml(g.note, evalGate(g, s)) : ""}${md(t.text) || ""}`;
      } else {
        const p = LANES.flatMap(l => protoItems(l.id, s)).find(z => z.k === selKey);
        if (p) detail = `<h5>${esc(p.t)}</h5>${p.gate ? whyHtml(p.note, evalGate(p.gate, s)) : `<p>${esc(p.note)}</p>`}`;
      }
    }
    const exit = isInit(s) ? "Continues automatically to the next stage."
      : `Approve to continue${s.phase === "ideation" || s.phase === "inception" ? ", optionally adding a skipped stage" : ""}.`;
    return `<div class="flow" data-loops='${esc(JSON.stringify(loops.map(({ from, to, kind }) => ({ from, to, kind }))))}'>${rows}<svg aria-hidden="true"></svg></div>
      <p class="exit">${exit}</p>${detail ? `<div class="detail">${detail}</div>` : ""}`;
  }
  function drawFlows() {
    document.querySelectorAll(".flow").forEach(f => {
      const svg = f.querySelector("svg");
      const loops = JSON.parse(f.dataset.loops || "[]");
      const fr = f.getBoundingClientRect();
      const W = f.clientWidth, H = f.clientHeight;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
      const laneEl = id => f.querySelector(`.lane[data-lane="${id}"]`);
      const pos = i => {
        const t = f.querySelector(`.ltag[data-loop="${i}"]`);
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { x: r.right - fr.left, y: r.top - fr.top + r.height / 2 };
      };
      const gx = W - 54;
      const hits = {};
      let out = `<defs>${["q", "r", "s", "g"].map(k => `<marker id="m-${k}" class="k-${k}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L6,3 L0,6 z"/></marker>`).join("")}</defs>`;
      loops.map((o, i) => ({ ...o, i })).filter(o => o.from !== o.to && laneEl(o.from) && laneEl(o.to))
        .sort((a, b) => (laneEl(a.from).offsetTop - laneEl(a.to).offsetTop) - (laneEl(b.from).offsetTop - laneEl(b.to).offsetTop))
        .forEach((o, rail) => {
          const p = pos(o.i), to = laneEl(o.to);
          if (!p) return;
          const n = hits[o.to] = (hits[o.to] || 0) + 1;
          const ty = to.offsetTop + 15 + (n - 1) * 6;
          const rx = gx + 14 + rail * 11;
          out += `<path class="lp k-${o.kind}" d="M${p.x + 4},${p.y} H${rx - 4} Q${rx},${p.y} ${rx},${p.y - 4} V${ty + 4} Q${rx},${ty} ${rx - 4},${ty} H${gx + 2}" marker-end="url(#m-${o.kind})"/>`;
        });
      loops.forEach((o, i) => {
        if (o.from !== o.to) return;
        const p = pos(i);
        if (p) out += `<path class="lp k-${o.kind}" d="M${p.x + 3},${p.y + 2} C${p.x + 20},${p.y + 8} ${p.x + 20},${p.y - 12} ${p.x + 5},${p.y - 5}" marker-end="url(#m-${o.kind})"/>`;
      });
      svg.innerHTML = out;
    });
  }

  // ---------- board ----------
  function renderInputs(s) {
    if (!s.consumes.length) return `<p class="empty">${esc(s.inputsText || "None")}</p>`;
    const rows = s.consumes.map(c => {
      const a = D.artifacts[c.artifact];
      const prods = a.producers.filter(p => p !== s.slug);
      const na = state.scope !== "all" && !prods.some(p => inScope(stageBy[p]));
      if (na && !state.showSkipped) return "";
      const t = `<b>${esc(a.file)}</b><br>${c.required ? "Required" : "Optional"}${c.conditional_on ? `, ${esc(c.conditional_on)} only` : ""}${c.cited ? ". Claims must cite it." : ""}${prods.length ? `<br><span class="dim">From ${esc(prods.map(p => `${stageBy[p].number} ${stageBy[p].name}`).join(", "))}</span>` : ""}${na ? `<br><span class="dim">Not produced in ${esc(state.scope)}</span>` : ""}<br><span class="dim">Click to pin its links</span>`;
      return `<li class="${c.required ? "" : "opt"} ${na ? "na" : ""}" data-link="in" data-slug="${s.slug}" data-art="${esc(c.artifact)}" data-stages="${prods.join(",")}" tabindex="0"><span class="fname"${tip(t)}>${esc(a.file)}</span>${c.conditional_on ? `<span class="note">${esc(c.conditional_on)}</span>` : ""}</li>`;
    }).join("");
    return rows ? `<ul class="files">${rows}</ul>` : `<p class="empty">None produced in ${esc(state.scope)}</p>`;
  }
  function renderOutputs(s) {
    const files = stageOutputs(s).filter(f => !(f.na && !state.showSkipped));
    if (!files.length) return `<p class="empty">${esc(s.outputsText)}</p>`;
    return `<ul class="files">${files.map(f => {
      const cons = f.art ? D.artifacts[f.art].consumers.filter(c => c !== s.slug) : [];
      const t = `<b>${esc(f.file)}</b><br><span class="dim">${esc(stageDir(s))}</span>${f.cond ? `<br>Only with ${esc(f.cond)}` : ""}${cons.length ? `<br><span class="dim">Read by ${esc(cons.map(c => stageBy[c].number).join(", "))}. Click to pin its links</span>` : ""}`;
      const link = f.art && cons.length ? ` data-link="out" data-slug="${s.slug}" data-art="${esc(f.art)}" data-stages="${cons.join(",")}" tabindex="0"` : "";
      return `<li class="${f.optional ? "opt" : ""} ${f.na ? "na" : ""}"${link}><span class="fname"${tip(t)}>${esc(f.file)}</span>${f.cond ? `<span class="note">${esc(f.cond)}</span>` : ""}</li>`;
    }).join("")}</ul>`;
  }
  function renderStage(s) {
    const ok = inScope(s);
    const open = ok && state.open.has(s.slug);
    const x = sc();
    const condTip = `<b>${s.execution === "ALWAYS" ? "Always runs" : "Conditional"}</b> when in scope<br>${esc(s.condition)}${s.perUnit ? "<br><span class='dim'>Runs once per unit of work</span>" : ""}`;
    let body = "";
    if (open) {
      const collabOff = x && x.collaborators === "off";
      const revOff = x && x.reviewCap === "none";
      const meta = [
        `<span><b>Lead</b> ${esc(agent(s.lead))}</span>`,
        s.support.length ? `<span><b>With</b> ${s.support.map(a => (collabOff ? `<s>${esc(agent(a))}</s>` : esc(agent(a)))).join(", ")}</span>` : "",
        s.reviewer ? `<span><b>Review</b> ${revOff ? `<s>${esc(agent(s.reviewer))}</s>` : esc(agent(s.reviewer))}</span>` : "",
        `<span><b>Runs</b> <span class="q"${tip(condTip)}>${s.execution === "ALWAYS" ? "always" : "when needed"}</span></span>`,
        s.requires.map(ref).join("") ? `<span><b>After</b> ${s.requires.map(ref).join("")}</span>` : "",
      ].join("");
      body = `<div class="s-body">
        <p class="s-sum">${esc(s.summary)}</p>
        <div class="s-meta">${meta}</div>
        <div class="io"><div><h4 class="sub">Inputs</h4>${renderInputs(s)}</div><div><h4 class="sub">Outputs</h4>${renderOutputs(s)}</div></div>
        <h4 class="sub">Flow</h4>${renderFlow(s)}
      </div>`;
    }
    return `<article class="stage ${ok ? "" : "skip"} ${open ? "open" : ""} ${open && state.focus === s.slug ? "entering" : ""}" id="st-${s.slug}" style="${pc(s.phase)}">
      <button type="button" class="s-head" ${ok ? `data-toggle="${s.slug}" aria-expanded="${open}"` : "disabled"}>
        <span class="s-num"${tip(`Jump here in chat<br><b>/aidlc --stage ${s.number}</b>`)}>${s.number}</span><span class="s-name">${esc(s.name)}</span>
        <span class="s-cond ${s.execution === "ALWAYS" ? "always" : ""}"${tip(condTip)}></span>
      </button>${body}</article>`;
  }
  function renderBoard() {
    const cols = [];
    const html = D.phases.map(p => {
      const all = D.stages.filter(s => s.phase === p.id);
      const live = all.filter(inScope);
      if (!live.length && !state.showSkipped) return "";
      const shown = state.showSkipped ? all : live;
      const wide = shown.some(s => state.open.has(s.slug) && inScope(s));
      cols.push(wide ? "minmax(520px, 2.8fr)" : "minmax(200px, 1fr)");
      const count = state.scope === "all" ? all.length : `${live.length}/${all.length}`;
      return `<div class="phase ${live.length ? "" : "dim"}" style="${pc(p.id)}">
        <div class="ph-head"${tip(`<b>${esc(p.name)}</b><br>${esc(p.purpose)}`)}><span class="n"${tip(`Jump here in chat<br><b>/aidlc --phase ${p.number}</b>`)}>${p.number}</span><h2>${esc(p.name)}</h2><span class="c">${count}</span></div>
        <div class="stages">${shown.map(renderStage).join("")}</div></div>`;
    }).join("");
    const board = document.getElementById("board");
    const focus = state.focus;
    state.focus = null;
    // widths before the change, so a toggle can animate from them
    const oldPx = focus ? [...board.querySelectorAll(":scope > .phase")].map(p => p.getBoundingClientRect().width) : null;
    board.innerHTML = html + `<svg class="links" aria-hidden="true"></svg>`;
    layoutColumns(board, cols, oldPx, focus);
  }

  // Expanding or collapsing a stage resizes its column. Animate the column widths (as pixel
  // tracks, which every browser can interpolate) and, at the same time, scroll the board so
  // the focused column ends up centred.
  let layoutTimer = null;
  function layoutColumns(board, cols, oldPx, focus) {
    const fr = cols.join(" ");
    clearTimeout(layoutTimer);
    board.classList.remove("animating");
    board.style.transition = "none";
    board.style.gridTemplateColumns = fr;
    if (!focus) return;
    const phases = [...board.querySelectorAll(":scope > .phase")];
    const card = document.getElementById(`st-${focus}`);
    const col = card && card.closest(".phase");
    if (!col) return;
    const max = Math.max(0, board.scrollWidth - board.clientWidth);
    const target = Math.min(max, Math.max(0, col.offsetLeft + col.offsetWidth / 2 - board.clientWidth / 2));
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stacked = matchMedia("(max-width: 760px)").matches;
    if (reduce || stacked || !oldPx || oldPx.length !== phases.length) { board.scrollLeft = target; return; }
    const newPx = phases.map(p => p.getBoundingClientRect().width);
    const D = 420;
    board.style.gridTemplateColumns = oldPx.map(w => `${w}px`).join(" ");
    void board.offsetWidth;
    board.classList.add("animating");
    board.style.transition = `grid-template-columns ${D}ms cubic-bezier(.22,.8,.24,1)`;
    board.style.gridTemplateColumns = newPx.map(w => `${w}px`).join(" ");
    const start = board.scrollLeft, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => {
      const k = Math.min(1, (now - t0) / D);
      board.scrollLeft = start + (target - start) * ease(k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    layoutTimer = setTimeout(() => {
      board.style.transition = "none";
      board.style.gridTemplateColumns = fr;
      // settle on the exact centre of the final layout (clamped at the board's edges)
      const m = Math.max(0, board.scrollWidth - board.clientWidth);
      board.scrollLeft = Math.min(m, Math.max(0, col.offsetLeft + col.offsetWidth / 2 - board.clientWidth / 2));
      board.classList.remove("animating");
      drawFlows(); drawLinks();
    }, D + 30);
  }

  // ---------- tree ----------
  const F = (name, o = {}) => ({ name, ...o });
  const Dir = (name, children, o = {}) => ({ name, dir: true, children: children.filter(Boolean), ...o });
  const RECORD_ONLY = new Set(["memory.md", "reviews/review-NN.md"]);
  function stageFiles(s, part) {
    return stageOutputs(s).filter(f => !(f.na && !state.showSkipped))
      .filter(f => !part || (part === "record") === RECORD_ONLY.has(f.file))
      .map(f => F(f.file, { stage: s.slug, na: f.na }));
  }
  function stageDirNode(s) {
    const ok = inScope(s);
    if (!ok && !state.showSkipped) return null;
    return Dir(`${s.slug}/`, stageFiles(s, s.slug === "reverse-engineering" ? "record" : null), { na: !ok, stage: s.slug });
  }
  function phaseNode(p) {
    const all = D.stages.filter(s => s.phase === p.id);
    const live = all.filter(inScope);
    if (!live.length && !state.showSkipped) return null;
    let kids = [];
    if (p.id === "construction") {
      const unit = all.filter(s => s.perUnit).map(stageDirNode).filter(Boolean);
      kids = [unit.length ? Dir("{unit}/", unit, { cm: "one per unit of work" }) : null].concat(all.filter(s => !s.perUnit).map(stageDirNode));
    } else if (p.id !== "initialization") kids = all.map(stageDirNode);
    return Dir(`${p.id}/`, kids, { phase: p.id, na: !live.length, cm: p.id === "initialization" ? "empty" : "" });
  }
  function treeData() {
    const re = stageBy["reverse-engineering"], pd = stageBy["practices-discovery"];
    const reOk = inScope(re);
    const check = (slug, file) => (inScope(stageBy[slug]) || state.showSkipped ? F(file, { stage: slug, na: !inScope(stageBy[slug]) }) : null);
    const record = Dir("<YYMMDD>-<label>/", [
      F("aidlc-state.md", { stage: "state-init", cm: "lifecycle position" }),
      F("project-description.json"),
      Dir("audit/", [F("<host>-<clone>.md")], { cm: "decision trail" }),
      Dir(".aidlc-engine/", [F("plan.json"), F("active-directive.json"), F("…")], { cm: "engine state, gitignored", closed: true }),
      Dir("verification/", [check("approval-handoff", "phase-check-ideation.md"), check("delivery-planning", "phase-check-inception.md"), check("ci-pipeline", "phase-check-construction.md")]),
      ...D.phases.map(phaseNode),
    ], { cm: "one per intent" });
    const space = Dir("<space>/", [
      Dir("memory/", [F("org.md"), F("team.md", { stage: inScope(pd) ? pd.slug : null }), F("project.md", { stage: inScope(pd) ? pd.slug : null }), Dir("phases/", []), Dir("templates/", [])], { cm: "how the team works" }),
      Dir("knowledge/", [Dir("documents/", []), Dir("documentkb/", [])], { cm: "standards agents read" }),
      reOk || state.showSkipped ? Dir("codekb/", [Dir("<repo>/", stageFiles(re, "codekb"), { na: !reOk })], { cm: "brownfield code knowledge", na: !reOk }) : null,
      Dir("intents/", [F("intents.json"), record]),
    ]);
    return Dir("my-project/", [
      Dir(".claude/", [], { cm: "engine; .kiro/, .codex/… on other harnesses" }),
      Dir("aidlc/", [Dir("spaces/", [space])]),
      Dir("<your code>/", [F("…", { stage: "code-generation" })], { cm: "generated application code" }),
    ]);
  }
  function renderNode(n, path) {
    const p = `${path}/${n.name}`;
    const cm = n.cm ? `<span class="cm">${esc(n.cm)}</span>` : "";
    if (!n.dir) {
      const link = n.stage && inScope(stageBy[n.stage]);
      const name = link ? `<button type="button" class="go" data-go="${n.stage}"${tip(`Written by <b>${esc(stageBy[n.stage].number)} ${esc(stageBy[n.stage].name)}</b>`)}>${esc(n.name)}</button>` : `<span class="fn">${esc(n.name)}</span>`;
      return `<li class="${n.na ? "na" : ""}"><span class="row">${name}${cm}</span></li>`;
    }
    const closed = !!n.closed !== state.toggledDirs.has(p);
    const st = n.stage ? stageBy[n.stage] : null;
    const dt = st ? tip(`<b>${esc(st.number)} ${esc(st.name)}</b><br>${esc(st.summary)}`) : "";
    return `<li class="dir ${n.phase ? "ph" : ""} ${closed ? "closed" : ""} ${n.na ? "na" : ""}"${n.phase ? ` style="${pc(n.phase)}"` : ""}>
      <span class="row" data-dir="${esc(p)}"><span class="car">${n.children.length ? (closed ? "▸" : "▾") : ""}</span><span class="dn"${dt}>${esc(n.name)}</span>${cm}</span>
      ${n.children.length ? `<ul>${n.children.map(c => renderNode(c, p)).join("")}</ul>` : ""}</li>`;
  }
  function renderTree() { document.getElementById("treeView").innerHTML = `<ul>${renderNode(treeData(), "")}</ul>`; }

  // ---------- artifact links ----------
  // A file's links run from where the information comes from to where it goes:
  // inputs from the producing stage, outputs to each consuming stage. When that other stage
  // is expanded, the link ends on its matching file row instead of on the stage card.
  // Hover previews a file's links; click pins them (several can be pinned at once).
  let hoverRow = null;
  const rowKey = li => `${li.dataset.slug}|${li.dataset.link}|${li.dataset.art}`;
  const findRow = (slug, dir, art) => document.querySelector(`li[data-link="${dir}"][data-slug="${slug}"][data-art="${art}"]`);

  function drawLinks() {
    const board = document.getElementById("board");
    const svg = board && board.querySelector("svg.links");
    if (!svg) return;
    document.querySelectorAll(".stage.linked, li.linked").forEach(e => e.classList.remove("linked"));
    const rows = [...state.pins].map(k => findRow(...k.split("|"))).filter(Boolean);
    if (hoverRow && document.body.contains(hoverRow) && !rows.includes(hoverRow)) rows.push(hoverRow);
    document.querySelectorAll("li[data-link]").forEach(li => li.classList.toggle("pinned", state.pins.has(rowKey(li))));
    // shrink first so a stale, taller overlay never inflates the board's scroll size
    svg.setAttribute("width", 0); svg.setAttribute("height", 0);
    const W = board.scrollWidth, H = board.scrollHeight;
    svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const br = board.getBoundingClientRect();
    const box = el => {
      const r = el.getBoundingClientRect();
      return { l: r.left - br.left + board.scrollLeft, r: r.right - br.left + board.scrollLeft, t: r.top - br.top + board.scrollTop, h: r.height };
    };
    const route = pts => {
      let d = `M${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
        const r = Math.min(6, Math.hypot(p1.x - p0.x, p1.y - p0.y) / 2, Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2);
        const u = (q, p) => { const l = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: (q.x - p.x) / l, y: (q.y - p.y) / l }; };
        const a1 = u(p0, p1), a2 = u(p2, p1);
        d += ` L${p1.x + a1.x * r},${p1.y + a1.y * r} Q${p1.x},${p1.y} ${p1.x + a2.x * r},${p1.y + a2.y * r}`;
      }
      const z = pts[pts.length - 1];
      return d + ` L${z.x},${z.y}`;
    };
    // An endpoint: the box to touch, its host card, and which sides it may be touched from.
    const endpoint = el => {
      const host = el.closest(".stage");
      const isRow = el.tagName === "LI";
      const target = isRow ? el : el.querySelector(".s-head");
      const b = box(target), hb = box(host);
      const sides = !isRow ? ["l", "r"] : el.dataset.link === "in" ? ["l"] : ["r"];
      return { l: isRow ? b.l : hb.l, r: isRow ? b.r : hb.r, y: b.t + b.h / 2, host: hb, sides };
    };
    let out = `<defs>${["in", "out"].map(k => `<marker id="la-${k}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path class="${k}" d="M0,0 L6,3 L0,6 z"/></marker>`).join("")}</defs>`;
    let lane = 0;
    for (const li of rows) {
      const inbound = li.dataset.link === "in";
      const art = li.dataset.art;
      li.classList.add("linked");
      for (const slug of (li.dataset.stages || "").split(",").filter(Boolean)) {
        const card = document.getElementById(`st-${slug}`);
        if (!card) continue;
        // the other end: matching file row when that stage is open, else its card
        const other = (card.classList.contains("open") && findRow(slug, inbound ? "out" : "in", art)) || card;
        const [S, T] = inbound ? [endpoint(other), endpoint(li)] : [endpoint(li), endpoint(other)];
        const off = 4 + (lane++ % 5) * 2.4; // stays inside the 16px board gutter and 18px column gap
        let pts;
        if (T.host.l >= S.host.r) pts = [{ x: S.r, y: S.y }, { x: S.host.r + off, y: S.y }, { x: S.host.r + off, y: T.y }, { x: T.l, y: T.y }];
        else if (T.host.r <= S.host.l) pts = [{ x: S.l, y: S.y }, { x: S.host.l - off, y: S.y }, { x: S.host.l - off, y: T.y }, { x: T.r, y: T.y }];
        else {
          // same column: use the gap both ends can reach, else the right gap
          const side = S.sides.includes("l") && T.sides.includes("l") ? "l" : "r";
          const gx = side === "l" ? Math.min(S.host.l, T.host.l) - off : Math.max(S.host.r, T.host.r) + off;
          pts = [{ x: side === "l" || !S.sides.includes("r") ? S.l : S.r, y: S.y }, { x: gx, y: S.y }, { x: gx, y: T.y }, { x: side === "l" ? T.l : T.r, y: T.y }];
        }
        const live = inScope(stageBy[slug]);
        const cls = `${inbound ? "in" : "out"} ${live ? "" : "ghost"}`;
        out += `<path class="lk ${cls}" d="${route(pts)}" marker-end="url(#la-${inbound ? "in" : "out"})"/><circle class="lk-dot ${cls}" cx="${pts[0].x}" cy="${pts[0].y}" r="2.5"/>`;
        (other === card ? card : other).classList.add("linked");
        if (other !== card) card.classList.add("linked");
      }
    }
    svg.innerHTML = out;
  }
  document.addEventListener("mouseover", e => {
    const li = e.target.closest("li[data-link]");
    if (li !== hoverRow) { hoverRow = li; drawLinks(); }
  });
  document.addEventListener("focusin", e => { const li = e.target.closest("li[data-link]"); if (li) { hoverRow = li; drawLinks(); } });

  // ---------- tooltip ----------
  const tipEl = document.getElementById("tip");
  let tipFor = null;
  function showTip(el) {
    tipFor = el;
    tipEl.innerHTML = el.dataset.tip;
    tipEl.classList.add("show");
    const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
    let top = r.bottom + 8;
    if (top + t.height > innerHeight - 8) top = r.top - t.height - 8;
    const left = Math.max(8, Math.min(innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2));
    tipEl.style.top = `${top}px`; tipEl.style.left = `${left}px`;
  }
  function hideTip() { tipFor = null; tipEl.classList.remove("show"); }
  document.addEventListener("mouseover", e => {
    const el = e.target.closest("[data-tip]");
    if (el && el.dataset.tip && el !== tipFor) showTip(el);
    else if (!el && tipFor) hideTip();
  });
  document.addEventListener("focusin", e => { const el = e.target.closest("[data-tip]"); if (el) showTip(el); });
  document.addEventListener("focusout", hideTip);
  addEventListener("scroll", hideTip, { passive: true });

  // ---------- wiring ----------
  function render() {
    hideTip(); hoverRow = null;
    renderIntro(); renderBoard(); renderTree();
    document.getElementById("foot").innerHTML = `Generated from <code>awslabs/aidlc-workflows</code> v${esc(D.source.version)} (${esc(D.source.commit)}). Unofficial community cheatsheet, not affiliated with Amazon Web Services. <a href="https://github.com/abelardovacca/aidlc-cheatsheet">Source</a>`;
    requestAnimationFrame(() => { drawFlows(); drawLinks(); });
  }
  let rz; addEventListener("resize", () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { drawFlows(); drawLinks(); }); });
  if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(() => { drawFlows(); drawLinks(); }));

  function setScope(name) {
    state.scope = name;
    try {
      const u = new URL(location.href);
      if (name === "all") u.searchParams.delete("scope"); else u.searchParams.set("scope", name);
      history.replaceState(null, "", u);
    } catch { /* file:// in some browsers */ }
    render();
  }
  function go(slug) {
    const s = stageBy[slug];
    if (!s || !inScope(s)) return;
    state.open.add(slug);
    state.focus = slug;
    render();
    const el = document.getElementById(`st-${slug}`);
    if (!el) return;
    // horizontal centring is handled by layoutColumns; only scroll the page vertically here
    const top = el.getBoundingClientRect().top + scrollY - 72;
    scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-go],[data-scope],[data-toggle-skipped],[data-toggle],[data-sel],[data-dir],li[data-link]");
    if (!t) return;
    if (t.dataset.go) { e.stopPropagation(); return go(t.dataset.go); }
    if (t.dataset.scope) return setScope(t.dataset.scope);
    if (t.hasAttribute("data-toggle-skipped")) { state.showSkipped = !state.showSkipped; store.set("aidlc.showSkipped", state.showSkipped ? "1" : "0"); return render(); }
    if (t.dataset.toggle) { const k = t.dataset.toggle; state.open.has(k) ? state.open.delete(k) : state.open.add(k); state.focus = k; return render(); }
    if (t.dataset.sel) { const [slug, k] = t.dataset.sel.split("|"); state.sel[slug] = state.sel[slug] === k ? undefined : k; return render(); }
    if (t.dataset.link) { const k = rowKey(t); state.pins.has(k) ? state.pins.delete(k) : state.pins.add(k); return drawLinks(); }
    if (t.dataset.dir) { const k = t.dataset.dir; state.toggledDirs.has(k) ? state.toggledDirs.delete(k) : state.toggledDirs.add(k); return renderTree(); }
  });

  // ---------- commands view ----------
  const C = window.AIDLC_COMMANDS || { chat: [], terminal: [] };
  const cmdState = { q: "", prefix: store.get("aidlc.prefix") === "$aidlc" ? "$aidlc" : "/aidlc" };
  const withPrefix = (cmd, plane) => (plane === "chat" && cmdState.prefix === "$aidlc" ? cmd.replace(/^\/aidlc/, "$aidlc") : cmd);
  // muted placeholders: <value>, [optional], and a|b choices stay readable
  const fmtCmd = cmd => esc(cmd)
    .replace(/&lt;[^&]*?&gt;/g, m => `<span class="ph">${m}</span>`)
    .replace(/\[[^\]]*\]/g, m => `<span class="opt">${m}</span>`);
  function renderCommands() {
    document.querySelectorAll("[data-prefix]").forEach(b => b.classList.toggle("on", b.dataset.prefix === cmdState.prefix));
    const q = cmdState.q.trim().toLowerCase();
    const plane = (key, title, sub) => {
      const groups = C[key].map(g => {
        const items = g.items.filter(it => !q || `${it.cmd} ${it.desc} ${g.group}`.toLowerCase().includes(q));
        if (!items.length) return "";
        return `<section class="cgroup"><h3>${esc(g.group)}</h3>${g.intro && !q ? `<p class="cintro">${esc(g.intro)}</p>` : ""}
          <ul>${items.map(it => {
            const full = withPrefix(it.cmd, key);
            return `<li><button type="button" class="ccmd" data-copy="${esc(full)}"${tip(`Copy <b>${esc(full)}</b>`)}><code>${fmtCmd(it.short ? it.short : full)}</code></button><span class="cdesc">${esc(it.desc)}</span></li>`;
          }).join("")}</ul></section>`;
      }).join("");
      return groups ? `<div class="plane"><div class="plane-head"><h2>${title}</h2><p>${sub}</p></div><div class="cgroups">${groups}</div></div>` : "";
    };
    const html = plane("chat", "In chat", `Typed to the agent in your AI tool. <code>${esc(cmdState.prefix)}</code> ${cmdState.prefix === "$aidlc" ? "on Codex CLI" : "on Claude Code, Kiro, Cursor, opencode and Copilot"}; everything after the prefix is identical.`)
      + plane("terminal", "In the terminal", "The native <code>aidlc</code> command, run in your shell. Six public commands plus read-only engine routes.");
    document.getElementById("cmdBody").innerHTML = html || `<p class="empty">No command matches “${esc(cmdState.q)}”.</p>`;
  }
  function setView() {
    const cmds = location.hash === "#commands";
    document.getElementById("viewLifecycle").hidden = cmds;
    document.getElementById("viewCommands").hidden = !cmds;
    document.querySelectorAll(".nav [data-view]").forEach(a => a.classList.toggle("on", (a.dataset.view === "commands") === cmds && !a.classList.contains("sub-link")));
    hideTip();
    if (cmds) renderCommands();
    else requestAnimationFrame(() => { drawFlows(); drawLinks(); });
  }
  addEventListener("hashchange", setView);
  document.getElementById("cmdSearch").addEventListener("input", e => { cmdState.q = e.target.value; renderCommands(); });
  document.addEventListener("click", e => {
    const p = e.target.closest("[data-prefix]");
    if (p) { cmdState.prefix = p.dataset.prefix; store.set("aidlc.prefix", cmdState.prefix); return renderCommands(); }
    const c = e.target.closest("[data-copy]");
    if (c) {
      const done = () => { c.classList.add("copied"); tipEl.innerHTML = "Copied"; setTimeout(() => c.classList.remove("copied"), 1200); };
      try { navigator.clipboard.writeText(c.dataset.copy).then(done, () => {}); } catch { /* clipboard unavailable */ }
    }
    const v = e.target.closest(".nav [data-view]");
    if (v && v.dataset.view === "lifecycle" && !v.classList.contains("sub-link")) { e.preventDefault(); history.pushState(null, "", location.pathname + location.search); setView(); scrollTo(0, 0); }
    if (v && v.classList.contains("sub-link") && location.hash === "#commands") { e.preventDefault(); history.pushState(null, "", location.pathname + location.search + "#tree"); setView(); document.getElementById("tree").scrollIntoView(); }
  });

  document.addEventListener("keydown", e => {
    const li = e.target.closest && e.target.closest("li[data-link]");
    if (li && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); li.click(); }
  });

  // a stage opened from the URL is centred like one opened by a click
  state.focus = [...state.open].pop() || null;
  render();
  setView();
})();
