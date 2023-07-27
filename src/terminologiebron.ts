import axios from 'axios';
import * as vscode from 'vscode';
import search from './search';
import resultaat from './resultaat';

export interface Source {
  name: string,
  uri: string,
  creators: Array<{uri: string, alternateName: string}>
}
export default (sources: Source[]) => {
  const picker = vscode.window.createQuickPick();
  picker.matchOnDescription = true;
  picker.matchOnDetail = true;
  picker.canSelectMany = vscode.workspace.getConfiguration().get('conf.settingsEditor.termennetwerk.meerdereBronnenToestaan') ?? true;
  picker.title = picker.canSelectMany ? 'Selecteer één of meerdere terminologiebronnen:' : 'Selecteen een terminologiebron';
  picker.onDidHide(() => picker.dispose());
  picker.items = sources.map(source => {
		return { label: source.name, description: source.creators.pop()?.alternateName, detail: source.uri };
	});
  picker.onDidAccept(async () => {
		if (picker.selectedItems.length === 0) {
      picker.dispose();
      return;
    }
    const selectedBronnen = picker.selectedItems;
    picker.dispose();
		const zoekwoorden = await vscode.window.showInputBox({prompt: "Zoekwoorden:"});
		if (zoekwoorden) {
			const results = resultaat(
        zoekwoorden,
				await search(selectedBronnen.map(bron => bron.detail!), zoekwoorden)
			);
			if (results.items.filter(item => item.kind !== vscode.QuickPickItemKind.Separator).length === 0) {
				vscode.window.showWarningMessage(`Geen resultaat gevonden voor '${zoekwoorden}'.`);
        results.dispose();
				return;
			}
			results.show();
		}
  });
  return picker;
};
