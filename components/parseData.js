/** parse data from MagicMirror **/
var _load = require("../components/loadLibraries.js")

function init(that) {
  that.lib = { error: 0 }
  that.config = {}
  that.updateProcessStarted= false
  that.init = false
  that.version = global.version
  that.root_path = global.root_path
  that.usePM2 = false
  that.PM2 = null
}

async function parse(that) {
  let bugsounet = await _load.libraries(that)
  if (bugsounet) {
    console.error("[UPDATES] [DATA] Warning:", bugsounet, "needed library not loaded !")
    return
  }
  that.usePM2 = await check_PM2_Process(that)
  that.update = new that.lib.update(that)
  that.sendSocketNotification("WELCOME", { PID: process.pid, PM2: that.usePM2 })
  that.sendSocketNotification("READY")
  that.init = true
}

function check_PM2_Process(that) {
  return new Promise(resolve => {
    that.lib.pm2.connect(function(err) {
      if (err) {
        console.error("[UPDATES] [DATA] [PM2]", err)
        resolve(false)
      }
      that.lib.pm2.list((err, list) => {
        if (err) {
          console.error("[UPDATES] [DATA] [PM2]", err)
          resolve(false)
        }
        list.forEach(pm => {
          if ((pm.pm2_env.version === that.version) && (pm.pm2_env.status === "online") && (pm.pm2_env.PWD.includes(that.root_path))) {
            that.PM2 = pm.name
            console.log("[UPDATES] [DATA] [PM2] You are using pm2 with", that.PM2)
            resolve(true)
          }
        })
        that.lib.pm2.disconnect()
        if (!that.PM2) resolve(false)
      })
    })
  })
}

exports.init = init
exports.parse = parse
