const arvis = [
  {
    name: "Hub",
    namespace: "ArviS",
    cwd: __dirname,
    script: require.resolve("expo/bin/cli"),
    args: "start",
    interpreter: process.execPath,
    watch: false,
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    max_memory_restart: "2G",
  },
];

module.exports = { apps: arvis };
