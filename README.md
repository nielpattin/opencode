<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/sst/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/sst/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

This is a fork of Opencode that includes features from various upstream pull requests that I like.

Below is a summary of the added features along with their respective details.

---

### Features from Upstream PRs

| Commit      | Date       | Status | Feature                                                                | Upstream PR                                                        | Author         | Description                                     |
| ----------- | ---------- | ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------- | ----------------------------------------------- |
| `9d84a28d5` | 2026-01-02 | Open   | feat: implement double Ctrl+C to exit functionality with warning toast | [#4900](https://github.com/sst/opencode/pull/4900)                 | AmineGuitouni  | Double Ctrl+C to exit TUI with warning toast    |
| `8215242ee` | 2026-01-01 | Open   | fix: optimize Ripgrep.tree() for large repositories (109x faster)      | [#6507](https://github.com/sst/opencode/pull/6507)                 | Karavil        | Optimize tree building O(n²) to O(n)            |
| `a85806f28` | 2026-01-01 | Open   | feat(tui): add bash output viewer with ANSI color support              | [#4791](https://github.com/sst/opencode/pull/4791)                 | remorses       | Bash output viewer with ANSI colors             |
| `af206c22f` | 2025-12-28 | Merged | feat(tui): add /tools command to list available tools                  | [shuvcode#199](https://github.com/Latitudes-Dev/shuvcode/pull/199) | gergesh        | Adds a dialog to list available MCP/tools       |
| `c752cbfe6` | 2025-12-28 | Closed | feat(mcp): add command to restart all MCP servers                      | [#6219](https://github.com/sst/opencode/pull/6219)                 | Timorleiderman | Restart all MCP servers functionality           |
| `552fab64d` | 2025-12-27 | Open   | feat: show skills in status and sidebar                                | [#6154](https://github.com/sst/opencode/pull/6154)                 | connorads      | Display skills in status bar and sidebar        |
| `31abac05b` | 2025-12-27 | Open   | fix(tui): reopen autocomplete after backspace deletes space            | [#6031](https://github.com/sst/opencode/pull/6031)                 | Raviguntakala  | Fix autocomplete behavior on backspace          |
| `b1075bda0` | 2025-12-27 | Open   | fix: prevent symlink escape in Filesystem.contains                     | [#6403](https://github.com/sst/opencode/pull/6403)                 | jayhemnani9910 | Security fix for symlink traversal              |
| `cada484aa` | 2025-12-27 | Merged | feat: thinking & tool call visibility settings for /copy and /export   | [#6243](https://github.com/sst/opencode/pull/6243)                 | rektide        | Control visibility of thinking/tools in exports |
| `40546744f` | 2025-12-26 | Open   | feat(new tool): Adding a new tool to opencode -> askquestion tool      | [#5958](https://github.com/sst/opencode/pull/5958)                 | iljod          | New askquestion interactive tool                |
| `d25a47776` | 2025-12-26 | Open   | feat: add askPermission to plugin API                                  | [#6042](https://github.com/sst/opencode/pull/6042)                 | nielpattin     | Plugin permission API                           |
| `8f45f362f` | 2025-12-26 | Open   | fix(windows): better support MSYS/Git Bash path handling               | [#6082](https://github.com/sst/opencode/pull/6082)                 | nielpattin     | Windows path fix                                |
| `93678a121` | 2025-12-26 | Open   | feat: Added experimental TPS for model responses                       | [#6097](https://github.com/sst/opencode/pull/6097)                 | OpeOginni      | Show tokens per second metric                   |

### Custom Enhancements

- `40546744f` feat(new tool): Adding a new tool to opencode -> askquestion tool
  - `8a504151d` feat(tui): overhaul AskQuestion dialog UX and enforce prompt constraints
  - `9c9a0e292` fix(tui): implement double-confirmation exit safety in AskQuestion dialog

---

### Installation

```bash
# YOLO (On Windows use Git Bash, WSL for this method)
curl -fsSL https://opencode.ai/install | bash

# Package managers
npm i -g opencode-ai@latest        # or bun/pnpm/yarn
scoop bucket add extras; scoop install extras/opencode  # Windows
choco install opencode             # Windows
brew install opencode              # macOS and Linux
paru -S opencode-bin               # Arch Linux
mise use -g opencode               # Any OS
nix run nixpkgs#opencode           # or github:sst/opencode for latest dev branch
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$OPENCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if exists or can be created)
4. `$HOME/.opencode/bin` - Default fallback

```bash
# Examples
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Agents

OpenCode includes two built-in agents you can switch between,
you can switch between these using the `Tab` key.

- **build** - Default, full access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also, included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents).

### Documentation

For more info on how to configure OpenCode [**head over to our docs**](https://opencode.ai/docs).

### Contributing

If you're interested in contributing to OpenCode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as a part of its name; for example, "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with us in any way.

### FAQ

#### How is this different from Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although we recommend the models we provide through [OpenCode Zen](https://opencode.ai/zen); OpenCode can be used with Claude, OpenAI, Google or even local models. As models evolve the gaps between them will close and pricing will drop so being provider-agnostic is important.
- Out of the box LSP support
- A focus on TUI. OpenCode is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- A client/server architecture. This for example can allow OpenCode to run on your computer, while you can drive it remotely from a mobile app. Meaning that the TUI frontend is just one of the possible clients.

#### What's the other repo?

The other confusingly named repo has no relation to this one. You can [read the story behind it here](https://x.com/thdxr/status/1933561254481666466).

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
