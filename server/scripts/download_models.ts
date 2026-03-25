const { AutoModel, AutoProcessor, env } = require('@xenova/transformers');

async function download() {
  console.log('Pre-downloading WavLM model...');
  env.allowLocalModels = false;
  try {
    await AutoModel.from_pretrained('Xenova/wavlm-base-plus-sv', {
      quantized: true,
    });
    await AutoProcessor.from_pretrained('Xenova/wavlm-base-plus-sv');
    console.log('Model downloaded successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to download model:', err);
    process.exit(1);
  }
}

download();
