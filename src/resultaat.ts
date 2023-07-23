import { DataFactory } from 'n3';
import * as vscode from 'vscode';

interface Term {
  uri: string
  prefLabel: string[]
  altLabel: string[]
  hiddenLabel: string[]
  scopeNote: string[]
  seeAlso: string[] 
  broader: ExtraTerms
  narrower: ExtraTerms
  related: ExtraTerms 
}

interface Source {
  name: string
  uri: string
  alternateName?: string
  description: string
  creators: Array<{
    name: string
    uri: string
    alternateName: string
  }>
}

type ExtraTerms = Array<{ uri: string, prefLabel: string[] }>;
export interface Resultaat {
 source: Source,
  result: {
    terms: Term[]
  },
  responseTimeMs: number
}
export default (zoekwoorden: string, results: Resultaat[]) => {
  const picker = vscode.window.createQuickPick();
  picker.matchOnDescription = true;
  picker.matchOnDetail = true;
  picker.canSelectMany = true;
  picker.onDidHide(() => picker.dispose());
  const items: vscode.QuickPickItem[] = [];
  results.map(result => {
    items.push({
      kind: vscode.QuickPickItemKind.Separator,
      label: result.source.creators[0].alternateName
    });
    result.result.terms.map(term => {
      items.push({
        label: term.prefLabel[0], 
        description: term.altLabel.join(', '), 
        detail: term.scopeNote.join('\n'),
        // @ts-ignore
        term,
        // @ts-ignore
        source: result.source
      });
    });
  });
  picker.items = items;

  picker.onDidAccept(() => {
    const selectedItems = [ ...picker.selectedItems ];

    picker.dispose();
   	if (!vscode.workspace  || !vscode.window.activeTextEditor) { 
      vscode.window.showInformationMessage('Om termen te gebruiken moet je een document open hebben.', {
        modal: true,
        detail: selectedItems.map(result => result.label).join('\n')
      });
      return; 
    }
    vscode.window.activeTextEditor!.edit(editBuilder => {
      const languageId = vscode.window.activeTextEditor!.document.languageId;
      let snippet = '';
      switch (languageId) {
        case 'json':
          snippet = JSON.stringify(selectedItems, null, 2);
          break;
        case 'ttl':
        case 'turtle':
        case 'trig':
          snippet = turtle(selectedItems);
          break;
        case 'ntriples':
          snippet = ntriples(selectedItems, languageId);
          break;
        case 'plaintext':
        case 'markdown':
          snippet = markdown(zoekwoorden, selectedItems, languageId);
          break;
        default:
          vscode.window.showInformationMessage(`Geen snippets beschikbaar voor documenttype '${languageId}'`);
          snippet = markdown(zoekwoorden, selectedItems, languageId);
          break;
      }

      editBuilder.replace(
        vscode.window.activeTextEditor!.selection, 
        snippet
      );
    });
  });
  return picker;
};

const config = (id: string): boolean  => 
  vscode.workspace.getConfiguration().get(`conf.settingsEditor.termennetwerk.${id}`)!;


