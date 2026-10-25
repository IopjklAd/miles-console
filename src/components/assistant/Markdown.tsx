/**
 * Minimal Markdown renderer for assistant replies.
 *
 * Supports what technical answers actually need: fenced code, tables, lists,
 * inline code, bold and links. No third-party dependency and no raw HTML:
 * everything becomes React elements.
 */

import { Fragment, useMemo, type ReactNode } from "react";

type MarkdownBlock =
  | { type: "code"; lang: string; code: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] };

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableSeparator = (line: string) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const fence = /^```(\w*)\s*$/.exec(line.trim());
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", lang: fence[1] ?? "", code: code.join("\n") });
      continue;
    }

    if (
      isTableRow(line) &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      const header = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const listMatch = /^\s*(?:([-*])|(\d+)\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      const ordered = Boolean(listMatch[2]);
      const items: string[] = [];
      while (index < lines.length) {
        const current = /^\s*(?:([-*])|(\d+)\.)\s+(.*)$/.exec(lines[index]);
        if (!current || Boolean(current[2]) !== ordered) break;
        items.push(current[3]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !/^```/.test(lines[index].trim()) &&
      !isTableRow(lines[index]) &&
      !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;
  return text
    .split(pattern)
    .filter(Boolean)
    .map((token, position) => {
      if (token.length > 2 && token.startsWith("`") && token.endsWith("`")) {
        return (
          <code
            key={position}
            className="rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 font-mono text-[12px]"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith("**") && token.endsWith("**")) {
        return <strong key={position}>{token.slice(2, -2)}</strong>;
      }
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link) {
        return (
          <a
            key={position}
            href={link[2]}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2"
          >
            {link[1]}
          </a>
        );
      }
      return <Fragment key={position}>{token}</Fragment>;
    });
}

export function Markdown({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="space-y-3 text-sm leading-6">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-border/70 bg-muted/40"
            >
              <div className="border-b border-border/60 px-3 py-1.5">
                <span className="mono-value text-[11px] uppercase tracking-wide text-muted-foreground">
                  {block.lang || "code"}
                </span>
              </div>
              <pre className="overflow-x-auto px-3 py-2.5">
                <code className="font-mono text-[12.5px] leading-5">
                  {block.code}
                </code>
              </pre>
            </div>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={index}
              className={
                block.ordered
                  ? "list-decimal space-y-1 pl-5"
                  : "list-disc space-y-1 pl-5"
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "table") {
          return (
            <div
              key={index}
              className="overflow-x-auto rounded-lg border border-border/70"
            >
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {block.header.map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        className="border-b border-border/70 px-3 py-2 text-left font-semibold"
                      >
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-border/50 last:border-0"
                    >
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 align-top">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
