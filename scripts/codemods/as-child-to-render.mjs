#!/usr/bin/env node
/**
 * as-child-to-render.mjs: Radix `asChild` → Base UI `render`, at call sites.
 *
 *   node scripts/codemods/as-child-to-render.mjs --tags Button,DialogClose <files…>
 *
 *   <Tag a asChild b><Child c>kids</Child></Tag>
 *     → <Tag a b render={<Child c />}>kids</Tag>
 *   <Tag asChild><Child c /></Tag>        → <Tag render={<Child c />} />
 *   <Tag asChild>{node}</Tag>             → <Tag render={node} />
 *
 * When the child isn't a button (Link, a, div, span …) it also adds
 * nativeButton={false}, which Base UI needs for anything rendered in place
 * of a <button>. Only elements whose tag is in --tags are touched. Anything
 * it can't rewrite safely (several children, text, a spread child…) is
 * listed so it can be done by hand. Uses the TypeScript parser, not regex.
 */

import { readFileSync, writeFileSync } from "node:fs";

import ts from "typescript";

const argv = process.argv.slice(2);
const tagsAt = argv.indexOf("--tags");
const TAGS = new Set(argv[tagsAt + 1].split(","));
const files = argv.filter((a, i) => i !== tagsAt && i !== tagsAt + 1);
// Children that render a real <button>: no nativeButton={false} needed.
const BUTTONISH = new Set(["button", "Button"]);
const DRY = process.env.DRY === "1";

const tagName = (node) => node.tagName.getText();

let changed = 0;
const manual = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];

  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = tagName(opening);
      const attrs = opening.attributes.properties;
      const asChild = attrs.find((a) => ts.isJsxAttribute(a) && a.name.getText() === "asChild");
      if (TAGS.has(tag) && asChild) {
        const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        // asChild={false} or a non-literal value: leave for a human.
        if (asChild.initializer && asChild.initializer.getText() !== "{true}") {
          manual.push(`${file}:${line} <${tag}> asChild=${asChild.initializer.getText()}`);
          return;
        }
        if (!ts.isJsxElement(node)) {
          manual.push(`${file}:${line} <${tag} asChild /> has no child`);
          return;
        }
        const kids = node.children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces));
        if (kids.length !== 1) {
          manual.push(`${file}:${line} <${tag}> has ${kids.length} children`);
          return;
        }
        const child = kids[0];
        const keep = attrs
          .filter((a) => a !== asChild)
          .map((a) => a.getText())
          .join(" ");
        let render;
        let inner = "";
        let native = false;
        if (ts.isJsxExpression(child)) {
          if (!child.expression) {
            manual.push(`${file}:${line} <${tag}> empty expression child`);
            return;
          }
          render = child.expression.getText();
          // An expression may be a button or not: say so, a human decides.
          manual.push(`${file}:${line} <${tag}> render={${render}} — check nativeButton`);
        } else if (ts.isJsxSelfClosingElement(child)) {
          render = child.getText();
          native = !BUTTONISH.has(tagName(child));
        } else if (ts.isJsxElement(child)) {
          const childTag = tagName(child.openingElement);
          const childAttrs = child.openingElement.attributes.getText();
          render = `<${childTag}${childAttrs ? ` ${childAttrs}` : ""} />`;
          inner = text.slice(child.openingElement.end, child.closingElement.getStart());
          native = !BUTTONISH.has(childTag);
        } else {
          manual.push(`${file}:${line} <${tag}> child kind ${ts.SyntaxKind[child.kind]}`);
          return;
        }
        const props = [keep, native ? "nativeButton={false}" : "", `render={${render}}`]
          .filter(Boolean)
          .join(" ");
        const out = inner.trim()
          ? `<${tag} ${props}>${inner}</${tag}>`
          : `<${tag} ${props} />`;
        edits.push({ end: node.end, out, start: node.getStart() });
        return;
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
    changed += edits.length;
    if (!DRY) {
      writeFileSync(file, next);
    }
    console.log(`${file}: ${edits.length}`);
  }
}
console.log(`\n${changed} rewritten${DRY ? " (dry run)" : ""}`);
if (manual.length) {
  console.log(`\nBy hand (${manual.length}):\n  ${manual.join("\n  ")}`);
}
