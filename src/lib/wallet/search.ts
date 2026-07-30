// `%` and `_` are LIKE/ILIKE wildcards, so passing raw user input straight
// into an ilike pattern makes them silently un-searchable: verified against
// a real database, searching for "%" matched every row instead of the one
// merchant with a literal "%" in its name (same for "_"). Backslash is
// Postgres' default LIKE escape character, so it has to be escaped first or
// it would eat the escapes added for the other two.
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
