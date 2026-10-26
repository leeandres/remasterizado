const fs = require("fs");
const path = require("path");

function copy(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
}

const root = path.resolve(__dirname, "..");
copy(path.join(root, ".next", "static"), path.join(root, ".next", "standalone", ".next", "static"));
copy(path.join(root, "public"), path.join(root, ".next", "standalone", "public"));
console.log("Standalone assets copied.");
