const buildApp = require("./app");

const isDev = process.env.NODE_ENV === "development";
const app = buildApp(isDev);

if (isDev) {
  const bsConfig = require("../bs-config");
  const proxiedURL = new URL(bsConfig.proxy);
  const proxiedPort = proxiedURL.port;
  app.listen(proxiedPort, () => {
    console.log(`Listening on port ${bsConfig.port} via Browsersync.`);
  });
} else {
  const port = +process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Listening on port ${port}.`);
  });
}
