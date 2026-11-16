module.exports = {
  apps: [
    {
      name: "unibeam-backend",
      script: "dist/main.js",
      cwd: __dirname,
      instances: 1, // 1 instance untuk menjaga in-memory signaling dan websocket state
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env_file: ".env",
      env: {
        NODE_ENV: "production",
        PORT: 7001,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 7001,
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "logs/error.log",
      out_file: "logs/combined.log",
      merge_logs: true,
    },
  ],
};
