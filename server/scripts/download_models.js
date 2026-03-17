const { pipeline, env } = require("@xenova/transformers");

async function download() {
  console.log("Pre-downloading WavLM model...");
  env.allowLocalModels = false;
  try {
    await pipeline("feature-extraction", "Xenova/wavlm-base-plus-sv", {
      quantized: true,
    });
    console.log("Model downloaded successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to download model:", err);
    process.exit(1);
  }
}

download();
