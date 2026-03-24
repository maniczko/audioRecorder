import { describe, expect, it, vi } from "vitest";
import { RagChunkRetriever } from "../lib/ragRetriever.ts";

describe("RagChunkRetriever", () => {
  it("returns the highest-scoring docs and filters weak matches", async () => {
    const embedTextChunks = vi.fn().mockResolvedValue([[1, 0]]);
    const db = {
      getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([
        {
          id: "chunk1",
          recording_id: "rec1",
          speaker_name: "Anna",
          text: "High similarity",
          embedding_json: JSON.stringify([0.9, 0.1]),
        },
        {
          id: "chunk2",
          recording_id: "rec2",
          speaker_name: "Piotr",
          text: "Low similarity",
          embedding_json: JSON.stringify([0, 1]),
        },
      ]),
    };

    const retriever = new RagChunkRetriever({
      workspaceId: "ws1",
      db,
      embedTextChunks,
      topK: 15,
      minScore: 0.1,
    });

    const docs = await retriever.invoke("Question");

    expect(embedTextChunks).toHaveBeenCalledWith(["Question"]);
    expect(db.getAllRagChunksForWorkspace).toHaveBeenCalledWith("ws1");
    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).toBe("High similarity");
    expect(docs[0].metadata).toMatchObject({
      id: "chunk1",
      recordingId: "rec1",
      speakerName: "Anna",
    });
  });
});
