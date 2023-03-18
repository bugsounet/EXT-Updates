/** npm check **/
/** bugsounet **/
/** Test version **/

const latestVersion = (...args) => import('latest-version').then(({default: latestVersion}) => latestVersion(...args));

class CheckNPM{
  constructor(config) {
    /** All @bugsounet npm library **/
    this.bugsounet = [
      "@bugsounet/google-assistant",
      "@bugsounet/node-buffertomp3",
      "@bugsounet/node-lpcm16",
      "@bugsounet/snowboy",
      "@bugsounet/cvlc",
      "@bugsounet/freebox",
      "@bugsounet/systemd",
      "@bugsounet/porcupine"
    ]
    this.npm = []
    this.config = config
    this.default = {
      dirName: "./",
      moduleName: "MMM-ModuleName",
      debug: false
    }
    this.timer = null
    this.config = Object.assign(this.default, this.config)
  }

  /** main code **/
  async check () {
    this.npmCheckBugsounet()
    if (!this.npm.length) return null
    await this.npmCheckCurrent()
    if (this.config.debug) console.log("[UN] [NPM] Details for " + this.config.moduleName , this.npm)
    return this.CheckAllLibrary()
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

    if (this.config.debug) console.log("[UN] [NPM] Found: " + this.npm.length + "/" + this.bugsounet.length + " @bugsounet library", "["+this.config.moduleName+"]")
  }

  /** check the lastest version of the module **/
  npmCheckCurrent(library) {
    return new Promise((resolve) => {
      var i = 0
      this.npm.forEach(library => {
       (async () => {
          try {
           library.latest = await latestVersion(library.name)
          } catch (e) { console.log("[UN] [NPM] Error", e.message) }
          if (i == this.npm.length -1 ) resolve()
          else i += 1
        })()
      })
    })
  }

  /** check if update if needed **/
  CheckAllLibrary() {
    if (this.config.debug) console.log("[UN] [NPM] Check...", this.config.moduleName)
    var data = null
    this.npm.forEach((library) => {
      if (library.latest > library.installed) {
        if (this.config.debug) console.log("[UN] [NPM] " + this.config.moduleName + " - Library: " + library.name + " Update needed to v" + library.latest)
        data= {
          module: this.config.moduleName,
          library: library.name,
          latest: library.latest,
          installed: library.installed
        }
      }
    })
    if (!data && this.config.debug) console.log("[UN] [NPM] No update needed for", this.config.moduleName)
    return data
  }
}

module.exports = CheckNPM
