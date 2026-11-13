
import * as vscode from 'vscode';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const IDLE_THRESHOLD = 5 * 60_000; // 5 minutes
const CODING_THRESHOLD = 60_000; // 1 minute
const API_TOKEN_KEY = 'vscodePresence.apiToken';
const DEFAULT_API_BASE_URL = 'https://melzar-api.vercel.app';

type PresenceStatus = 'coding' | 'viewing' | 'idle';

interface VSCodePresence {
    project: string;
    workspace: string;
    file: string;
    language: string;
    status: PresenceStatus;
    startedAtFile: number;
    startedAtProject: number;
    lastActivity: number;
}

let lastActivity = Date.now();
let lastEditAt = 0;
let currentProject = '';
let startedAtProject = Date.now();
let currentFileKey = '';
let startedAtFile = Date.now();
let isSending = false;
let tokenPromptShown = false;

export function activate(context: vscode.ExtensionContext) {
    console.log(
        'Congratulations, your extension "melzarr-vscode-rich-presence" is now active!'
    );

    const setTokenCommand = vscode.commands.registerCommand(
        'melzarrPresence.setApiToken',
        async () => {
            const token = await vscode.window.showInputBox({
                title: 'Configure VS Code Presence API Token',
                prompt: 'Enter the API token configured in your Vercel environment variables.',
                password: true,
                ignoreFocusOut: true,
            });

            if (!token?.trim()) {
                return;
            }

            await context.secrets.store(API_TOKEN_KEY, token.trim());

            tokenPromptShown = false;

            vscode.window.showInformationMessage(
                'VS Code Presence API token saved securely.'
            );

            await sendPresence(context);
        }
    );

    const documentChangeListener =
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.uri.scheme !== 'file') {
                return;
            }

            lastActivity = Date.now();
            lastEditAt = lastActivity;
        });

    const activeEditorListener =
        vscode.window.onDidChangeActiveTextEditor(() => {
            lastActivity = Date.now();
        });

    const selectionListener =
        vscode.window.onDidChangeTextEditorSelection(() => {
            lastActivity = Date.now();
        });

    context.subscriptions.push(
        setTokenCommand,
        documentChangeListener,
        activeEditorListener,
        selectionListener
    );

    void sendPresence(context);

    const heartbeat = setInterval(() => {
        void sendPresence(context);
    }, HEARTBEAT_INTERVAL);

    context.subscriptions.push({
        dispose: () => clearInterval(heartbeat),
    });
}

async function sendPresence(context: vscode.ExtensionContext) {
    if (isSending) {
        return;
    }

    const editor = vscode.window.activeTextEditor;

    // Resolve the folder that actually owns the active file, so multi-root
    // workspaces report the right project instead of always the first one.
    // Fall back to the first folder for editor states with no file URI.
    const workspace =
        (editor &&
            vscode.workspace.getWorkspaceFolder(editor.document.uri)) ||
        vscode.workspace.workspaceFolders?.[0];

    // No presence is reported without an active editor in a workspace folder;
    // this is intended, not a failure.
    if (!editor || !workspace) {
        return;
    }

    const token = await context.secrets.get(API_TOKEN_KEY);

    if (!token) {
        if (!tokenPromptShown) {
            tokenPromptShown = true;

            const action = await vscode.window.showWarningMessage(
                'VS Code Presence API token is not configured.',
                'Set API Token'
            );

            if (action === 'Set API Token') {
                await vscode.commands.executeCommand(
                    'melzarrPresence.setApiToken'
                );
            }
        }

        return;
    }

    const now = Date.now();
    const idleFor = now - lastActivity;

    const status: PresenceStatus =
        idleFor >= IDLE_THRESHOLD
            ? 'idle'
            : now - lastEditAt < CODING_THRESHOLD
                ? 'coding'
                : 'viewing';

    const file = getRelativeFilePath(editor, workspace);
    const project = workspace.name;
    const workspaceName = vscode.workspace.name ?? workspace.name;
    const language = editor.document.languageId;

    // Reset the project timer only when the project itself changes.
    if (project !== currentProject) {
        currentProject = project;
        startedAtProject = now;
    }

    // Reset the file timer only when the file (or its language) changes;
    // mere re-activation of the same editor should not restart it.
    const fileKey = `${file}:${language}`;

    if (fileKey !== currentFileKey) {
        currentFileKey = fileKey;
        startedAtFile = now;
    }

    const presence: VSCodePresence = {
        project,
        workspace: workspaceName,
        file,
        language,
        status,
        startedAtFile,
        startedAtProject,
        lastActivity,
    };

    const apiBaseUrl = vscode.workspace
        .getConfiguration('melzarrPresence')
        .get<string>('apiBaseUrl', DEFAULT_API_BASE_URL)
        .replace(/\/+$/, '');

    isSending = true;

    try {
        const response = await fetch(`${apiBaseUrl}/vscode/presence`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(presence),
            signal: AbortSignal.timeout(10_000),
        });

        // Read the body as text first so a non-JSON error response (an HTML
        // error page from a proxy, say) is reported rather than thrown.
        const body = await response.text();

        let result: unknown = body;

        try {
            result = body ? JSON.parse(body) : undefined;
        } catch {
            // Keep the raw text for the error message below.
        }

        if (!response.ok) {
            console.error(
                'VS Code Presence API error:',
                response.status,
                result
            );

            return;
        }

        console.log('Presence successfully sent:', presence);
    } catch (error) {
        console.error('Failed to send VS Code presence:', error);
    } finally {
        isSending = false;
    }
}

function getRelativeFilePath(
    editor: vscode.TextEditor | undefined,
    workspace: vscode.WorkspaceFolder | undefined
): string {
    if (!editor || !workspace) {
        return '';
    }

    return vscode.workspace.asRelativePath(
        editor.document.uri,
        false
    );
}

export function deactivate() {}
