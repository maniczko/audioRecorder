import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

function readFile(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function assertMatch(content, relativePath, description, pattern) {
  if (!pattern.test(content)) {
    throw new Error(`Workflow validation failed for ${relativePath}: missing ${description}`);
  }
}

const productionWorkflowPath = ".github/workflows/vercel-production.yml";
const previewWorkflowPath = ".github/workflows/preview.yml";

const productionWorkflow = readFile(productionWorkflowPath);
const previewWorkflow = readFile(previewWorkflowPath);

assertMatch(productionWorkflow, productionWorkflowPath, "production push trigger on main", /push:\s*\n\s*branches:\s*\[main\]/m);
assertMatch(productionWorkflow, productionWorkflowPath, "workflow_dispatch trigger", /workflow_dispatch:/m);
assertMatch(previewWorkflow, previewWorkflowPath, "pull_request trigger", /pull_request:/m);

for (const [relativePath, content] of [
  [productionWorkflowPath, productionWorkflow],
  [previewWorkflowPath, previewWorkflow],
]) {
  assertMatch(content, relativePath, "Validate Vercel secrets step", /name:\s*Validate Vercel secrets/m);
  assertMatch(content, relativePath, "VERCEL_TOKEN env reference", /VERCEL_TOKEN:\s*\$\{\{\s*secrets\.VERCEL_TOKEN\s*\}\}/m);
  assertMatch(content, relativePath, "VERCEL_ORG_ID env reference", /VERCEL_ORG_ID:\s*\$\{\{\s*secrets\.VERCEL_ORG_ID\s*\}\}/m);
  assertMatch(content, relativePath, "VERCEL_PROJECT_ID env reference", /VERCEL_PROJECT_ID:\s*\$\{\{\s*secrets\.VERCEL_PROJECT_ID\s*\}\}/m);
}

assertMatch(productionWorkflow, productionWorkflowPath, "production vercel pull", /vercel pull --yes --environment=production --token="\$VERCEL_TOKEN"/m);
assertMatch(productionWorkflow, productionWorkflowPath, "production vercel build", /vercel build --prod --token="\$VERCEL_TOKEN"/m);
assertMatch(productionWorkflow, productionWorkflowPath, "production vercel deploy", /vercel deploy --prebuilt --prod --token="\$VERCEL_TOKEN"/m);

assertMatch(previewWorkflow, previewWorkflowPath, "preview vercel pull", /vercel pull --yes --environment=preview --token="\$VERCEL_TOKEN"/m);
assertMatch(previewWorkflow, previewWorkflowPath, "preview vercel build", /vercel build --token="\$VERCEL_TOKEN"/m);
assertMatch(previewWorkflow, previewWorkflowPath, "preview vercel deploy", /vercel deploy --prebuilt --token="\$VERCEL_TOKEN"/m);

console.log("Vercel workflow validation passed.");
