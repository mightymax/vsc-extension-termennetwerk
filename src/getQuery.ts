export default (sources: string[], query: string) => {
  return {
    query: `query Terms ($sources: [ID]!, $query: String!) {
      terms (sources: $sources query: $query queryMode: OPTIMIZED) {
        source {
          name
          uri
          alternateName
          description
          creators {
            name
            alternateName
            uri
          }
        }
        result {
          ... on Terms {
            terms {
              uri
              prefLabel
              altLabel
              hiddenLabel
              scopeNote
              seeAlso
              broader {
                uri
                prefLabel
              }
            narrower {
              uri
              prefLabel
            }
            related {
              uri
              prefLabel
            }
          }
        }
        ... on Error {
          __typename
          message
        }
      }
      responseTimeMs
    }
  }`,
    variables:{
      sources,
      query
    }
  };
};