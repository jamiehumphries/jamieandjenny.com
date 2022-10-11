const fs = require("fs-extra");
const nunjucks = require("nunjucks");
const { join } = require("path");

const root = join(__dirname, "..", "docs");

fs.emptyDirSync(root);

const publicDirs = ["generated", "gh-pages", "static"];
for (const publicDir of publicDirs) {
  const src = join(__dirname, "public", publicDir);
  fs.copySync(src, root);
}

const views = join(__dirname, "views");
nunjucks.configure(views);
const html = nunjucks.render("home.njk", { isStatic: true });
fs.writeFileSync(join(root, "index.html"), html);
