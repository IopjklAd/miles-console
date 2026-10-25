import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseMarkdown } from "@/components/assistant/Markdown";
import { Markdown } from "@/components/assistant/Markdown";
import {
  AvailabilityBadge,
  ConnectionBadge,
  SimulatedBadge,
} from "@/components/miles/StatusBadge";

describe("parseMarkdown", () => {
  it("extracts fenced code", () => {
    const blocks = parseMarkdown("Texte\n```ts\nconst a = 1;\n```\nFin");
    const code = blocks.find((block) => block.type === "code");
    expect(code).toBeDefined();
    expect(code?.type === "code" && code.lang).toBe("ts");
    expect(code?.type === "code" && code.code).toBe("const a = 1;");
  });

  it("extracts tables and lists", () => {
    const blocks = parseMarkdown(
      "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- un\n- deux",
    );
    const table = blocks.find((block) => block.type === "table");
    const list = blocks.find((block) => block.type === "list");

    expect(table?.type === "table" && table.header).toEqual(["A", "B"]);
    expect(table?.type === "table" && table.rows).toEqual([["1", "2"]]);
    expect(list?.type === "list" && list.items).toEqual(["un", "deux"]);
  });
});

describe("Markdown", () => {
  it("renders inline code without executing anything", () => {
    render(<Markdown content="Utilise `GET /api/status`." />);
    expect(screen.getByText("GET /api/status").tagName).toBe("CODE");
  });
});

describe("status badges", () => {
  it("never relies on colour alone", () => {
    render(<AvailabilityBadge status="operational" />);
    expect(screen.getByText("Opérationnel")).toBeDefined();

    render(<ConnectionBadge connection="demo" />);
    expect(screen.getByText("Mode démonstration")).toBeDefined();

    render(<ConnectionBadge connection="unconfigured" />);
    expect(screen.getByText("Backend non configuré")).toBeDefined();
  });

  it("labels simulated data explicitly", () => {
    render(<SimulatedBadge />);
    expect(screen.getByText("Simulé")).toBeDefined();
  });
});
