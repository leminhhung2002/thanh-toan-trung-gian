const path = require('node:path');

const rootDir = __dirname;
const logsDir = path.join(rootDir, 'logs', 'pm2');

module.exports = {
  apps: [
    {
      name: 'api',
      cwd: path.join(rootDir, 'api'),
      script: 'dist/src/main.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
      out_file: path.join(logsDir, 'api-out.log'),
      error_file: path.join(logsDir, 'api-error.log'),
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'telegram-bot',
      cwd: path.join(rootDir, 'telegram-bot'),
      script: 'dist/main.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
      out_file: path.join(logsDir, 'telegram-bot-out.log'),
      error_file: path.join(logsDir, 'telegram-bot-error.log'),
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'client',
      cwd: path.join(rootDir, 'client'),
      script: '.output/server/index.mjs',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,
      out_file: path.join(logsDir, 'client-out.log'),
      error_file: path.join(logsDir, 'client-error.log'),
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3001',
      },
    },
  ],
};
