import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const frontendDist = path.join(repoRoot, "Frontend", "meitupaints", "dist");
const rootDist = path.join(repoRoot, "dist");

if (!fs.existsSync(frontendDist)) {
  throw new Error(`Frontend build output not found at ${frontendDist}`);
}

fs.rmSync(rootDist, { recursive: true, force: true });
fs.mkdirSync(rootDist, { recursive: true });
fs.cpSync(frontendDist, rootDist, { recursive: true });

console.log(`Synced Hostinger output directory: ${rootDist}`);
