import type {
  CompiledSqlStatement,
  DatabaseDialect,
  SqlParams,
} from "./types.js";

export const ORACLE_IN_LIST_LIMIT = 1000;

const isIdentifierStart = (char: string | undefined): boolean =>
  !!char && /[A-Za-z_]/.test(char);

const isIdentifierPart = (char: string | undefined): boolean =>
  !!char && /[A-Za-z0-9_]/.test(char);

function readParameterName(sqlText: string, startIndex: number): { name: string; endIndex: number } {
  let index = startIndex;
  let name = "";

  while (index < sqlText.length && isIdentifierPart(sqlText[index])) {
    name += sqlText[index];
    index += 1;
  }

  return { name, endIndex: index - 1 };
}

export function compileNamedParams(
  dialect: DatabaseDialect,
  sqlText: string,
  params: SqlParams = {}
): CompiledSqlStatement {
  const output: string[] = [];
  const values: unknown[] = [];
  const bindValues: Record<string, unknown> = {};
  const parameterOrder: string[] = [];
  const pgIndexes = new Map<string, number>();

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    const next = sqlText[index + 1];
    const previous = sqlText[index - 1];

    if (inLineComment) {
      output.push(char);
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      output.push(char);
      if (char === "*" && next === "/") {
        output.push(next);
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inDoubleQuote && char === "'" && previous !== "\\") {
      inSingleQuote = !inSingleQuote;
      output.push(char);
      continue;
    }

    if (!inSingleQuote && char === "\"" && previous !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      output.push(char);
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      output.push(char);
      continue;
    }

    if (char === "-" && next === "-") {
      output.push(char, next);
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      output.push(char, next);
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === ":" && previous !== ":" && isIdentifierStart(next)) {
      const { name, endIndex } = readParameterName(sqlText, index + 1);

      if (!(name in params)) {
        throw new Error(`Missing SQL parameter ':${name}'.`);
      }

      const value = params[name];

      if (Array.isArray(value)) {
        const inListContext = dialect === "oracle"
          ? getInListContext(output, sqlText, endIndex + 1)
          : null;

        if (value.length === 0) {
          if (inListContext) {
            output.splice(inListContext.startIndex);
            output.push("1 = 0");
            index = inListContext.closingParenIndex;
          } else {
            output.push("(select 1 where 1 = 0)");
            index = endIndex;
          }
          continue;
        }

        const placeholders = buildArrayPlaceholders(
          dialect,
          name,
          value,
          values,
          bindValues,
          parameterOrder,
          inListContext?.leftSideExpression
        );

        if (inListContext) {
          output.splice(inListContext.startIndex);
        }

        output.push(placeholders);
        if (inListContext) {
          index = inListContext.closingParenIndex;
        } else {
          index = endIndex;
        }
        continue;
      }

      parameterOrder.push(name);

      if (dialect === "oracle") {
        bindValues[name] = value;
        output.push(`:${name}`);
      } else if (dialect === "pg") {
        let paramIndex = pgIndexes.get(name);
        if (!paramIndex) {
          values.push(value);
          paramIndex = values.length;
          pgIndexes.set(name, paramIndex);
        }
        output.push(`$${paramIndex}`);
      } else {
        values.push(value);
        output.push("?");
      }

      index = endIndex;
      continue;
    }

    output.push(char);
  }

  return {
    text: output.join(""),
    values: dialect === "oracle" ? bindValues : values,
    parameterOrder,
  };
}

function buildArrayPlaceholders(
  dialect: DatabaseDialect,
  name: string,
  arrayValue: unknown[],
  values: unknown[],
  bindValues: Record<string, unknown>,
  parameterOrder: string[],
  leftSideExpression?: string
): string {
  if (dialect === "oracle") {
    const chunks = chunkArray(arrayValue, ORACLE_IN_LIST_LIMIT);
    const inColumn = leftSideExpression?.trim();

    const chunkSql = chunks.map((chunk, chunkIndex) => {
      const placeholders = chunk.map((item, itemIndex) => {
        const bindName = `${name}_${chunkIndex}_${itemIndex}`;
        bindValues[bindName] = item;
        parameterOrder.push(bindName);
        return `:${bindName}`;
      });

      return inColumn
        ? `${inColumn} IN (${placeholders.join(", ")})`
        : placeholders.join(", ");
    });

    return inColumn
      ? `(${chunkSql.join(" OR ")})`
      : chunkSql.join(", ");
  }

  if (dialect === "pg") {
    const placeholders = arrayValue.map(item => {
      values.push(item);
      parameterOrder.push(name);
      return `$${values.length}`;
    });
    return placeholders.join(", ");
  }

  const placeholders = arrayValue.map(item => {
    values.push(item);
    parameterOrder.push(name);
    return "?";
  });
  return placeholders.join(", ");
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function getInListContext(
  output: string[],
  sqlText: string,
  searchStartIndex: number
): {
  startIndex: number;
  leftSideExpression: string;
  closingParenIndex: number;
} | null {
  const outputText = output.join("");
  const match = /([A-Za-z0-9_."$]+)\s+IN\s*\($/i.exec(outputText);

  if (!match) {
    return null;
  }

  let cursor = searchStartIndex;
  while (cursor < sqlText.length && /\s/.test(sqlText[cursor])) {
    cursor += 1;
  }

  if (sqlText[cursor] !== ")") {
    return null;
  }

  return {
    startIndex: match.index,
    leftSideExpression: match[1],
    closingParenIndex: cursor,
  };
}
