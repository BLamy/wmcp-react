import { expect, describe, it } from "vitest";

import { parseODataQuery } from './simple.ts';

describe('parseODataQuery', () => {
  it('should parse $filter', () => {
    const query = "$filter=Name eq 'John' and Age gt 18";
    const result = parseODataQuery(query);
    expect(result.$filter).toBe("Name eq 'John' and Age gt 18");
  });

  it('should parse $select', () => {
    const query = '$select=Name, Age, Email';
    const result = parseODataQuery(query);
    expect(result.$select).toEqual(['Name', 'Age', 'Email']);
  });
});  