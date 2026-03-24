import { describe, expect, it, vi } from "vitest";
import { Document } from "@langchain/core/documents";
import { RagVectorStore } from "../lib/ragVectorStore.ts";

describe("RagVectorStore", () => {
  it("stores embedded documents and returns the best matches", async () => {
    const embedTextChunks = vi.fn().mockImplementation(async (texts: string[]) => {
      return texts.map((text) => {
        if (text === "Question") return [1, 0];
        if (text === "High similarity") return [0.9, 0.1];
        return [0, 1];
      });
    });

    const db = {
      saveRagChunks: vi.fn().mockResolvedValue(undefined),
      getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([
        {
          id: "chunk1",
          workspace_id: "ws1",
          recording_id: "rec1",
          speaker_name: "Anna",
          text: "High similarity",
          embedding_json: JSON.stringify([0.9, 0.1]),
        },
        {
          id: "chunk2",
          workspace_id: "ws1",
          recording_id: "rec2",
          speaker_name: "Piotr",
          text: "Low similarity",
          embedding_json: JSON.stringify([0, 1]),
        },
      ]),
    };

    const store = new RagVectorStore({
      workspaceId: "ws1",
      db,
      embedTextChunks,
      topK: 15,
      minScore: 0.1,
    });

    await store.addDocuments([
      new Document({
        pageContent: "Fresh chunk",
        metadata: {
          workspaceId: "ws1",
          recordingId: "rec3",
          speakerName: "Kasia",
        },
      }),
    ]);

    expect(db.saveRagChunks).toHaveBeenCalledTimes(1);

    const docs = await store.similaritySearch("Question", 2);

    expect(embedTextChunks).toHaveBeenCalledWith(["Fresh chunk"]);
    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).toBe("High similarity");
  });
});
