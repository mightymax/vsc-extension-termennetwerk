import getQuery from './getQuery';
import axios from 'axios';
import { Resultaat } from './resultaat';
import * as vscode from 'vscode';
import { API_URL } from './extension';
export default async (sources: string[], zoekwoorden: string): Promise<Resultaat[]> => {
  const query = getQuery(sources, zoekwoorden);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return axios.post(API_URL, query, { headers: { "Content-Type": "application/json" }})
    .then(response => response.data.data.terms as Resultaat[])
    .catch(_ => {
      vscode.window.showErrorMessage(`fout bij het zoeken naar "${zoekwoorden}" in bronnen ${sources.join(', ')}`);
      return Promise.reject();
    });
};
