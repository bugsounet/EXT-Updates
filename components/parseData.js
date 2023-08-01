/** parse data from MagicMirror **/
var _load = require("../components/loadLibraries.js")

function init(that) {
  that.lib = { error: 0 }
  that.config = {}
  that.updateProcessStarted= false
  that.init = false
  that.version = global.version
  that.root_path = global.root_path
}

async function parse(that) {
  let bugsounet = await _load.libraries(that)
  if (bugsounet) {
    console.error("[UPDATES] [DATA] Warning:", bugsounet, "needed library not loaded !")
    return
  }
  that.update = new that.lib.update(that)
  that.sendSocketNotification("WELCOME", { PID: process.pid })
  that.sendSocketNotification("READY")
  that.init = true
}

exports.init = init
exports.parse = parse
