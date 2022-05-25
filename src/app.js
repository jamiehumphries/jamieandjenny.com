const express = require("express");
const enforce = require("express-sslify");
const nunjucks = require("nunjucks");
const path = require("path");

const router = require("./router");

function buildApp(isDev) {
  const app = express();

  if (!isDev) {
    app.use(enforce.HTTPS({ trustProtoHeader: true }));
  }

  const views = path.join(__dirname, "views");
  nunjucks.configure(views, {
    express: app,
    noCache: isDev,
    watch: isDev,
  });
  app.set("view engine", "njk");

  app.use(router);

  app.use(express.static(path.join(__dirname, "public/static")));
  app.use(express.static(path.join(__dirname, "public/generated")));

  if (isDev) {
    // Serve Sass files in dev for source mapping.
    app.use("/styles", express.static(path.join(__dirname, "styles")));
  }

  return app;
}

module.exports = buildApp;
