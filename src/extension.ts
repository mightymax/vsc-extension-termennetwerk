import * as vscode from 'vscode';
import terminologiebron, { Source } from './terminologiebron';
import search from './search';
import resultaat from './resultaat';
import getBronnen from './getBronnen';
export const API_URL = 'https://termennetwerk-api.netwerkdigitaalerfgoed.nl/graphql';
export async function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "termennetwerk-lookup" is now active!');
	const bronnen = await getBronnen(API_URL);

	let disposable = vscode.commands.registerCommand('termennetwerk.lookup', () => {
		terminologiebron(bronnen).show();
	});

	context.subscriptions.push(disposable);
}


export function deactivate() {}
