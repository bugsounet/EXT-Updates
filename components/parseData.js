/** parse data from MagicMirror **/
var _load = require("../components/loadLibraries.js")

function init(that) {
  that.lib = { error: 0 }
  that.config = {}


  that.updateProcessStarted= false
  that.gitCheck= null
  that.npmCheck= []
  that.init = false
}

async function parse(that) {
  let bugsounet = await _load.libraries(that)
  if (bugsounet) {
    console.error("[UN] [DATA] Warning:", bugsounet, "needed library not loaded !")
    return
  }
  that.tools = new that.lib.tools(that)
  that.update = new that.lib.update(that)
  that.gitCheck= new that.lib.gitCheck(that.config, that.lib)
  that.check = new that.lib.check(that)

  if (that.config.notification.sendReady) that.sendSocketNotification("WELCOME", process.pid)
  setTimeout(() => {
    that.sendSocketNotification("READY")
    that.init = true
  }, that.config.startDelay)
}

exports.init = init
exports.parse = parse
