# melzarr-vscode-rich-presence

A small VS Code extension that reports what you're working on to a personal presence API, so you can show whether you're actively building in VS Code.

## Features

- **Automatic presence reporting** — on startup the extension begins sending a heartbeat every 30 seconds to your presence API, so the reported state stays fresh even while you sit on the same file.
- **On/off toggle** — a status bar button on the right shows `Presence` when active and `Presence` struck through when not. Click it to start or stop all API calls, or run **VS Code Presence: Toggle Presence On/Off** from the Command Palette. The choice is saved in your settings and survives reloads; turning it off clears the heartbeat timer rather than merely skipping sends.
- **Activity-based status** — each heartbeat is classified as:

  | Status    | Meaning                                                              |
  | --------- | -------------------------------------------------------------------- |
  | `coding`  | You edited a file within the last minute.                             |
  | `viewing` | You had recent activity (editor switch, selection, edit), but no edit in the last minute. |
  | `idle`    | No activity at all for 5 minutes or more.                             |

  Activity is tracked from document changes, active-editor changes, and cursor/selection changes.

- **What gets reported** — the project (workspace folder name), the workspace name, the active file's path relative to the workspace, the file's language ID, the current status, the time the current file and current project were opened, and the timestamp of your last activity. In a multi-root workspace, the project is the folder that owns the active file.
- **Per-file and per-project timers** — `startedAtFile` resets only when you switch to a different file or language, and `startedAtProject` resets only when the project changes. Re-focusing the same editor doesn't restart either timer.
- **Secure token storage** — the API token is stored in VS Code's encrypted SecretStorage, never in your settings files.
- **Guided setup** — if no token is configured, a one-time warning offers to open the token prompt directly.
- **Fail-safe networking** — requests time out after 10 seconds and only one request is in flight at a time, so a slow or unreachable API can't pile up work.

## Requirements

- VS Code `1.125.0` or later.
- A running instance of the presence API that exposes `POST /vscode/presence`.
- An API token issued by that service.

## Installation

This extension is not published to the VS Code Marketplace, so install it from a `.vsix` package.

**Option A — download a release (no toolchain needed)**

1. Grab the latest `melzarr-vscode-rich-presence-<version>.vsix` from the [Releases page](https://github.com/melzarjanchico/melzarr-vscode-rich-presence/releases).
2. Install it either way:
   - **CLI:** `code --install-extension melzarr-vscode-rich-presence-0.0.1.vsix`
   - **GUI:** open the Extensions view (`Ctrl+Shift+X`), click the `...` menu, choose **Install from VSIX...**, and select the file.
3. Reload the window (`Ctrl+Shift+P` → *Developer: Reload Window*). The extension activates on startup.

**Option B — build from source**

```bash
git clone https://github.com/melzarjanchico/melzarr-vscode-rich-presence.git
cd melzarr-vscode-rich-presence
npm install
npm run package:vsix
code --install-extension melzarr-vscode-rich-presence-0.0.1.vsix
```

`npm run package:vsix` type-checks, lints, builds a production bundle, and produces the `.vsix` in the project root.

To update an installed copy, reinstall the newer `.vsix` with the same command plus `--force`, then reload the window. Editing the source does not affect an installed copy until you repackage.

## Setup

1. Deploy or start the presence API and note its base URL.
2. Point the extension at it using the `melzarrPresence.apiBaseUrl` setting.
3. Run **VS Code Presence: Set API Token** from the Command Palette and paste your token. It is saved in SecretStorage and a confirmation message appears.

Presence is only sent while a workspace is open and a text editor is active. This is intended: with no file to report there is nothing to send, so the last presence simply ages out on the receiving end.

## Extension Settings

- `melzarrPresence.enabled` — Whether heartbeats are sent. Defaults to `true`. Equivalent to the status bar toggle; changing it in the Settings UI takes effect immediately.
- `melzarrPresence.apiBaseUrl` — Base URL of the presence API. Defaults to `https://melzar-api.vercel.app`. Point it at `http://localhost:3000` to use a locally running API.

## Commands

- **VS Code Presence: Set API Token** (`melzarrPresence.setApiToken`) — Prompts for the API token and stores it securely. Re-run it at any time to replace the stored token.
- **VS Code Presence: Toggle Presence On/Off** (`melzarrPresence.toggle`) — Turns heartbeat sending on or off and updates the status bar button.

## API payload

Each heartbeat sends a `POST` to `<apiBaseUrl>/vscode/presence` with a bearer token:

```json
{
  "project": "melzarr-vscode-rich-presence",
  "workspace": "my-workspace",
  "file": "src/extension.ts",
  "language": "typescript",
  "status": "coding",
  "startedAtFile": 1763000000000,
  "startedAtProject": 1762990000000,
  "lastActivity": 1763000300000
}
```

## Known Issues

- Failures are surfaced only in the Extension Host log; the extension shows no in-editor indicator. A revoked or rotated API token therefore fails silently on every heartbeat — check the log if presence stops updating.

## Release Notes

### 0.0.1

Initial release: heartbeat-based presence reporting with activity-based status, secure token storage, and a configurable API base URL.

---

## Development

```bash
npm install
npm run compile      # type-check, lint, and bundle with esbuild
npm run package:vsix # build a production .vsix for installation
npm test             # run the test suite
```

Press `F5` in VS Code to launch an Extension Development Host for live debugging — faster than repackaging while iterating.

Note: `.vscodeignore` excludes development and local-only files from the package, including `.claude/`, `.env*`, `src/`, and source maps. Keep any file containing credentials out of the repository and out of that allowlist.

## Following extension guidelines

If you create an extension, we recommend that you follow the extension guidelines and best practices.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## License

No license has been specified for this repository yet. If you intend it for personal use, note that "no license" means others have no legal right to reuse it. Add a `LICENSE` file if you want to grant permissions.
