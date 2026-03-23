import { describe, expect, it } from "vitest";
import { buildSketchnoteDataUrl, buildSketchnoteSvg } from "./sketchnote";

function decodeDataUrl(dataUrl: string) {
  const encoded = dataUrl.split(",")[1] || "";
  return Buffer.from(encoded, "base64").toString("utf8");
}

describe("sketchnote helpers", () => {
  it("builds a valid SVG sketchnote", () => {
    const svg = buildSketchnoteSvg("Plan spotkania", [
      { label: "Decyzje", value: "Wdrożyć nowy proces", icon: "✓" },
    ]);

    expect(svg).toContain("<svg");
    expect(svg).toContain("Plan spotkania");
    expect(svg).toContain("Wdrożyć nowy proces");
  });

  it("builds a data URL that decodes to SVG", () => {
    const dataUrl = buildSketchnoteDataUrl("Podsumowanie", []);
    const svg = decodeDataUrl(dataUrl);

    expect(dataUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Podsumowanie");
  });
});