/** npm check **/
/** bugsounet **/
/** Test version **/

const latestVersion = (...args) => import('latest-version').then(({default: latestVersion}) => latestVersion(...args));

class CheckNPM{
  constructor(config, callback = ()=> {}) {
    /** All @bugsounet npm library **/
    this.bugsounet = [
      "@bugsounet/cast",
      "@bugsounet/pir",
      "@bugsounet/screen",
      "@bugsounet/google-assistant",
      "@bugsounet/node-buffertomp3",
      "@bugsounet/node-lpcm16",
      "@bugsounet/snowboy",
      "@bugsounet/pronote-api",
      "@bugsounet/api-freebox4g",
      "@bugsounet/cvlc",
      "@bugsounet/freebox",
      "@bugsounet/google-photos",
      "@bugsounet/systemd",
      "@bugsounet/porcupine",
      "@bugsounet/cvlcmusicplayer",
      "@bugsounet/nat-api"
    ]
    this.npm = []
    this.config = config
    this.default = {
      dirName: "./",
      moduleName: "MMM-ModuleName",
      timer: 10 * 60 * 1000, // every 10 mins
      debug: false
    }
    this.timer = null
    this.cb = callback
    this.config = Object.assign(this.default, this.config)
    this.start()
  }

  /** main code **/
  async start () {
    this.npm = []
    this.npmCheckBugsounet()
    if (!this.npm.length) return
    await this.npmCheckCurrent()
    if (this.config.debug) console.log("[NPM] Details for " + this.config.moduleName , this.npm)
    this.CheckAllLibrary()
  }

  /** check of library is installed **/
  npmCheckBugsounet() {
    var pkg = this.config.dirName + "/node_modules/"
    this.bugsounet.forEach(bugsounet => {
      try {
        let version = require(pkg + bugsounet+ "/package.json").version
        let library = {
          name: bugsounet,
          installed: version
        }
        this.npm.push(library)
      } catch (err) { /** library not installed **/ }
    })
    if (this.config.debug) console.log("[NPM] Found: " + this.npm.length + "/" + this.bugsounet.length + " @bugsounet library", "["+this.config.moduleName+"]")
  }

  /** check the lastest version of the module **/
  npmCheckCurrent(library) {
    return new Promise((resolve) => {
      var i = 0
      this.npm.forEach(library => {
       (async () => {
          try {
           library.latest = await latestVersion(library.name)
          } catch (e) { console.log("[NPM] Error", e.message) }
          if (i == this.npm.length -1 ) resolve()
          else i += 1
        })()
      })
    })
  }

  /** check if update if needed **/
  CheckAllLibrary() {
    clearTimeout(this.timer)
    this.timer = null
    if (this.config.debug) console.log("[NPM] Check...", this.config.moduleName)
    var update = []
    this.npm.forEach((library) => {
      if (library.latest > library.installed) {
        if (this.config.debug) console.log("[NPM] " + this.config.moduleName + " - Library: " + library.name + " Update needed to v" + library.latest)
        var data= {
          module: this.config.moduleName,
          library: library.name,
          latest: library.latest,
          installed: library.installed
        }
        update.push(data)
      }
    })
    if (update.length > 0) this.cb(update)
    else if (!update.length && this.config.debug) console.log("[NPM] No update needed for", this.config.moduleName)
    this.timer= setTimeout(() => { this.start() }, this.config.timer)
  }
}

module.exports = CheckNPM
