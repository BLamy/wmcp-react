// Sample files for the debugger


export const testStatuses = {
    'odata.spec / parseODataQuery / should parse $filter': 'passed',
    'odata.spec / parseODataQuery / should parse $select': 'passed',
    'odata.spec / parseODataQuery / should parse $expand': 'passed',
    'odata.spec / parseODataQuery / should parse $top': 'passed',
    'odata.spec / parseODataQuery / should parse $skip': 'passed',
    'odata.spec / parseODataQuery / should parse $orderby': 'passed',
    'odata.spec / parseODataQuery / should parse $count': 'passed',
    'odata.spec / parseODataQuery / should parse $search': 'passed',
    'odata.spec / parseODataQuery / should parse $format': 'passed',
    'odata.spec / parseODataQuery / should parse $compute': 'passed',
    'odata.spec / parseODataQuery / should parse $apply': 'passed',
    'odata.spec / parseODataQuery / should parse multiple query options': 'passed'
  } as Record<string, 'passed' | 'failed' | 'unknown'>;
export const files = {
    "odata.ts": {
        file: {
            contents: /* ts */ `interface ParsedQuery {
  $filter?: string;
  $select?: string[];
  $expand?: string[];
  $top?: number;
  $skip?: number;
  $orderby?: Array<{ field: string; order: 'asc' | 'desc' }>;
  $count?: boolean;
  $search?: string;
  $format?: string;
  $compute?: string[];
  $apply?: string;
}

function parseODataQuery(queryString: string): ParsedQuery {
  const params = new URLSearchParams(queryString);
  const result: ParsedQuery = {};

  if (params.has('$filter')) {
    result.$filter = params.get('$filter') || undefined;
  }

  if (params.has('$select')) {
    result.$select = params.get('$select')?.split(',').map(s => s.trim());
  }

  if (params.has('$expand')) {
    result.$expand = params.get('$expand')?.split(',').map(s => s.trim());
  }

  if (params.has('$top')) {
    result.$top = parseInt(params.get('$top') || '0', 10);
  }

  if (params.has('$skip')) {
    result.$skip = parseInt(params.get('$skip') || '0', 10);
  }

  if (params.has('$orderby')) {
    result.$orderby = params.get('$orderby')?.split(',').map(item => {
      const [field, order] = item.trim().split(' ');
      return { field, order: order?.toLowerCase() === 'desc' ? 'desc' : 'asc' };
    });
  }

  if (params.has('$count')) {
    result.$count = params.get('$count')?.toLowerCase() === 'true';
  }

  if (params.has('$search')) {
    result.$search = params.get('$search') || undefined;
  }

  if (params.has('$format')) {
    result.$format = params.get('$format') || undefined;
  }

  if (params.has('$compute')) {
    result.$compute = params.get('$compute')?.split(',').map(s => s.trim());
  }

  if (params.has('$apply')) {
    result.$apply = params.get('$apply') || undefined;
  }

  return result;
}

export { parseODataQuery, ParsedQuery };
`
        }
    },
    "odata.spec.ts": {
      file: {
        contents: /* ts */ `import { describe, it, expect } from 'vitest';
import { parseODataQuery } from '../index';

describe('parseODataQuery', () => {
  it('should parse $filter', () => {
    const query = '$filter=Name eq \\'John\\' and Age gt 18';
    const result = parseODataQuery(query);
    expect(result.$filter).toBe('Name eq \\'John\\' and Age gt 18');
  });

  it('should parse $select', () => {
    const query = '$select=Name, Age, Email';
    const result = parseODataQuery(query);
    expect(result.$select).toEqual(['Name', 'Age', 'Email']);
  });

  it('should parse $expand', () => {
    const query = '$expand=Orders, CustomerInfo';
    const result = parseODataQuery(query);
    expect(result.$expand).toEqual(['Orders', 'CustomerInfo']);
  });

  it('should parse $top', () => {
    const query = '$top=10';
    const result = parseODataQuery(query);
    expect(result.$top).toBe(10);
  });

  it('should parse $skip', () => {
    const query = '$skip=20';
    const result = parseODataQuery(query);
    expect(result.$skip).toBe(20);
  });

  it('should parse $orderby', () => {
    const query = '$orderby=Name asc, Age desc';
    const result = parseODataQuery(query);
    expect(result.$orderby).toEqual([
      { field: 'Name', order: 'asc' },
      { field: 'Age', order: 'desc' }
    ]);
  });

  it('should parse $count', () => {
    const query = '$count=true';
    const result = parseODataQuery(query);
    expect(result.$count).toBe(true);
  });

  it('should parse $search', () => {
    const query = '$search="blue OR green"';
    const result = parseODataQuery(query);
    expect(result.$search).toBe('"blue OR green"');
  });

  it('should parse $format', () => {
    const query = '$format=json';
    const result = parseODataQuery(query);
    expect(result.$format).toBe('json');
  });

  it('should parse $compute', () => {
    const query = '$compute=Amount mul UnitPrice as TotalAmount';
    const result = parseODataQuery(query);
    expect(result.$compute).toEqual(['Amount mul UnitPrice as TotalAmount']);
  });

  it('should parse $apply', () => {
    const query = '$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))';
    const result = parseODataQuery(query);
    expect(result.$apply).toBe('groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))');
  });

  it('should parse multiple query options', () => {
    const query = '$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search="urgent"&$format=json';
    const result = parseODataQuery(query);
    expect(result).toEqual({
      $filter: 'Age gt 18',
      $select: ['Name', 'Email'],
      $expand: ['Orders'],
      $top: 5,
      $skip: 10,
      $orderby: [{ field: 'Name', order: 'asc' }],
      $count: true,
      $search: '"urgent"',
      $format: 'json'
    });
  });
});`,
      },
    },
  };
  
  // Sample debug steps
  export const debugSteps = {
    "odata.spec.ts": {
      "parseODataQuery": {
        "should parse $filter": [
            {
                line: 5,
                file: "odata.spec.ts",
                sourceCode: "it('should parse $filter', () => {",
                vars: {},
            },
            {
                line: 6,
                file: "odata.spec.ts",
                sourceCode: "const query = '$filter=Name eq \'John\' and Age gt 18';",
                vars: {},
            },
            {
                line: 7,
                file: "odata.spec.ts",
                sourceCode: "const result = parseODataQuery(query);",
                vars: {
                    query: "$filter=Name eq 'John' and Age gt 18",
                },
            },
            {
                line: 16,
                file: "odata.ts",
                sourceCode: "const params = new URLSearchParams(queryString);",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                },
            },
            {
                line: 17,
                file: "odata.ts",
                sourceCode: "const result: ParsedQuery = {};",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 19,
                file: "odata.ts",
                sourceCode: "if (params.has('$filter')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {},
                },
            },
            {
                line: 20,
                file: "odata.ts",
                sourceCode: "result.$filter = params.get('$filter') || undefined;",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {},
                },
            },
            {
                line: 23,
                file: "odata.ts",
                sourceCode: "if (params.has('$select')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 27,
                file: "odata.ts",
                sourceCode: "if (params.has('$expand')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 31,
                file: "odata.ts",
                sourceCode: "if (params.has('$top')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 35,
                file: "odata.ts",
                sourceCode: "if (params.has('$skip')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 39,
                file: "odata.ts",
                sourceCode: "if (params.has('$orderby')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },

            {
                line: 46,
                file: "odata.ts",
                sourceCode: "if (params.has('$count')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",    
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 50,
                file: "odata.ts",
                sourceCode: "if (params.has('$search')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 54,
                file: "odata.ts",
                sourceCode: "if (params.has('$format')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 58,
                file: "odata.ts",
                sourceCode: "if (params.has('$compute')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 62,
                file: "odata.ts",
                sourceCode: "if (params.has('$apply')) {",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 66,
                file: "odata.ts",
                sourceCode: "return result;",
                vars: {
                    queryString: "$filter=Name eq 'John' and Age gt 18",
                    params: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 8,
                file: "odata.spec.ts",
                sourceCode: "expect(result.$filter).toBe('Name eq \'John\' and Age gt 18')",
                vars: {
                    query: "$filter=Name eq 'John' and Age gt 18",
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            },
            {
                line: 9,
                file: "odata.spec.ts",
                sourceCode: "})",
                vars: {
                    query: "$filter=Name eq 'John' and Age gt 18",
                    result: {
                        $filter: "Name eq 'John' and Age gt 18",
                    },
                },
            }
        ],
        "should parse $select": [
            {
                line: 11,
                file: "odata.spec.ts",
                sourceCode: "it('should parse $select', () => {",
                vars: {},
            },
            {
                line: 12,
                file: "odata.spec.ts",
                sourceCode: "const query = '$select=Name, Age, Email';",
                vars: {},
            },
            {
                line: 13,
                file: "odata.spec.ts",
                sourceCode: "const result = parseODataQuery(query);",
                vars: {
                    query: "$select=Name, Age, Email",
                },
            },
            {
                line: 16,
                file: "odata.ts",
                sourceCode: "const params = new URLSearchParams(queryString);",
                vars: {
                    queryString: "$select=Name, Age, Email",
                },
            },
            {
                line: 17,
                file: "odata.ts",
                sourceCode: "const result: ParsedQuery = {};",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                },
            },
            {
                line: 19,
                file: "odata.ts",
                sourceCode: "if (params.has('$filter')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {},
                },
            },

            {
                line: 23,
                file: "odata.ts",
                sourceCode: "if (params.has('$select')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                    },
                },
            },
            {
                line: 24,
                file: "odata.ts",
                sourceCode: "result.$select = params.get('$select')?.split(',').map(s => s.trim());",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                    },
                },
            },
            {
                line: 27,
                file: "odata.ts",
                sourceCode: "if (params.has('$expand')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 31,
                file: "odata.ts",
                sourceCode: "if (params.has('$top')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 35,
                file: "odata.ts",
                sourceCode: "if (params.has('$skip')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 39,
                file: "odata.ts",
                sourceCode: "if (params.has('$orderby')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },

            {
                line: 46,
                file: "odata.ts",
                sourceCode: "if (params.has('$count')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 50,
                file: "odata.ts",
                sourceCode: "if (params.has('$search')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 54,
                file: "odata.ts",
                sourceCode: "if (params.has('$format')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 58,
                file: "odata.ts",
                sourceCode: "if (params.has('$compute')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: "Name, Age, Email",
                    },
                },
            },
            {
                line: 62,
                file: "odata.ts",
                sourceCode: "if (params.has('$apply')) {",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 66,
                file: "odata.ts",
                sourceCode: "return result;",
                vars: {
                    queryString: "$select=Name, Age, Email",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 14,
                file: "odata.spec.ts",
                sourceCode: "expect(result.$select).toEqual(['Name', 'Age', 'Email'])",
                vars: {
                    query: "$select=Name, Age, Email",
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            },
            {
                line: 15,
                file: "odata.spec.ts",
                sourceCode: "})",
                vars: {
                    query: "$select=Name, Age, Email",
                    result: {
                        $select: ['Name', 'Age', 'Email'],
                    },
                },
            }
        ],
        "should parse $expand": [
            {
                line: 17,
                file: "odata.spec.ts",
                sourceCode: "it('should parse $expand', () => {",
                vars: {},
            },
            {
                line: 18,
                file: "odata.spec.ts",
                sourceCode: "const query = '$expand=Orders, CustomerInfo';",
                vars: {},
            },
            {
                line: 19,
                file: "odata.spec.ts",
                sourceCode: "const result = parseODataQuery(query);",
                vars: {
                    query: "$expand=Orders, CustomerInfo",
                },
            },
            {
                line: 16,
                file: "odata.ts",
                sourceCode: "const params = new URLSearchParams(queryString);",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                },
            },
            {
                line: 17,
                file: "odata.ts",
                sourceCode: "const result: ParsedQuery = {};",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                },
            },
            {
                line: 19,
                file: "odata.ts",
                sourceCode: "if (params.has('$filter')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {},
                },
            },
            {
                line: 23,
                file: "odata.ts",
                sourceCode: "if (params.has('$select')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                    },
                },
            },
            {
                line: 27,
                file: "odata.ts",
                sourceCode: "if (params.has('$expand')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $select: "Name, Age, Email",
                    },
                    result: {
                    },
                },
            },
            {
                line: 28,
                file: "odata.ts",
                sourceCode: "result.$expand = params.get('$expand')?.split(',').map(s => s.trim());",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                    },
                },
            },
            {
                line: 31,
                file: "odata.ts",
                sourceCode: "if (params.has('$top')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 35,
                file: "odata.ts",
                sourceCode: "if (params.has('$skip')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",    
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 39,
                file: "odata.ts",
                sourceCode: "if (params.has('$orderby')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },

            {
                line: 46,
                file: "odata.ts",
                sourceCode: "if (params.has('$count')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 50,
                file: "odata.ts",
                sourceCode: "if (params.has('$search')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 54,
                file: "odata.ts",
                sourceCode: "if (params.has('$format')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 58,
                file: "odata.ts",
                sourceCode: "if (params.has('$compute')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 62,
                file: "odata.ts",
                sourceCode: "if (params.has('$apply')) {",
                vars: {
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 66,
                file: "odata.ts",
                sourceCode: "return result;",
                vars: { 
                    queryString: "$expand=Orders, CustomerInfo",
                    params: {
                        $expand: "Orders, CustomerInfo",
                    },
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 20,
                file: "odata.spec.ts",
                sourceCode: "expect(result.$expand).toEqual(['Orders', 'CustomerInfo'])",
                vars: {
                    query: "$expand=Orders, CustomerInfo",
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            },
            {
                line: 21,
                file: "odata.spec.ts",
                sourceCode: "})",
                vars: {
                    query: "$expand=Orders, CustomerInfo",
                    result: {
                        $expand: ['Orders', 'CustomerInfo'],
                    },
                },
            }
        ],  
"should parse $top": [
  /* spec ‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑ */
  { line: 23, file: "odata.spec.ts", sourceCode: "it('should parse $top', () => {", vars: {} },
  { line: 24, file: "odata.spec.ts", sourceCode: "const query = '$top=10';", vars: {} },
  { line: 25, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", vars: { query: "$top=10" } },

  /* src: first 2 lines inside parseODataQuery */
  { line: 16, file: "odata.ts", sourceCode: "const params = new URLSearchParams(queryString);", vars: { queryString: "$top=10" } },
  { line: 17, file: "odata.ts", sourceCode: "const result: ParsedQuery = {};", vars: { queryString: "$top=10", params: { $top: "10" } } },

  /* each conditional check in order, identical pattern */
  { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: {} } },
  { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: {} } },
  { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: {} } },
  { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: {} } },
  { line: 32, file: "odata.ts", sourceCode: "result.$top = parseInt(params.get('$top') || '0', 10);", vars: { queryString: "$top=10", params: { $top: "10" }, result: {} } },

  /* remaining conditionals now show $top on result */
  { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: { $top: 10 } } },
  { line: 39, file: "odata.ts", sourceCode: "if (params.has('$orderby')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: { $top: 10 } } },
  { line: 46, file: "odata.ts", sourceCode: "if (params.has('$count')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: { $top: 10 } } },
  { line: 50, file: "odata.ts", sourceCode: "if (params.has('$search')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: { $top: 10 } } },
  { line: 54, file: "odata.ts", sourceCode: "if (params.has('$format')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: { $top: 10 } } },
  { line: 58, file: "odata.ts", sourceCode: "if (params.has('$compute')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: { $top: 10 } } },
  { line: 62, file: "odata.ts", sourceCode: "if (params.has('$apply')) {", vars: { queryString: "$top=10", params: { $top: "10" }, result: { $top: 10 } } },
  { line: 66, file: "odata.ts", sourceCode: "return result;", vars: { queryString: "$top=10", params: { $top: "10" }, result: { $top: 10 } } },

  /* assertion + close */
  { line: 26, file: "odata.spec.ts", sourceCode: "expect(result.$top).toBe(10)", vars: { query: "$top=10", result: { $top: 10 } } },
  { line: 27, file: "odata.spec.ts", sourceCode: "})", vars: { query: "$top=10", result: { $top: 10 } } }
],

"should parse $skip": [
  { line: 29, file: "odata.spec.ts", sourceCode: "it('should parse $skip', () => {", vars: {} },
  { line: 30, file: "odata.spec.ts", sourceCode: "const query = '$skip=20';", vars: {} },
  { line: 31, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", vars: { query: "$skip=20" } },

  { line: 16, file: "odata.ts", sourceCode: "const params = new URLSearchParams(queryString);", vars: { queryString: "$skip=20" } },
  { line: 17, file: "odata.ts", sourceCode: "const result: ParsedQuery = {};", vars: { queryString: "$skip=20", params: { $skip: "20" } } },

  { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: {} } },
  { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: {} } },
  { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: {} } },
  { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: {} } },
  { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: {} } },
  { line: 36, file: "odata.ts", sourceCode: "result.$skip = parseInt(params.get('$skip') || '0', 10);", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: {} } },

  { line: 39,  file: "odata.ts", sourceCode: "if (params.has('$orderby')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: { $skip: 20 } } },
  { line: 46,  file: "odata.ts", sourceCode: "if (params.has('$count')) {",  vars: { queryString: "$skip=20", params: { $skip: "20" }, result: { $skip: 20 } } },
  { line: 50,  file: "odata.ts", sourceCode: "if (params.has('$search')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: { $skip: 20 } } },
  { line: 54,  file: "odata.ts", sourceCode: "if (params.has('$format')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: { $skip: 20 } } },
  { line: 58,  file: "odata.ts", sourceCode: "if (params.has('$compute')) {", vars: { queryString: "$skip=20", params: { $skip: "20" }, result: { $skip: 20 } } },
  { line: 62,  file: "odata.ts", sourceCode: "if (params.has('$apply')) {",  vars: { queryString: "$skip=20", params: { $skip: "20" }, result: { $skip: 20 } } },
  { line: 66,  file: "odata.ts", sourceCode: "return result;",                   vars: { queryString: "$skip=20", params: { $skip: "20" }, result: { $skip: 20 } } },

  { line: 32, file: "odata.spec.ts", sourceCode: "expect(result.$skip).toBe(20)", vars: { query: "$skip=20", result: { $skip: 20 } } },
  { line: 33, file: "odata.spec.ts", sourceCode: "})", vars: { query: "$skip=20", result: { $skip: 20 } } }
],

"should parse $orderby": [
  { line: 35, file: "odata.spec.ts", sourceCode: "it('should parse $orderby', () => {", vars: {} },
  { line: 36, file: "odata.spec.ts", sourceCode: "const query = '$orderby=Name asc, Age desc';", vars: {} },
  { line: 37, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", vars: { query: "$orderby=Name asc, Age desc" } },

  { line: 16, file: "odata.ts", sourceCode: "const params = new URLSearchParams(queryString);", vars: { queryString: "$orderby=Name asc, Age desc" } },
  { line: 17, file: "odata.ts", sourceCode: "const result: ParsedQuery = {};", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" } } },

  { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: {} } },
  { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: {} } },
  { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: {} } },
  { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {",     vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: {} } },
  { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {",    vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: {} } },
  { line: 39, file: "odata.ts", sourceCode: "if (params.has('$orderby')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: {} } },
  { line: 40, file: "odata.ts", sourceCode: "result.$orderby = params.get('$orderby')?.split(',').map(item => {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: {} } },

  /* after assignment */
  { line: 46, file: "odata.ts", sourceCode: "if (params.has('$count')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: { $orderby: [ { field: "Name", order: "asc" }, { field: "Age", order: "desc" } ] } } },
  { line: 50, file: "odata.ts", sourceCode: "if (params.has('$search')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: { $orderby: [ { field: "Name", order: "asc" }, { field: "Age", order: "desc" } ] } } },
  { line: 54, file: "odata.ts", sourceCode: "if (params.has('$format')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: { $orderby: [ { field: "Name", order: "asc" }, { field: "Age", order: "desc" } ] } } },
  { line: 58, file: "odata.ts", sourceCode: "if (params.has('$compute')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: { $orderby: [ { field: "Name", order: "asc" }, { field: "Age", order: "desc" } ] } } },
  { line: 62, file: "odata.ts", sourceCode: "if (params.has('$apply')) {", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: { $orderby: [ { field: "Name", order: "asc" }, { field: "Age", order: "desc" } ] } } },
  { line: 66, file: "odata.ts", sourceCode: "return result;", vars: { queryString: "$orderby=Name asc, Age desc", params: { $orderby: "Name asc, Age desc" }, result: { $orderby: [ { field: "Name", order: "asc" }, { field: "Age", order: "desc" } ] } } },

  { line: 38, file: "odata.spec.ts", sourceCode: "expect(result.$orderby).toEqual([", vars: { query: "$orderby=Name asc, Age desc", result: { $orderby: [ { field: "Name", order: "asc" }, { field: "Age", order: "desc" } ] } } },
  { line: 42, file: "odata.spec.ts", sourceCode: "})", vars: { query: "$orderby=Name asc, Age desc", result: { $orderby: [ { field: "Name", order: "asc" }, { field: "Age", order: "desc" } ] } } }
],

"should parse $count": [
  { line: 44, file: "odata.spec.ts", sourceCode: "it('should parse $count', () => {", vars: {} },
  { line: 45, file: "odata.spec.ts", sourceCode: "const query = '$count=true';", vars: {} },
  { line: 46, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", vars: { query: "$count=true" } },

  { line: 16, file: "odata.ts",  sourceCode: "const params = new URLSearchParams(queryString);", vars: { queryString: "$count=true" } },
  { line: 17, file: "odata.ts",  sourceCode: "const result: ParsedQuery = {};", vars: { queryString: "$count=true", params: { $count: "true" } } },

  { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {", vars: { queryString: "$count=true", params: { $count: "true" }, result: {} } },
  { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {", vars: { queryString: "$count=true", params: { $count: "true" }, result: {} } },
  { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {", vars: { queryString: "$count=true", params: { $count: "true" }, result: {} } },
  { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {",    vars: { queryString: "$count=true", params: { $count: "true" }, result: {} } },
  { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {",   vars: { queryString: "$count=true", params: { $count: "true" }, result: {} } },
  { line: 39, file: "odata.ts", sourceCode: "if (params.has('$orderby')) {",vars: { queryString: "$count=true", params: { $count: "true" }, result: {} } },
  { line: 46, file: "odata.ts", sourceCode: "if (params.has('$count')) {",  vars: { queryString: "$count=true", params: { $count: "true" }, result: {} } },
  { line: 47, file: "odata.ts", sourceCode: "result.$count = params.get('$count')?.toLowerCase() === 'true';", vars: { queryString: "$count=true", params: { $count: "true" }, result: {} } },

  { line: 50,  file: "odata.ts", sourceCode: "if (params.has('$search')) {", vars: { queryString: "$count=true", params: { $count: "true" }, result: { $count: true } } },
  { line: 54,  file: "odata.ts", sourceCode: "if (params.has('$format')) {", vars: { queryString: "$count=true", params: { $count: "true" }, result: { $count: true } } },
  { line: 58,  file: "odata.ts", sourceCode: "if (params.has('$compute')) {", vars: { queryString: "$count=true", params: { $count: "true" }, result: { $count: true } } },
  { line: 62,  file: "odata.ts", sourceCode: "if (params.has('$apply')) {",  vars: { queryString: "$count=true", params: { $count: "true" }, result: { $count: true } } },
  { line: 66,  file: "odata.ts", sourceCode: "return result;",               vars: { queryString: "$count=true", params: { $count: "true" }, result: { $count: true } } },

  { line: 47, file: "odata.spec.ts", sourceCode: "expect(result.$count).toBe(true);", vars: { query: "$count=true", result: { $count: true } } },
  { line: 48, file: "odata.spec.ts", sourceCode: "})", vars: { query: "$count=true", result: { $count: true } } }
],

       "should parse $search": [
      { line: 50, file: "odata.spec.ts", sourceCode: "it('should parse $search', () => {", vars: {} },
      { line: 51, file: "odata.spec.ts", sourceCode: "const query = '$search=\"blue OR green\"';", vars: {} },
      { line: 52, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", vars: { query: "$search=\"blue OR green\"" } },

      { line: 16, file: "odata.ts", sourceCode: "const params = new URLSearchParams(queryString);", vars: { queryString: "$search=\"blue OR green\"" } },
      { line: 17, file: "odata.ts", sourceCode: "const result: ParsedQuery = {};", vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" } } },

      { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {",  vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },
      { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {",  vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },
      { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {",  vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },
      { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {",     vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },
      { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {",    vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },
      { line: 39, file: "odata.ts", sourceCode: "if (params.has('$orderby')) {", vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },
      { line: 46, file: "odata.ts", sourceCode: "if (params.has('$count')) {",   vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },
      { line: 50, file: "odata.ts", sourceCode: "if (params.has('$search')) {",  vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },
      { line: 51, file: "odata.ts", sourceCode: "result.$search = params.get('$search') || undefined;", vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: {} } },

      { line: 54, file: "odata.ts", sourceCode: "if (params.has('$format')) {",  vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: { $search: "\"blue OR green\"" } } },
      { line: 58, file: "odata.ts", sourceCode: "if (params.has('$compute')) {", vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: { $search: "\"blue OR green\"" } } },
      { line: 62, file: "odata.ts", sourceCode: "if (params.has('$apply')) {",   vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: { $search: "\"blue OR green\"" } } },
      { line: 66, file: "odata.ts", sourceCode: "return result;",                vars: { queryString: "$search=\"blue OR green\"", params: { $search: "\"blue OR green\"" }, result: { $search: "\"blue OR green\"" } } },

      { line: 53, file: "odata.spec.ts", sourceCode: "expect(result.$search).toBe('\"blue OR green\"')", vars: { query: "$search=\"blue OR green\"", result: { $search: "\"blue OR green\"" } } },
      { line: 54, file: "odata.spec.ts", sourceCode: "})",                      vars: { query: "$search=\"blue OR green\"", result: { $search: "\"blue OR green\"" } } }
    ],

    /* ──────────────────────────────────────────
       should parse $format   (20 steps)
       ────────────────────────────────────────── */
    "should parse $format": [
      { line: 56, file: "odata.spec.ts", sourceCode: "it('should parse $format', () => {", vars: {} },
      { line: 57, file: "odata.spec.ts", sourceCode: "const query = '$format=json';", vars: {} },
      { line: 58, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", vars: { query: "$format=json" } },

      { line: 16, file: "odata.ts", sourceCode: "const params = new URLSearchParams(queryString);", vars: { queryString: "$format=json" } },
      { line: 17, file: "odata.ts", sourceCode: "const result: ParsedQuery = {};", vars: { queryString: "$format=json", params: { $format: "json" } } },

      { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {",  vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {",  vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {",  vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {",     vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {",    vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 39, file: "odata.ts", sourceCode: "if (params.has('$orderby')) {", vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 46, file: "odata.ts", sourceCode: "if (params.has('$count')) {",   vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 50, file: "odata.ts", sourceCode: "if (params.has('$search')) {",  vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 54, file: "odata.ts", sourceCode: "if (params.has('$format')) {",  vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },
      { line: 55, file: "odata.ts", sourceCode: "result.$format = params.get('$format') || undefined;", vars: { queryString: "$format=json", params: { $format: "json" }, result: {} } },

      { line: 58, file: "odata.ts", sourceCode: "if (params.has('$compute')) {", vars: { queryString: "$format=json", params: { $format: "json" }, result: { $format: "json" } } },
      { line: 62, file: "odata.ts", sourceCode: "if (params.has('$apply')) {",   vars: { queryString: "$format=json", params: { $format: "json" }, result: { $format: "json" } } },
      { line: 66, file: "odata.ts", sourceCode: "return result;",                vars: { queryString: "$format=json", params: { $format: "json" }, result: { $format: "json" } } },

      { line: 59, file: "odata.spec.ts", sourceCode: "expect(result.$format).toBe('json')", vars: { query: "$format=json", result: { $format: "json" } } },
      { line: 60, file: "odata.spec.ts", sourceCode: "})",                       vars: { query: "$format=json", result: { $format: "json" } } }
    ],

    /* ──────────────────────────────────────────
       should parse $compute   (20 steps)
       ────────────────────────────────────────── */
    "should parse $compute": [
      { line: 62, file: "odata.spec.ts", sourceCode: "it('should parse $compute', () => {", vars: {} },
      { line: 63, file: "odata.spec.ts", sourceCode: "const query = '$compute=Amount mul UnitPrice as TotalAmount';", vars: {} },
      { line: 64, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", vars: { query: "$compute=Amount mul UnitPrice as TotalAmount" } },

      { line: 16, file: "odata.ts", sourceCode: "const params = new URLSearchParams(queryString);", vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount" } },
      { line: 17, file: "odata.ts", sourceCode: "const result: ParsedQuery = {};", vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" } } },

      { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {",  vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {",  vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {",  vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {",     vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {",    vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 39, file: "odata.ts", sourceCode: "if (params.has('$orderby')) {", vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 46, file: "odata.ts", sourceCode: "if (params.has('$count')) {",   vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 50, file: "odata.ts", sourceCode: "if (params.has('$search')) {",  vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 54, file: "odata.ts", sourceCode: "if (params.has('$format')) {",  vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 58, file: "odata.ts", sourceCode: "if (params.has('$compute')) {", vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },
      { line: 59, file: "odata.ts", sourceCode: "result.$compute = params.get('$compute')?.split(',').map(s => s.trim());", vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: {} } },

      { line: 62, file: "odata.ts", sourceCode: "if (params.has('$apply')) {",   vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: { $compute: ["Amount mul UnitPrice as TotalAmount"] } } },
      { line: 66, file: "odata.ts", sourceCode: "return result;",                vars: { queryString: "$compute=Amount mul UnitPrice as TotalAmount", params: { $compute: "Amount mul UnitPrice as TotalAmount" }, result: { $compute: ["Amount mul UnitPrice as TotalAmount"] } } },

      { line: 65, file: "odata.spec.ts", sourceCode: "expect(result.$compute).toEqual(['Amount mul UnitPrice as TotalAmount'])", vars: { query: "$compute=Amount mul UnitPrice as TotalAmount", result: { $compute: ["Amount mul UnitPrice as TotalAmount"] } } },
      { line: 66, file: "odata.spec.ts", sourceCode: "})",                       vars: { query: "$compute=Amount mul UnitPrice as TotalAmount", result: { $compute: ["Amount mul UnitPrice as TotalAmount"] } } }
    ],

    /* ──────────────────────────────────────────
       should parse $apply    (20 steps)
       ────────────────────────────────────────── */
    "should parse $apply": [
      { line: 68, file: "odata.spec.ts", sourceCode: "it('should parse $apply', () => {", vars: {} },
      { line: 69, file: "odata.spec.ts", sourceCode: "const query = '$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))';", vars: {} },
      { line: 70, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", vars: { query: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" } },

      { line: 16, file: "odata.ts", sourceCode: "const params = new URLSearchParams(queryString);", vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" } },
      { line: 17, file: "odata.ts", sourceCode: "const result: ParsedQuery = {};", vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" } } },

      { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {",  vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {",  vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {",  vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {",     vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {",    vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 39, file: "odata.ts", sourceCode: "if (params.has('$orderby')) {", vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 46, file: "odata.ts", sourceCode: "if (params.has('$count')) {",   vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 50, file: "odata.ts", sourceCode: "if (params.has('$search')) {",  vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 54, file: "odata.ts", sourceCode: "if (params.has('$format')) {",  vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 58, file: "odata.ts", sourceCode: "if (params.has('$compute')) {", vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 62, file: "odata.ts", sourceCode: "if (params.has('$apply')) {",   vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },
      { line: 63, file: "odata.ts", sourceCode: "result.$apply = params.get('$apply') || undefined;", vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: {} } },

      { line: 66, file: "odata.ts", sourceCode: "return result;",                vars: { queryString: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", params: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" }, result: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" } } },

      { line: 71, file: "odata.spec.ts", sourceCode: "expect(result.$apply).toBe('groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))')", vars: { query: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", result: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" } } },
      { line: 72, file: "odata.spec.ts", sourceCode: "})",                       vars: { query: "$apply=groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))", result: { $apply: "groupby((ProductID, ProductName), aggregate(Price with average as AveragePrice))" } } }
    ],

    /* ──────────────────────────────────────────
       should parse multiple query options
       (no 20‑step limit requested; 28 steps shown)
       ────────────────────────────────────────── */
    "should parse multiple query options": [
      { line: 74, file: "odata.spec.ts", sourceCode: "it('should parse multiple query options', () => {", 
        vars: {} 
      },
      { line: 75, file: "odata.spec.ts", sourceCode: "const query = '$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json';", 
        vars: {} 
      },
      { line: 76, file: "odata.spec.ts", sourceCode: "const result = parseODataQuery(query);", 
        vars: { 
            query: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json" 
        } 
      },
      { line: 16, file: "odata.ts", sourceCode: "const params = new URLSearchParams(queryString);", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json" 
        } 
      },
      { line: 17, file: "odata.ts", sourceCode: "const result: ParsedQuery = {};", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"} 
        } 
      },
      { line: 19, file: "odata.ts", sourceCode: "if (params.has('$filter')) {",  
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"}, 
            result: {} 
        } 
      },
      { line: 20, file: "odata.ts", sourceCode: "result.$filter = params.get('$filter') || undefined;", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: {} 
        } 
      },
      { line: 23, file: "odata.ts", sourceCode: "if (params.has('$select')) {",  
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18"} 
        } 
      },
      { line: 24, file: "odata.ts", sourceCode: "result.$select = params.get('$select')?.split(',').map(s => s.trim());", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18"} 
        } 
      },
      { line: 27, file: "odata.ts", sourceCode: "if (params.has('$expand')) {",  
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"]} 
        } 
      },
      { line: 28, file: "odata.ts", sourceCode: "result.$expand = params.get('$expand')?.split(',').map(s => s.trim());", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"]} 
        } 
      },
      { line: 31, file: "odata.ts", sourceCode: "if (params.has('$top')) {",     
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"]} 
        } 
      },
      { line: 32, file: "odata.ts", sourceCode: "result.$top = parseInt(params.get('$top') || '0', 10);", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"]} 
        } 
      },
      { line: 35, file: "odata.ts", sourceCode: "if (params.has('$skip')) {",    
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5} 
        } 
      },
      { line: 36, file: "odata.ts", sourceCode: "result.$skip = parseInt(params.get('$skip') || '0', 10);", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5} 
        } 
      },

      { line: 39, file: "odata.ts", sourceCode: "if (params.has('$orderby')) {", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10} 
        } 
      },
      { line: 40, file: "odata.ts", sourceCode: "result.$orderby = params.get('$orderby')?.split(',').map(item => {", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10} 
        } },

      { line: 46, file: "odata.ts", sourceCode: "if (params.has('$count')) {",   
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }]} 
        } 
      },
      { line: 47, file: "odata.ts", sourceCode: "result.$count = params.get('$count')?.toLowerCase() === 'true';", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }]} 
        } 
      },
      { line: 50, file: "odata.ts", sourceCode: "if (params.has('$search')) {",  
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true} } 
      },
      { line: 51, file: "odata.ts", sourceCode: "result.$search = params.get('$search') || undefined;", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true}
        } 
      },
      { line: 54, file: "odata.ts", sourceCode: "if (params.has('$format')) {",  
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true, $search: "\"urgent\""} 
        } 
      },
      { line: 55, file: "odata.ts", sourceCode: "result.$format = params.get('$format') || undefined;", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true, $search: "\"urgent\""} 
        } 
      },

      /* compute / apply not in query ‑‑ check only */
      { line: 58, file: "odata.ts", sourceCode: "if (params.has('$compute')) {", 
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true, $search: "\"urgent\"", $format: "json"} 
        } 
      },
      { line: 62, file: "odata.ts", sourceCode: "if (params.has('$apply')) {",   
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true, $search: "\"urgent\"", $format: "json"} 
        } 
      },

      { line: 66, file: "odata.ts", sourceCode: "return result;",                
        vars: { 
            queryString: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            params: { $filter: "Age gt 18", $select: "Name,Email", $expand: "Orders", $top: "5", $skip: "10", $orderby: "Name asc", $count: "true", $search: "\"urgent\"", $format: "json"},
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true, $search: "\"urgent\"", $format: "json"} 
        } 
      },

      /* assertion & close */
      { line: 77, file: "odata.spec.ts", sourceCode: "expect(result).toEqual({", 
        vars: { 
            query: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true, $search: "\"urgent\"", $format: "json"} 
        } 
    },
    { line: 88, file: "odata.spec.ts", sourceCode: "})", 
        vars: { 
            query: "$filter=Age gt 18&$select=Name,Email&$expand=Orders&$top=5&$skip=10&$orderby=Name asc&$count=true&$search=\"urgent\"&$format=json", 
            result: { $filter: "Age gt 18", $select: ["Name","Email"], $expand: ["Orders"], $top: 5, $skip: 10, $orderby: [{ field: "Name", order: "asc" }], $count: true, $search: "\"urgent\"", $format: "json"} 
        } 
    }
    ],
  },
} }

