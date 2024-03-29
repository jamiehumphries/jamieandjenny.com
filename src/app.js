const express = require("express");
const basicAuth = require("express-basic-auth");
const bodyParser = require("body-parser");
const enforce = require("express-sslify");
const nunjucks = require("nunjucks");
const path = require("path");

const { notFoundHandler, unexpectedErrorHandler } = require("./error-handlers");
const filters = require("./filters");
const router = require("./router");

function buildApp(isDev) {
  const app = express();

  if (!isDev) {
    app.use(enforce.HTTPS({ trustProtoHeader: true }));
  }

  const views = path.join(__dirname, "views");
  const nunjucksEnv = nunjucks.configure(views, {
    express: app,
    noCache: isDev,
    watch: isDev,
  });
  Object.entries(filters).forEach(([name, filter]) =>
    nunjucksEnv.addFilter(name, filter)
  );
  app.set("view engine", "njk");

  const users = JSON.parse(process.env.USERS.replaceAll('\\"', '"'));
  app.use(basicAuth({ users, challenge: true }));

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(router);

  app.use(express.static(path.join(__dirname, "public/static")));
  app.use(express.static(path.join(__dirname, "public/generated")));

  if (isDev) {
    // Serve Sass files in dev for source mapping.
    app.use("/styles", express.static(path.join(__dirname, "styles")));
  }

  app.use(notFoundHandler());
  app.use(unexpectedErrorHandler(isDev));

  return app;
}

module.exports = buildApp;
