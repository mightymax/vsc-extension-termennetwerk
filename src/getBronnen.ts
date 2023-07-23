import axios from 'axios';
import { Source } from './terminologiebron';

export default async (api: string) => {
  const payload = {
    query: "query Sources { sources { name uri, creators { uri alternateName } } }",
    variables:{}
  };
  return await axios.post(api, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  }).then(response => response.data)
  .then(data => Promise.resolve(data.data.sources as Source[]));
};
