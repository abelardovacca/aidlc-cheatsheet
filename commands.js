// Hand-curated from aidlc-workflows docs/guide/12-cli-commands.md, 11-session-management.md
// and 18-install-and-lifecycle.md. Update when those guides change.
// <x> = required value, [x] = optional, a|b = pick one.
window.AIDLC_COMMANDS = {
  chat: [
    {
      group: "Start work",
      items: [
        { cmd: "/aidlc <description>", desc: "Describe the work; the agent proposes a scope and plan for you to confirm." },
        { cmd: "/aidlc <scope>", desc: "Start with an explicit scope, e.g. /aidlc express." },
        { cmd: "/aidlc <scope> <description>", desc: "Explicit scope plus the request, e.g. /aidlc bugfix Fix the login timeout." },
        { cmd: "/aidlc-<scope>", desc: "Runner shortcut for feature, mvp, bugfix, security-patch and express." },
        { cmd: "/aidlc compose \"<task>\"", desc: "Have the adaptive composer tailor which stages run." },
        { cmd: "/aidlc compose --report <path>", desc: "Compose a compact fix-and-ship run from a scan report." },
        { cmd: "/aidlc --new-scope '<task>'", desc: "Force a custom plan even when a stock scope fits." },
      ],
    },
    {
      group: "Resume and move around",
      items: [
        { cmd: "/aidlc", desc: "Carry on where the work stopped; with no work yet, it asks what to build." },
        { cmd: "/aidlc --resume", desc: "Resume explicitly, clearing a park mark." },
        { cmd: "/aidlc park", desc: "Park at the current stage boundary for later or for someone else." },
        { cmd: "/aidlc --status", desc: "Read-only summary of where the work is." },
        { cmd: "/aidlc --stage <slug|#>", desc: "Jump to a stage." },
        { cmd: "/aidlc --phase <name|#>", desc: "Jump to the start of a phase." },
        { cmd: "/aidlc --stage <slug> --single", desc: "Run one stage in isolation without advancing the workflow." },
      ],
    },
    {
      group: "Shape the run",
      items: [
        { cmd: "/aidlc --scope <name>", desc: "Change the active scope." },
        { cmd: "/aidlc --depth minimal|standard|comprehensive", desc: "How much detail each document gets." },
        { cmd: "/aidlc --test-strategy minimal|standard|comprehensive", desc: "How many tests get written." },
        { cmd: "/aidlc --project-type greenfield|brownfield", desc: "New project or existing code; brownfield rescans and runs Reverse Engineering." },
        { cmd: "/aidlc --review adversarial|advisory|none", desc: "Stage reviews for this run, replacing the scope's cap." },
        { cmd: "/aidlc --guard-policy strict|relaxed|off", desc: "How far the guards stand aside for this piece of work." },
      ],
    },
    {
      group: "Ceremony switches",
      intro: "Per piece of work. Plain words work too: “turn sensors off”.",
      items: [
        { cmd: "/aidlc --sensors on|off", desc: "Automatic sensor runs and blocking-sensor checks." },
        { cmd: "/aidlc --learnings on|off", desc: "memory.md diary and the learnings step." },
        { cmd: "/aidlc --summary-confirmation on|off", desc: "The “does this look correct?” checkpoint." },
        { cmd: "/aidlc --plan-approval on|off", desc: "Approve each code plan before it is built. Only you can turn it off." },
        { cmd: "/aidlc --collaborators on|off", desc: "Support agents, or lead agent only." },
      ],
    },
    {
      group: "Settings",
      items: [
        { cmd: "/aidlc config list", desc: "All active workflow settings (--json available)." },
        { cmd: "/aidlc config get <key>", desc: "One setting: depth, review, guard-policy, sensors…" },
        { cmd: "/aidlc config set <key> <value>", desc: "Change a setting through the shared setter." },
        { cmd: "/aidlc config set guard.<fence> on|off", desc: "One fence: review-freeze, state-transition, reviewer-scope." },
        { cmd: "/aidlc --config [section]", desc: "Configure project policy conversationally." },
      ],
    },
    {
      group: "Intents and spaces",
      intro: "An intent is one piece of work; a space is one team's world.",
      items: [
        { cmd: "/aidlc intent [name]", desc: "List intents, or switch to one. --all includes archived." },
        { cmd: "/aidlc intent archive <name>", desc: "Retire an intent without deleting its record; unarchive brings it back." },
        { cmd: "/aidlc intent add-repo <name> [--url <address>]", desc: "Add a sibling repo to the work; remove-repo takes one out." },
        { cmd: "/aidlc intent set-repos <name,...>", desc: "Say exactly which repos the work covers." },
        { cmd: "/aidlc intent add-checkout <path>", desc: "Include code from another checkout in reviews." },
        { cmd: "/aidlc space [name]", desc: "List spaces, or switch to one." },
        { cmd: "/aidlc space-create <name>", desc: "Create a space from the default space's org rules." },
      ],
    },
    {
      group: "Knowledge",
      intro: "Your own documents, indexed for agents to read.",
      items: [
        { cmd: "/aidlc knowledge onboard [path ...]", desc: "Add files or folders to the knowledge base." },
        { cmd: "/aidlc knowledge sync", desc: "Reconcile the catalog with what is on disk." },
        { cmd: "/aidlc knowledge list", desc: "Every document with its state." },
        { cmd: "/aidlc knowledge show <id>", desc: "One document's record and extracted text." },
        { cmd: "/aidlc knowledge associate <id> --intent [slug]", desc: "Scope a document to one intent; dissociate undoes it." },
        { cmd: "/aidlc knowledge rebind <id> --to <path>", desc: "Repair a row whose original moved and changed." },
      ],
    },
    {
      group: "Team construction",
      intro: "Several people or chats building Units in parallel.",
      items: [
        { cmd: "/aidlc team-board", desc: "Read-only board: Unit progress, claims, merge readiness." },
        { cmd: "/aidlc unit status", desc: "Claimable, claimed and blocked Units." },
        { cmd: "/aidlc unit participate", desc: "Mark this clone for the guided claim picker." },
        { cmd: "/aidlc --claim <unit> [--team <label>]", desc: "Atomically claim a Unit (same as unit claim)." },
        { cmd: "/aidlc unit adopt <unit>", desc: "Adopt a teammate's live claim in a fresh clone." },
        { cmd: "/aidlc --release <unit>", desc: "Release a claim (same as unit release)." },
        { cmd: "/aidlc unit share", desc: "Commit and push the integration branch so teams can take Units." },
        { cmd: "/aidlc unit publish <unit> [--commit]", desc: "Publish a finished candidate onto its claim." },
        { cmd: "/aidlc unit pin <unit>", desc: "Pin and validate a completed candidate." },
        { cmd: "/aidlc unit gate <unit>", desc: "Record the merge decision for the pinned candidate." },
        { cmd: "/aidlc unit land <unit>", desc: "Land it: git, then state, then audit." },
      ],
    },
    {
      group: "Health and info",
      items: [
        { cmd: "/aidlc --doctor", desc: "Health check. --check-updates refreshes update metadata." },
        { cmd: "/aidlc --doctor --export", desc: "Write a small, redacted diagnostic report to share." },
        { cmd: "/aidlc --statusline on|off", desc: "Show AI-DLC progress in the status line, or give yours back." },
        { cmd: "/aidlc --version", desc: "Framework version." },
        { cmd: "/aidlc --help", desc: "Usage information." },
      ],
    },
    {
      group: "Session skills",
      intro: "Read-only reports; type them like commands.",
      items: [
        { cmd: "/aidlc-session-cost", desc: "Duration, stage outcomes, memory, sensors, learnings." },
        { cmd: "/aidlc-replay", desc: "Readable narrative of the session for async review." },
        { cmd: "/aidlc-outcomes-pack", desc: "Handover document for the team (OUTCOMES.md)." },
        { cmd: "/aidlc-issue-report", desc: "Gather a redacted report when something went wrong." },
      ],
    },
    {
      group: "Plugins",
      items: [
        { cmd: "/aidlc plugin list", desc: "Installed plugins and whether they are enabled." },
        { cmd: "/aidlc plugin select [names]", desc: "Show or set the enabled plugins." },
        { cmd: "/aidlc plugin sync", desc: "Compose installed plugins into this install." },
        { cmd: "/aidlc plugin validate [path]", desc: "Validate a plugin you are authoring." },
        { cmd: "/aidlc <plugin command> [args]", desc: "Run a command a plugin adds." },
      ],
    },
  ],

  terminal: [
    {
      group: "Install and set up a project",
      items: [
        { cmd: "curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh | sh", short: "install.sh | sh", desc: "Install the native aidlc command (macOS, Linux, WSL)." },
        { cmd: "aidlc config", desc: "Interactive project setup in the current folder." },
        { cmd: "aidlc config --harness <name>", desc: "claude, kiro, kiro-v2, codex, cursor, opencode or copilot." },
        { cmd: "aidlc config --harness <name> --dry-run", desc: "Preview what would change." },
        { cmd: "aidlc config --pin <version>", desc: "Pin the project to a version; --unpin follows the channel again." },
      ],
    },
    {
      group: "Project policy",
      intro: "Each section takes --show, --check, --reset and --help.",
      items: [
        { cmd: "aidlc config providers", desc: "Model provider setup, e.g. Amazon Bedrock." },
        { cmd: "aidlc config models --preset <name>", desc: "Model and effort per agent; --agent <name> for one." },
        { cmd: "aidlc config flags --default-scope <scope>", desc: "Default scope, swarm mode, sensor timeout…" },
        { cmd: "aidlc config flags --bypass <NAME>", desc: "Record a ceremony kill switch or guard bypass." },
        { cmd: "aidlc config project --plugins <names>", desc: "Plugin selection, MCP consent, shell completions." },
        { cmd: "aidlc config runtime", desc: "Runtime settings." },
        { cmd: "aidlc config trust", desc: "Harness trust settings (e.g. Kiro IDE workflows)." },
      ],
    },
    {
      group: "Health",
      items: [
        { cmd: "aidlc doctor", desc: "Check install and project health. --verbose or --json for more." },
        { cmd: "aidlc doctor --export", desc: "Redacted diagnostic report to share." },
      ],
    },
    {
      group: "Versions",
      items: [
        { cmd: "aidlc version", desc: "Installed version (--json available)." },
        { cmd: "aidlc update", desc: "Update to the newest release on your channel. --check only checks." },
        { cmd: "aidlc update --channel stable", desc: "Switch release channel." },
        { cmd: "aidlc use <version>", desc: "Go to a specific version, older or newer." },
        { cmd: "aidlc uninstall", desc: "Remove AI-DLC for this user. --purge also removes its data." },
      ],
    },
    {
      group: "Help",
      items: [
        { cmd: "aidlc --help", desc: "The six public commands." },
        { cmd: "aidlc <command> --help", desc: "Every option of one command." },
        { cmd: "aidlc help --all", desc: "Also reveals the engine and system namespaces." },
      ],
    },
    {
      group: "Inspect a workflow",
      intro: "Engine routes the agent uses. Safe to read, but not a stable scripting interface.",
      items: [
        { cmd: "aidlc engine audit turns", desc: "Your turns and what you sent." },
        { cmd: "aidlc engine audit history", desc: "JSON timeline of events and notes." },
        { cmd: "aidlc engine log answers --stage <slug>", desc: "Earlier answers and open questions for a stage." },
        { cmd: "aidlc engine runtime summary [--json]", desc: "Stage outcomes, memory, sensors, duration." },
      ],
    },
    {
      group: "Recovery",
      items: [
        { cmd: "aidlc engine worktree restore --slug <slug>", desc: "Recover files from a set-aside Bolt attempt." },
        { cmd: "aidlc engine worktree purge --slug <slug>", desc: "Remove local recovery refs you no longer need." },
        { cmd: "aidlc plugin test [path] --install <project-root>", desc: "Test a plugin against a copy of a project." },
      ],
    },
    {
      group: "Environment",
      intro: "Read from your shell or the harness settings env block.",
      items: [
        { cmd: "AWS_AIDLC_DEFAULT_SCOPE=<scope>", desc: "Default scope for new work in this project." },
        { cmd: "AIDLC_DISABLE_SENSORS=1", desc: "Force sensors off. Also _LEARNINGS, _SUMMARY_CONFIRMATION." },
        { cmd: "AIDLC_DISABLE_PLAN_APPROVAL_GUARD=1", desc: "Force plan approval off." },
        { cmd: "AIDLC_DISABLE_COLLABORATORS=1", desc: "Run every stage lead-only." },
        { cmd: "NO_COLOR=1", desc: "Plain terminal output. --no-color for one command." },
      ],
    },
  ],
};
