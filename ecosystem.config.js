module.exports = {
  apps: [
    {
      name: "bingo-server",
      script: "server.js",
      watch: ["server.js", "public"],  // monitorea solo tu código y estáticos
      ignore_watch: ["node_modules", ".git", ".github", "logs"],
      env: {
        NODE_ENV: "production",
        PORT: 80
      }
    }
  ]
};

