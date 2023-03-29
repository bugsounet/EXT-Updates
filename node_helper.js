/* Magic Mirror
 * plugin: EXT-UpdateNotification v2
 * @bugsounet ©2023/03
 * MIT Licensed.
 */

var parseData = require("./components/parseData.js")
const NodeHelper = require("node_helper")
var log = (...args) => { /* do nothing */ }

module.exports = NodeHelper.create({
  start: function () {
    parseData.init(this)
  },

  socketNotificationReceived: async function (notification, payload) {
    switch (notification) {
      case "CONFIG":
        this.config = payload
        if (this.config.debug) log = (...args) => { console.log("[UN]", ...args) }
        console.log("[UN] EXT-UpdateNotification Version:", require('./package.json').version, "rev:", require('./package.json').rev)
        console.log("[UN] MagicMirror is running on pid:", process.pid)
        await parseData.parse(this)
        break
      case "MODULES":
        if (!this.updateProcessStarted) {
          this.sendSocketNotification("INITIALIZED", require('./package.json').version)
          this.updateProcessStarted = true
          await this.check.configureModules(payload)
          await this.check.performFetch()
			  }
        break
      case "DISPLAY_ERROR":
        console.error("[UN] Callbacks errors:\n\n" + payload)
        break
      case "UPDATE":
        this.update.process(payload)
        break
      case "FORCE_CHECK":
        this.check.ForceCheck = true
        this.check.updateForce(payload)
        break
      case "CLOSE":
        this.update.close()
        break
      case "RESTART":
        this.update.restart()
        break
    }
  }
});
