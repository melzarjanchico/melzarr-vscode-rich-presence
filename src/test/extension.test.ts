import * as assert from 'assert';

import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	test('extension activates and registers the API token command', async () => {
		const extension = vscode.extensions.all.find((candidate) =>
			candidate.id.endsWith('melzarr-vscode-rich-presence')
		);

		assert.ok(extension, 'extension should be discoverable');

		await extension.activate();

		assert.strictEqual(extension.isActive, true, 'extension should be active');

		const commands = await vscode.commands.getCommands(true);

		assert.ok(
			commands.includes('melzarrPresence.setApiToken'),
			'melzarrPresence.setApiToken should be registered after activation'
		);
	});

	test('apiBaseUrl setting has a usable default', () => {
		const apiBaseUrl = vscode.workspace
			.getConfiguration('melzarrPresence')
			.get<string>('apiBaseUrl');

		assert.strictEqual(typeof apiBaseUrl, 'string');
		assert.ok(
			apiBaseUrl?.startsWith('http'),
			'apiBaseUrl should be an http(s) URL'
		);
	});
});