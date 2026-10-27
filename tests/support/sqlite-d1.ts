import type {DatabaseSync, SQLInputValue} from 'node:sqlite';
import type {D1Like, D1PreparedStatement} from '../../src/server/d1.ts';

/** Adapts node:sqlite to the subset of the D1 API the server code uses. */
export function d1Adapter(db: DatabaseSync): D1Like {
  return {
    prepare(sql: string): D1PreparedStatement {
      const statement = db.prepare(sql);
      let values: SQLInputValue[] = [];
      const prepared: D1PreparedStatement = {
        bind(...args: unknown[]) {
          values = args as SQLInputValue[];
          return prepared;
        },
        async run() {
          return {meta: {changes: Number(statement.run(...values).changes)}};
        },
        async first<T>() {
          return (statement.get(...values) as T | undefined) ?? null;
        },
      };
      return prepared;
    },
  };
}
