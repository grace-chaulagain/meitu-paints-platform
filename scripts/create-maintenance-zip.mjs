import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const stagingDir = path.join(rootDir, "maintenance-package-staging");
const outputDir = path.join(rootDir, "dist-packages");
const zipPath = path.join(outputDir, "meitu-maintenance-page.zip");
const sourceHtml = path.join(rootDir, "maintenance", "index.html");

const readmeContents = `Meitu Paints - Temporary Maintenance Page
==========================================

This is a single self-contained static page (no build step, no server
required) used to temporarily replace the live site while the new website
is being prepared.

Deploy on Hostinger:

1. In hPanel, open File Manager for the domain (or the static site's
   public_html directory).
2. Back up whatever is currently live there if you may want to restore it.
3. Upload index.html from this zip into public_html/, replacing the
   existing index.html (or the current app's entry point).
4. Visit the domain to confirm the maintenance page is now showing.

To bring the real site back later, restore the previous deployment
(e.g. re-upload the production build/zip, or redeploy the Node.js app).
`;

async function assertFile(filePath, message) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(message);
  }
}

async function main() {
  await assertFile(sourceHtml, `Maintenance page not found at ${sourceHtml}.`);

  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });
  await fs.mkdir(stagingDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  await fs.copyFile(sourceHtml, path.join(stagingDir, "index.html"));
  await fs.writeFile(path.join(stagingDir, "README.txt"), readmeContents);

  const zip = spawnSync("zip", ["-r", "-q", zipPath, "."], {
    cwd: stagingDir,
    stdio: "inherit",
  });

  if (zip.error) throw zip.error;
  if (zip.status !== 0) {
    throw new Error(`zip command failed with exit code ${zip.status}`);
  }

  console.log(`Created ${zipPath}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
