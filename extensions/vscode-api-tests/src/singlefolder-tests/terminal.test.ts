/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, commands, Terminal, TerminalDimensionsChangeEvent } from 'vscode';
import { doesNotThrow, equal, ok } from 'assert';

suite('window namespace tests', () => {
	(process.platform === 'win32' ? suite.skip /* https://github.com/microsoft/vscode/issues/75689 */ : suite)('Terminal', () => {
		test('sendText immediately after createTerminal should not throw', () => {
			const terminal = window.createTerminal();
			doesNotThrow(terminal.sendText.bind(terminal, 'echo "foo"'));
			terminal.dispose();
		});

		test('onDidCloseTerminal event fires when terminal is disposed', (done) => {
			const terminal = window.createTerminal();
			const reg = window.onDidCloseTerminal((eventTerminal) => {
				equal(terminal, eventTerminal);
				reg.dispose();
				done();
			});
			terminal.dispose();
		});

		test('processId immediately after createTerminal should fetch the pid', (done) => {
			const terminal = window.createTerminal();
			terminal.processId.then(id => {
				ok(id > 0);
				terminal.dispose();
				done();
			});
		});

		test('name in constructor should set terminal.name', () => {
			const terminal = window.createTerminal('a');
			equal(terminal.name, 'a');
			terminal.dispose();
		});

		test('onDidOpenTerminal should fire when a terminal is created', (done) => {
			const reg1 = window.onDidOpenTerminal(term => {
				equal(term.name, 'b');
				reg1.dispose();
				const reg2 = window.onDidCloseTerminal(() => {
					reg2.dispose();
					done();
				});
				terminal.dispose();
			});
			const terminal = window.createTerminal('b');
		});

		test('createTerminalRenderer should fire onDidOpenTerminal and onDidCloseTerminal', (done) => {
			const reg1 = window.onDidOpenTerminal(term => {
				equal(term.name, 'c');
				reg1.dispose();
				const reg2 = window.onDidCloseTerminal(() => {
					reg2.dispose();
					done();
				});
				term.dispose();
			});
			window.createTerminalRenderer('c');
		});

		test('terminal renderers should get maximum dimensions set when shown', (done) => {
			let terminal: Terminal;
			const reg1 = window.onDidOpenTerminal(term => {
				reg1.dispose();
				term.show();
				terminal = term;
			});
			const renderer = window.createTerminalRenderer('foo');
			const reg2 = renderer.onDidChangeMaximumDimensions(dimensions => {
				ok(dimensions.columns > 0);
				ok(dimensions.rows > 0);
				reg2.dispose();
				const reg3 = window.onDidCloseTerminal(() => {
					reg3.dispose();
					done();
				});
				terminal.dispose();
			});
		});

		test('TerminalRenderer.write should fire Terminal.onData', (done) => {
			const reg1 = window.onDidOpenTerminal(terminal => {
				reg1.dispose();
				const reg2 = terminal.onDidWriteData(data => {
					equal(data, 'bar');
					reg2.dispose();
					const reg3 = window.onDidCloseTerminal(() => {
						reg3.dispose();
						done();
					});
					terminal.dispose();
				});
				renderer.write('bar');
			});
			const renderer = window.createTerminalRenderer('foo');
		});

		test('Terminal.sendText should fire Terminal.onInput', (done) => {
			const reg1 = window.onDidOpenTerminal(terminal => {
				reg1.dispose();
				const reg2 = renderer.onDidAcceptInput(data => {
					equal(data, 'bar');
					reg2.dispose();
					const reg3 = window.onDidCloseTerminal(() => {
						reg3.dispose();
						done();
					});
					terminal.dispose();
				});
				terminal.sendText('bar', false);
			});
			const renderer = window.createTerminalRenderer('foo');
		});

		test('onDidChangeActiveTerminal should fire when new terminals are created', (done) => {
			const reg1 = window.onDidChangeActiveTerminal((active: Terminal | undefined) => {
				equal(active, terminal);
				equal(active, window.activeTerminal);
				reg1.dispose();
				const reg2 = window.onDidChangeActiveTerminal((active: Terminal | undefined) => {
					equal(active, undefined);
					equal(active, window.activeTerminal);
					reg2.dispose();
					done();
				});
				terminal.dispose();
			});
			const terminal = window.createTerminal();
			terminal.show();
		});

		test('onDidChangeTerminalDimensions should fire when new terminals are created', (done) => {
			const reg1 = window.onDidChangeTerminalDimensions(async (event: TerminalDimensionsChangeEvent) => {
				equal(event.terminal, terminal1);
				equal(typeof event.dimensions.columns, 'number');
				equal(typeof event.dimensions.rows, 'number');
				ok(event.dimensions.columns > 0);
				ok(event.dimensions.rows > 0);
				reg1.dispose();
				let terminal2: Terminal;
				const reg2 = window.onDidOpenTerminal((newTerminal) => {
					// This is guarantees to fire before dimensions change event
					if (newTerminal !== terminal1) {
						terminal2 = newTerminal;
						reg2.dispose();
					}
				});
				let firstCalled = false;
				let secondCalled = false;
				const reg3 = window.onDidChangeTerminalDimensions((event: TerminalDimensionsChangeEvent) => {
					if (event.terminal === terminal1) {
						// The original terminal should fire dimension change after a split
						firstCalled = true;
					} else if (event.terminal !== terminal1) {
						// The new split terminal should fire dimension change
						secondCalled = true;
					}
					if (firstCalled && secondCalled) {
						terminal1.dispose();
						terminal2.dispose();
						reg3.dispose();
						done();
					}
				});
				await timeout(500);
				commands.executeCommand('workbench.action.terminal.split');
			});
			const terminal1 = window.createTerminal({ name: 'test' });
			terminal1.show();
		});

		test('hideFromUser terminal: onDidWriteData should work', done => {
			const terminal = window.createTerminal({ name: 'bg', hideFromUser: true });
			let data = '';
			terminal.onDidWriteData(e => {
				data += e;
				if (data.indexOf('foo') !== -1) {
					terminal.dispose();
					done();
				}
			});
			terminal.sendText('foo');
		});

		test('hideFromUser terminal: should be available to terminals API', done => {
			const terminal = window.createTerminal({ name: 'bg', hideFromUser: true });
			window.onDidOpenTerminal(t => {
				equal(t, terminal);
				equal(t.name, 'bg');
				ok(window.terminals.indexOf(terminal) !== -1);
				done();
			});
		});
	});
});

async function timeout(ms = 0): Promise<void> {
	return new Promise<void>(resolve => setTimeout(() => resolve(), ms));
}