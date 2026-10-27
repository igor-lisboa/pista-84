/** Minimal structural types for the Cloudflare D1 API used by this project. */
export interface D1Result {
  meta: {changes: number};
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface D1Like {
  prepare(sql: string): D1PreparedStatement;
}
