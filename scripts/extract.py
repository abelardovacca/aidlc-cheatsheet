#!/usr/bin/env python3
"""Extract AI-DLC phases, stages, steps, scopes and artifacts into aidlc-data.js.

Usage: python3 scripts/extract.py [path-to-aidlc-workflows]
Default source: ../aidlc/aidlc-workflows (sibling repo).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "aidlc" / "aidlc-workflows"
CORE = SRC / "core"
STAGES_DIR = CORE / "aidlc-common" / "stages"
SCOPES_DIR = CORE / "scopes"
PHASE_DOC = SRC / "docs" / "guide" / "04-phases-and-stages.md"

PHASES = [
    ("initialization", "Initialization", 0),
    ("ideation", "Ideation", 1),
    ("inception", "Inception", 2),
    ("construction", "Construction", 3),
    ("operation", "Operation", 4),
]

# Canonical stage order (docs/guide/05-scopes-and-depth.md stage-by-scope matrix).
ORDER = [
    "workspace-scaffold", "workspace-detection", "state-init",
    "intent-capture", "market-research", "feasibility", "scope-definition",
    "team-formation", "rough-mockups", "approval-handoff",
    "reverse-engineering", "practices-discovery", "requirements-analysis",
    "user-stories", "refined-mockups", "domain-design", "units-generation",
    "contract-design", "delivery-planning",
    "functional-design", "nfr-requirements", "nfr-design",
    "infrastructure-design", "code-generation", "build-and-test", "ci-pipeline",
    "deployment-pipeline", "environment-provisioning", "deployment-execution",
    "observability-setup", "incident-response", "performance-validation",
    "feedback-optimization",
]

SCOPE_ORDER = ["enterprise", "feature", "mvp", "poc", "bugfix", "refactor",
               "infra", "security-patch", "classic", "workshop", "express"]

# Hand-written one-line summaries of what each stage does.
SUMMARIES = {
    "workspace-scaffold": "Creates the intent's record dir (aidlc/spaces/<space>/intents/<YYMMDD>-<label>/) and the in-scope phase folders. Deterministic, no LLM.",
    "workspace-detection": "Rule-based scan of the workspace: classifies greenfield vs brownfield and detects the technology stack.",
    "state-init": "Writes the fully populated aidlc-state.md and decides routing for the selected scope, then auto-proceeds.",
    "intent-capture": "Frames the initiative: what problem, for whom, why now. Produces the intent statement and stakeholder map, with assumptions surfaced and confirmed.",
    "market-research": "Looks outward: competitive landscape, market trends and a build-vs-buy recommendation.",
    "feasibility": "Assesses technical, regulatory and integration feasibility; records constraints and a RAID log.",
    "scope-definition": "Draws the scope boundary (in / out) and turns the intent into a prioritized intent backlog.",
    "team-formation": "Assesses team skills and capacity and plans mob composition for the work.",
    "rough-mockups": "Low-fidelity wireframes and user flows (or system interaction diagrams for API/backend work).",
    "approval-handoff": "Compiles all Ideation artifacts into an initiative brief and decision log, runs the Ideation→Inception phase check and asks for go/no-go.",
    "reverse-engineering": "Brownfield only: scans existing code (developer) and synthesizes (architect) 9 CodeKB documents into the space-level codekb/<repo>/ store.",
    "practices-discovery": "Discovers how the team works (way of working, walking skeleton, testing posture, deployment, code style) and promotes affirmed practices into memory.",
    "requirements-analysis": "Elicits and clarifies requirements across six dimensions, then writes requirements.md with stable FR/NFR IDs used for traceability downstream.",
    "user-stories": "Mob-elaborates personas and user stories with acceptance criteria, traced back to requirement IDs.",
    "refined-mockups": "High-fidelity mockups, interaction spec, design-system mapping and accessibility checklist.",
    "domain-design": "Identifies the logical components (code you write, not infra), their catalogue and the architecture decisions (ADRs).",
    "units-generation": "Groups components into deployable units of work and produces the dependency DAG (topology, not order).",
    "contract-design": "Pins inter-unit and public/external API contracts (OpenAPI / AsyncAPI / schemas) so units can be built in parallel.",
    "delivery-planning": "Chooses the economic path through the unit DAG: Bolt sequence, team allocation, risks, dependencies; runs the Inception→Construction phase check.",
    "functional-design": "Per unit: entities, business rules, workflows/state machines and (if UI) frontend components.",
    "nfr-requirements": "Per unit: performance, security, scalability, reliability and observability requirements plus tech-stack decisions.",
    "nfr-design": "Per unit: design patterns and logical components that satisfy the NFRs.",
    "infrastructure-design": "Per unit: maps logical components to infrastructure services, monitoring design and CI/CD shape.",
    "code-generation": "Per unit: writes a code plan (approved by you), generates the application code and unit tests, then a code summary.",
    "build-and-test": "Once after all units: build + test instructions (scaled by test strategy), runs build and tests, and a cross-unit coverage gate.",
    "ci-pipeline": "Creates or updates the CI pipeline and quality gates; runs the Construction phase check.",
    "deployment-pipeline": "Defines the CD pipeline, deployment strategy and rollback runbook.",
    "environment-provisioning": "Provisions and validates target (AWS) environments.",
    "deployment-execution": "Runs pre-deployment checks, deploys, smoke-tests and reports health.",
    "observability-setup": "Dashboards, alarms, SLOs, log queries, tracing and anomaly detection.",
    "incident-response": "Runbooks, incident plan and escalation matrix.",
    "performance-validation": "Load-tests against NFR targets and fills the NFR validation matrix.",
    "feedback-optimization": "SLO report, cost analysis, drift report and the feedback loop into the next intent.",
}

# Steps whose behaviour depends on a scope setting.
#   kind "skip"    -> step does not run when condition holds
#   kind "partial" -> step runs, part of it is dropped
#   kind "notice"  -> the stop becomes a one-line notice
STEP_GATES = {
    ("requirements-analysis", "9"): {"flag": "summary_confirmation", "when": "off", "kind": "skip",
        "note": "Runs only when summary confirmation is on; otherwise goes straight to Step 10."},
    ("intent-capture", "5"): {"flag": "summary_confirmation", "when": "off", "kind": "partial",
        "note": "Re-presenting the consolidated summary is skipped when summary confirmation is off. The assumption confirmation still runs."},
    ("code-generation", "3"): {"flag": "plan_approval", "when": "off", "kind": "notice",
        "note": "With plan approval off there is no stop: one line names the plan and generation starts."},
    ("practices-discovery", "3"): {"flag": "collaborators", "when": "off", "kind": "skip",
        "note": "Blind support review needs support agents; with collaborators off the lead works alone."},
    ("practices-discovery", "6"): {"flag": "learnings", "when": "off", "kind": "partial",
        "note": "The learnings half is skipped when learnings is off; the affirmation gate still runs."},
    ("reverse-engineering", "3"): {"flag": "collaborators", "when": "off", "kind": "skip",
        "note": "With collaborators off the architect link is dropped: the developer scans and synthesizes the 9 artifacts alone."},
    ("requirements-analysis", "5"): {"flag": "depth", "when": "Minimal", "kind": "partial",
        "note": "The corner-checklist sweep of user scenarios runs only at Standard and Comprehensive depth."},
    ("functional-design", "2"): {"flag": "depth", "when": "Minimal", "kind": "partial",
        "note": "The corner-checklist sweep of error/edge cases runs only at Standard and Comprehensive depth."},
    ("build-and-test", "3-7"): {"flag": "testStrategy", "when": "Minimal", "kind": "partial",
        "note": "Minimal test strategy: unit tests only (1 per requirement + happy-path floor). Integration instructions need Standard+, performance/security need Comprehensive."},
    ("units-generation", "2"): {"flag": "skeleton", "when": "off", "kind": "partial",
        "note": "Shaping the first Unit as a walking skeleton applies only when skeleton is on."},
    ("delivery-planning", "2"): {"flag": "skeleton", "when": "off", "kind": "partial",
        "note": "The walking-skeleton Bolt question applies only when skeleton is on."},
}

# Output files that only appear at some depth / test strategy.
CONDITIONAL_FILES = {
    "build-and-test": [
        {"file": "integration-test-instructions.md", "minTest": "Standard"},
        {"file": "performance-test-instructions.md", "minTest": "Comprehensive"},
        {"file": "security-test-instructions.md", "minTest": "Comprehensive"},
    ],
}

ARTIFACT_FILENAMES = {
    "build-test-results": "test-results.md",
    "load-test-results": "test-results.md",
    "traceability": "traceability.json",
}


def artifact_file(name):
    return ARTIFACT_FILENAMES.get(name, f"{name}.md")


def split_frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    # The engine reads free-text scalars loosely; quote them so strict YAML accepts them.
    def quote(line):
        k = re.match(r"^([a-z_]+): (?![\"'\[{|>])(.+)$", line)
        return f"{k.group(1)}: {json.dumps(k.group(2))}" if k else line
    fm = "\n".join(quote(l) for l in m.group(1).splitlines())
    return yaml.safe_load(fm), m.group(2)


def clean_inline(s):
    s = s.replace("{{HARNESS_DIR}}", "<harness>").replace("{{INVOKE}}", "aidlc")
    s = s.replace("{{OPTION_LETTERS}}", "A/B/C")
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    return s


def excerpt(body, limit=700):
    """First meaningful lines of a step body, code fences removed."""
    out, in_code, size = [], False, 0
    for line in body.splitlines():
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or not line.strip() or line.strip() == "---":
            if out and out[-1] != "":
                out.append("")
            continue
        if line.startswith("#"):
            break
        line = clean_inline(line.rstrip())
        out.append(line)
        size += len(line)
        if size > limit:
            out.append("…")
            break
    while out and out[-1] == "":
        out.pop()
    return "\n".join(out)


def parse_steps(body):
    steps = []
    parts = re.split(r"^### (Step [^\n]+)\n", body, flags=re.M)
    for i in range(1, len(parts), 2):
        head, text = parts[i], parts[i + 1]
        # stop the body at the next H2 (## Sensors / ## Learn / ## PART 2 …)
        text = re.split(r"^## ", text, flags=re.M)[0]
        m = re.match(r"Step ([0-9a-z\-]+):\s*(.*)", head)
        num, title = (m.group(1), m.group(2)) if m else ("", head)
        steps.append({"n": num, "title": clean_inline(title.strip()), "text": excerpt(text)})
    return steps


# Which lane of the common stage flow (stage-protocol.md: questions -> artifact ->
# reviewer -> learnings -> gate) a step belongs to. First match wins; default "generate".
LANE_RULES = [
    ("gate", r"Present Completion|^Completion$|Open the Approval Gate|Affirmation Gate|Promote|Commit Approval|Auto-Proceed|Display Confirmation|Completion Handoff|Phase Boundary Verification|Update State and Audit|Finalize State"),
    ("summary", r"Consolidated Summary"),
    ("questions", r"Question|Answers|Interview|Collect"),
    ("context", r"^Load|^Read |Check Conditions|Validate .* Needed|Analyze User Request|Determine Depth|^Assess|Completeness Analysis|Analyze Testing|^Update State$|Scan Workspace|Detect Project|Verify Classification|Identify Technology"),
]
LANE_OVERRIDES = {
    ("functional-design", "2"): "questions",   # plan with embedded questions
    ("practices-discovery", "6"): "learnings",
    ("workspace-detection", "6a"): "gate",     # relayed just before auto-proceed
}


def lane_of(slug, step):
    if (slug, step["n"]) in LANE_OVERRIDES:
        return LANE_OVERRIDES[(slug, step["n"])]
    for lane, rx in LANE_RULES:
        if re.search(rx, step["title"]):
            return lane
    return "generate"


def stage_name(fm, body):
    if fm.get("name"):
        return fm["name"]
    m = re.search(r"^# (.+)$", body, re.M)
    return m.group(1).strip() if m else fm["slug"]


def phase_purposes():
    text = PHASE_DOC.read_text()
    out = {}
    for pid, pname, _ in PHASES:
        m = re.search(rf"^## Phase \d+: {pname}\n+\*\*Purpose:\*\* (.+)$", text, re.M)
        if m:
            p = re.sub(r"`([^`]+)`", r"\1", m.group(1))
            out[pid] = p.split(" The welcome message")[0]
    return out


def main():
    files = {p.stem: p for p in STAGES_DIR.glob("*/*.md")}
    stages = []
    counters = {}
    for slug in ORDER:
        fm, body = split_frontmatter(files[slug].read_text())
        phase_num = dict((p[0], p[2]) for p in PHASES)[fm["phase"]]
        counters[phase_num] = counters.get(phase_num, 0) + 1
        steps = parse_steps(body)
        for s in steps:
            s["lane"] = lane_of(slug, s)
            g = STEP_GATES.get((slug, s["n"]))
            if g:
                s["gate"] = g
        consumes = []
        for c in fm.get("consumes") or []:
            if isinstance(c, str):
                c = {"artifact": c}
            consumes.append({
                "artifact": c["artifact"],
                "required": bool(c.get("required", False)),
                "conditional_on": c.get("conditional_on"),
                "cited": bool(c.get("cited", False)),
            })
        stages.append({
            "slug": slug,
            "name": stage_name(fm, body),
            "number": f"{phase_num}.{counters[phase_num]}",
            "phase": fm["phase"],
            "summary": SUMMARIES[slug],
            "execution": fm.get("execution"),
            "condition": clean_inline(str(fm.get("condition", ""))),
            "lead": fm.get("lead_agent"),
            "support": fm.get("support_agents") or [],
            "mode": fm.get("mode"),
            "reviewer": fm.get("reviewer"),
            "reviewClass": fm.get("review_class") or ("adversarial" if fm.get("reviewer") else None),
            "reviewMax": fm.get("reviewer_max_iterations"),
            "summaryConfirmation": fm.get("summary_confirmation") == "required",
            "perUnit": fm.get("for_each") == "unit-of-work",
            "produces": fm.get("produces") or [],
            "optionalProduces": fm.get("optional_produces") or [],
            "consumes": consumes,
            "requires": fm.get("requires_stage") or [],
            "sensors": fm.get("sensors") or [],
            "scopes": fm.get("scopes") or [],
            "inputsText": clean_inline(str(fm.get("inputs", ""))),
            "outputsText": clean_inline(str(fm.get("outputs", ""))),
            "conditionalFiles": CONDITIONAL_FILES.get(slug, []),
            "steps": steps,
        })

    scopes = []
    for name in SCOPE_ORDER:
        fm, _ = split_frontmatter((SCOPES_DIR / f"aidlc-{name}.md").read_text())
        scopes.append({
            "name": fm["name"],
            "description": fm.get("description", ""),
            "depth": fm.get("depth", "Standard"),
            "testStrategy": fm.get("testStrategy") or fm.get("depth", "Standard"),
            "keywords": fm.get("keywords") or [],
            "skeleton": fm.get("skeleton", "on"),
            "existingCode": bool(fm.get("existing_code", False)),
            "runner": bool(fm.get("runner", False)),
            "reviewCap": fm.get("review_cap", "full"),
            "guardPolicy": fm.get("guard_policy", "off"),
            "sensors": fm.get("sensors", "on"),
            "learnings": fm.get("learnings", "on"),
            "summary_confirmation": fm.get("summary_confirmation", "on"),
            "plan_approval": fm.get("plan_approval", "on"),
            "collaborators": fm.get("collaborators", "off"),
        })

    # artifact index: producers and consumers
    artifacts = {}
    def art(name):
        return artifacts.setdefault(name, {"name": name, "file": artifact_file(name),
                                           "producers": [], "consumers": []})
    for s in stages:
        for a in s["produces"] + s["optionalProduces"]:
            art(a)["producers"].append(s["slug"])
        for c in s["consumes"]:
            art(c["artifact"])["consumers"].append(s["slug"])

    try:
        rev = subprocess.run(["git", "-C", str(SRC), "log", "-1", "--format=%h %cs"],
                             capture_output=True, text=True).stdout.strip()
    except OSError:
        rev = ""
    version = ""
    m = re.search(r"version-([0-9.]+)-blue", (SRC / "README.md").read_text())
    if m:
        version = m.group(1)

    data = {
        "source": {"version": version, "commit": rev},
        "phases": [{"id": p, "name": n, "number": i, "purpose": phase_purposes().get(p, "")}
                   for p, n, i in PHASES],
        "stages": stages,
        "scopes": scopes,
        "artifacts": artifacts,
    }
    out = ROOT / "aidlc-data.js"
    out.write_text("// Generated by scripts/extract.py from awslabs/aidlc-workflows. Do not edit.\n"
                   "window.AIDLC = " + json.dumps(data, indent=1, ensure_ascii=False) + ";\n")
    print(f"wrote {out.relative_to(ROOT)}: {len(stages)} stages, {len(scopes)} scopes, "
          f"{len(artifacts)} artifacts (aidlc {version} {rev})")


if __name__ == "__main__":
    main()
