import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { profileMessages } from "../../src/features/shared/profileMessages";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) && !path.includes(".test.") ? [path] : [];
  });
}

describe("existing message translations", () => {
  it("provides Chinese for every inline multilingual message", () => {
    const missing: string[] = [];
    for (const file of sourceFiles(resolve("src"))) {
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isObjectLiteralExpression(node)) {
          const properties = new Map(node.properties.filter(ts.isPropertyAssignment).map(property => [property.name.getText(source).replace(/["']/g, ""), property.initializer]));
          if (properties.has("en") && (properties.has("fr") || properties.has("de"))) {
            const chinese = properties.get("zh");
            if (!chinese || (ts.isStringLiteral(chinese) && !chinese.text.trim())) {
              missing.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });

  it("preserves profile interpolation fields in Chinese", () => {
    const fields = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const [key, message] of Object.entries(profileMessages)) {
      expect(message.zh.trim(), key).not.toBe("");
      expect(fields(message.zh), key).toEqual(fields(message.en));
    }
  });
});
