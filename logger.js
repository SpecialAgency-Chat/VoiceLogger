const log4js = require("log4js");

module.exports = function configLogger() {
  log4js.configure({
    appenders: {
      console: {
        type: 'console',
      },
      app: {
        type: 'dateFile',
        filename: './logs/app.log',
        keepFileExt: true,
        pattern: 'yyyy-MM-dd',
        numBackups: 7,
        compress: true,
        mode: 0o0644,
      },
    },
    categories: {
      default: {
        appenders: ['console', 'app'],
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'trace',
        enableCallStack: true,
      },
    },
  });
}