#!/usr/bin/env node
/**
 * toggle-group-values.mjs: Radix ToggleGroup `type` → Base UI array values.
 *
 *   node scripts/codemods/toggle-group-values.mjs <files…>
 *
 * Base UI's ToggleGroup always works in arrays and has no `type`:
 *   type="single"   removed;  value={x} → value={[x]};
 *                   defaultValue="a" → defaultValue={["a"]};
 *                   onValueChange={(value) => …} → ([value = ""]) => …
 *                   (body untouched; "nothing pressed" still arrives as "",
 *                   which is what Radix single mode sent)
 *   type="multiple" → multiple   (values were already arrays)
 * Uses the TypeScript parser. Anything unusual is listed for a human.
 */

import { readFileSync, writeFileSync } from "node:fs";

import ts from "typescript";

const files = process.argv.slice(2);
const manual = [];
let changed = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = (node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText() === "ToggleGroup"
    ) {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const attr = (name) =>
        node.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === name);
      const type = attr("type");
      const kind = type?.initializer?.getText();
      if (kind === '"multiple"') {
        edits.push({ end: type.end, out: "multiple", start: type.getStart() });
      } else if (kind === '"single"') {
        edits.push({ end: type.end, out: "", start: type.getStart() });
        for (const name of ["value", "defaultValue"]) {
          const a = attr(name);
          if (!a?.initializer) {
            continue;
          }
          const init = a.initializer;
          if (ts.isStringLiteral(init)) {
            edits.push({ end: init.end, out: `{[${init.getText()}]}`, start: init.getStart() });
          } else if (ts.isJsxExpression(init) && init.expression) {
            if (ts.isArrayLiteralExpression(init.expression)) {
              continue;
            }
            edits.push({ end: init.end, out: `{[${init.expression.getText()}]}`, start: init.getStart() });
          }
        }
        const change = attr("onValueChange");
        const fn = change?.initializer && ts.isJsxExpression(change.initializer) && change.initializer.expression;
        if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && fn.parameters.length === 1) {
          const param = fn.parameters[0];
          if (ts.isIdentifier(param.name)) {
            // Keep the arrow's own parens if it had them.
            const hasParens = text[fn.getStart()] === "(";
            const out = `[${param.name.getText()} = ""]`;
            edits.push({
              end: hasParens ? param.end : param.end,
              out: hasParens ? out : `(${out})`,
              start: param.getStart(),
            });
          } else {
            manual.push(`${file}:${line} onValueChange param isn't a plain name`);
          }
        } else if (change) {
          manual.push(`${file}:${line} onValueChange isn't an inline one-param function`);
        }
      } else if (type) {
        manual.push(`${file}:${line} type=${kind}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (edits.length) {
    let next = text;
    for (const e of edits.sort((a, b) => b.start - a.start)) {
      next = next.slice(0, e.start) + e.out + next.slice(e.end);
    }
    writeFileSync(file, next);
    changed += edits.length;
    console.log(`${file}: ${edits.length} edits`);
  }
}
console.log(`\n${changed} edits`);
if (manual.length) {
  console.log(`\nBy hand:\n  ${manual.join("\n  ")}`);
}
