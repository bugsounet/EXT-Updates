/*
 * EXT-Updates
 */

const NodeHelper = require("node_helper");
const Updater = require("./components/update.js");

var log = (...args) => { /* do nothing */ };

module.exports = NodeHelper.create({
  start () {
    this.config = {};
    this.updateProcessStarted= false;
    this.init = false;
    this.version = global.version;
    this.root_path = global.root_path;
  },

  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "CONFIG":
        this.config = payload;
        this.config.root_path = this.root_path;
        if (this.config.debug) log = (...args) => { console.log("[UPDATES]", ...args); };
        this.initialize();
        break;
      case "MODULES":
        if (!this.updateProcessStarted) {
          this.sendSocketNotification("INITIALIZED", require("./package.json").version);
          this.updateProcessStarted = true;
        }
        break;
      case "DISPLAY_ERROR":
        console.error(`[UPDATES] Callbacks errors:\n\n${payload}`);
        break;
      case "UPDATE":
        this.update.process(payload);
        break;
      case "CLOSE":
        this.update.close();
        break;
      case "RESTART":
        this.update.restart();
        break;
    }
  },

  initialize () {
    console.log("[UPDATES] EXT-Updates Version:", require("./package.json").version, "rev:", require("./package.json").rev);
    console.log("[UPDATES] MagicMirror is running on pid:", process.pid);
    let Tools = {
      sendSocketNotification: (...args) => { this.sendSocketNotification(...args); }
    };
    this.update = new Updater(this.config, Tools);
    this.sendSocketNotification("WELCOME", { PID: process.pid });
    this.sendSocketNotification("READY");
  }
});