const markdown = (zoekwoorden: string, selectedItems: Readonly<vscode.QuickPickItem[]>, languageId: string) => {
  let md = `# Resultaat voor zoekopdracht '${zoekwoorden}':`;

  // group by Bron:
  const bronnen: Map<string, {terms: Term[], source: Source}> = new Map();
  selectedItems.forEach(selectedItem => {
    // @ts-ignore
    const source = selectedItem.source as Source;
    // @ts-ignore
    const terms = selectedItem.terms as Term[];
    if (!bronnen.has(source.uri)) {bronnen.set(source.uri, { source: source, terms: [] });};
    bronnen.get(source.uri)!.terms.push(...terms);
  });

  bronnen.forEach((bron) => {
    md += `\n## ${bron.source.name}`;
    md += `\n${bron.source.description}`;
    md += `\n\n*bronhouder:* ${bron.source.creators.map(creator => `[${creator.name}](${creator.uri}) (${creator.alternateName})`).join(', ')}`;

    bron.terms.forEach(term => {
      md+= `\n\n### [**${term.prefLabel.join(', ')}**](${term.uri})`;
      if (config('scopeNote') && term.scopeNote.length) {
        md += `\n- *Toelichting*: ${term.scopeNote.join(', ')}`;
      }
      if (config('scopeNote') && term.altLabel.length) {
        md += `\n- *Alternatieve labels*: ${term.altLabel.join(', ')}`;
      }
      if (config('hiddenLabel') && term.hiddenLabel.length) {
        md += `\n- *Verborgen labels*: ${term.hiddenLabel.join(', ')}`;
      }
      if (config('seeAlso') && term.seeAlso.length) {
        md += `\n- *Zie ook*: ${term.seeAlso.map(seeAlso => `\n   - ${seeAlso}`).join('')}`;
      }
      if (config('broader') && term.broader.length) {
        md += `\n- *Bovenliggende term(em)*: ${term.broader.map(broader => `[${broader.prefLabel}](${broader.uri})`).join(', ')}`;
      }
      if (config('narrower') && term.narrower.length) {
        md += `\n- *Onderschikkende term(em)*: ${term.narrower.map(narrower => `[${narrower.prefLabel}](${narrower.uri})`).join(', ')}`;
      }
      if (config('related') && term.related.length) {
        md += `\n- *Gerelateerde term(em)*: ${term.related.map(related => `[${related.prefLabel}](${related.uri})`).join(', ')}`;
      }
    });
  });
  return languageId === 'md' ? md : md.split('\n').map(line => line.replace(/\*(.+)\*/g, '$1').replace(/^\#+ {0,}/g, '')).join('\n');
};

const prefixer = {
  rdf: (suffix: string) => `http://www.w3.org/1999/02/22-rdf-syntax-ns#${suffix}`,
  skos: (suffix: string) => `http://www.w3.org/2004/02/skos/core#${suffix}`,
  owl: (suffix: string) => `http://www.w3.org/2002/07/owl#${suffix}`,
  a: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
};

const ntriples = (selectedItems: Readonly<vscode.QuickPickItem[]>, languageId: string) => {
  let triples = '';
  selectedItems.forEach(selectedItem => {
    // @ts-ignore
    const term = selectedItem.term as Term;
    if (!config('createGraph')) {
      triples += `\n[] <${prefixer.owl('seeAlso')}> <${term.uri}> .`;
    } else {
      triples += `<${term.uri}> ${prefixer.a} ${prefixer.skos('Concept')} .`
      if (config('prefLabel') && term.prefLabel.length) {
        triples += term.prefLabel.map(literal => `\n<${term.uri}> <${prefixer.skos('prefLabel')}> ${DataFactory.literal(literal).value} .`)
          .join('');
      }
      if (config('scopeNote') && term.scopeNote.length) {
        triples += term.scopeNote.map(literal => `\n<${term.uri}> <${prefixer.skos('scopeNote')}> ${DataFactory.literal(literal).value} .`)
          .join('');
      }
      if (config('altLabel') && term.altLabel.length) {
        triples += term.altLabel.map(literal => `\n<${term.uri}> <${prefixer.skos('altLabel')}> ${DataFactory.literal(literal).value} .`)
          .join('');
      }
      if (config('hiddenLabel') && term.hiddenLabel.length) {
        triples += term.hiddenLabel.map(literal => `\n<${term.uri}> <${prefixer.skos('hiddenLabel')}> ${DataFactory.literal(literal).value} .`)
          .join('');
      }
      if (config('seeAlso') && term.seeAlso.length) {
        triples += term.seeAlso.map(uri => `\n<${term.uri}> <${prefixer.skos('seeAlso')}> <${uri}> .`)
          .join('');
      }
      if (config('broader') && term.broader.length) {
        triples += term.broader.map(uri => `\n<${term.uri}> <${prefixer.skos('broader')}> <${uri.uri}> .\n <${uri.uri}> <${prefixer.skos('prefLabel')}>  ${DataFactory.literal(uri.prefLabel.pop() ?? '[no prefLabel]').value} .`)
          .join('');
      }
      if (config('narrower') && term.narrower.length) {
        triples += term.narrower.map(uri => `\n<${term.uri}> <${prefixer.skos('narrower')}> <${uri.uri}> .\n <${uri.uri}> <${prefixer.skos('prefLabel')}>  ${DataFactory.literal(uri.prefLabel.pop() ?? '[no prefLabel]').value} .`)
          .join('');
      }
      if (config('related') && term.related.length) {
        triples += term.related.map(uri => `\n<${term.uri}> <${prefixer.skos('related')}> <${uri.uri}> .\n <${uri.uri}> <${prefixer.skos('prefLabel')}>  ${DataFactory.literal(uri.prefLabel.pop() ?? '[no prefLabel]').value} .`)
          .join('');
      }
      triples += `\n`;
    }
  });
  return triples;
}

const iris = (iris: string[]) => iris.map(iri => `<${iri}>`).join(', ');
const uris = (uris: ExtraTerms) => uris.map(uri => `<${uri.uri}>`).join(', ') ;
const literals = (literals: string[]) => literals.map(literal => `"${DataFactory.literal(literal).value}"`).join(', ');

const turtle = (selectedItems: Readonly<vscode.QuickPickItem[]>) => {
  let turtle = '';
  selectedItems.forEach(selectedItem => {
    // @ts-ignore
    const term = selectedItem.term as Term;
    if (!config('createGraph')) {
      turtle += `<${term.uri}>`;
    } else {
      turtle += `<${term.uri}> a skos:Concept ;`
      if (config('prefLabel') && term.prefLabel.length) {
          turtle += `\n  skos:prefLabel ${literals(term.prefLabel)} ;` ;
      }
      if (config('scopeNote') && term.scopeNote.length) {
        turtle += `\n  skos:scopeNote ${literals(term.scopeNote)} ;`;
      }
      if (config('altLabel') && term.altLabel.length) {
        turtle += `\n  skos:altLabel ${literals(term.altLabel)}`;
      }
      if (config('hiddenLabel') && term.hiddenLabel.length) {
        turtle += `\n  skos:hiddenLabel ${literals(term.hiddenLabel)} ;`;
      }
      if (config('seeAlso') && term.seeAlso.length) {
        turtle += `\n  owl:seeAlso ${iris(term.seeAlso)} ;`;
      }
      if (config('broader') && term.broader.length) {
        turtle += `\n  skos:broader ${uris(term.broader)} ;`;
      }
      if (config('narrower') && term.narrower.length) {
        turtle += `\n  skos:narrower ${uris(term.narrower)} ;`;
      }
      if (config('related') && term.related.length) {
        turtle += `\n  skos:related ${uris(term.related)} ;`;
      }
      turtle += `\n.\n`;
    }
  })

  return turtle ;
};
