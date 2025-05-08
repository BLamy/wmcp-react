interface ParsedQuery {
  $filter?: string;
  $select?: string[];
}

function parseODataQuery(queryString: string): ParsedQuery {
  const params = new URLSearchParams(queryString);
  const result: ParsedQuery = {};

  if (params.has('$filter')) {
    result.$filter = params.get('$filter') || undefined;
  }

  if (params.has('$select')) {
    result.$select = params
      .get('$select')
      ?.split(',')
      .map((s) => s.trim());
  }

  return result;
}

export { parseODataQuery };
