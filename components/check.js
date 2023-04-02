var log = (...args) => { /* do nothing */ }

class Check {
  constructor(that) {
    this.config = that.config
    this.lib = that.lib
    this.gitCheck = that.gitCheck
    this.sendSocketNotification = (...args) => that.sendSocketNotification(...args)
    if (that.config.debug) log = (...args) => { console.log("[UN] [CHECK]", ...args) }
    this.updateTimer= null
    this.ForceCheck = false
  }

  async configureModules(modules) {
    for (const moduleName of modules) {
      if (!this.ignoreUpdateChecking(moduleName)) {
        await this.gitCheck.add(moduleName)
      } else {
        log("Ignore module: " + moduleName)
      }
    }
    await this.gitCheck.add("MagicMirror")
    log("Total to Check:", this.gitCheck.gitRepos.length)
  }

  async performFetch() {
    if (this.ForceCheck) log("Force Scan Start")
    const result = await this.gitCheck.getRepos()
    log("Final Result", result)
    this.sendStatus(result)
    this.scheduleNextFetch(this.config.updateInterval)
  }

  async updateForce(handler) {
    clearTimeout(this.updateTimer)
    await this.performFetch()
    if (this.ForceCheck) log("Force Scan End.")
    this.sendSocketNotification("SCAN_COMPLETE", handler)
    this.ForceCheck = false
  }

  scheduleNextFetch(delay) {
    if (delay < 60 * 1000) delay = 60 * 1000

    clearTimeout(this.updateTimer)
    this.updateTimer = setTimeout(async ()=> {
      await this.performFetch()
    }, delay)
  }

  ignoreUpdateChecking(moduleName) {
    // Should not check for updates for default modules
    if (this.lib.defaultModules.indexOf(moduleName) >= 0) {
      return true
    }

    // Should not check for updates for ignored modules
    if (this.config.ignoreModules.indexOf(moduleName) >= 0) {
      return true
    }

    // The rest of the modules that passes should check for updates
    return false
  }

  sendStatus(data) {
    if (!data) return
    this.sendSocketNotification("STATUS", data)
  }
}

module.exports = Check;
