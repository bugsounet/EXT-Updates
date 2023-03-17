/** All credit to Michael Teeuw https://michaelteeuw.nl **/
/** modified by @bugsounet for TelegramBot, NPM_UPDATE checker support **/
/** and add auto-updater **/

const fs = require("fs")
const path = require("path")
const defaultModules = require(__dirname + "/../default/defaultmodules.js")
const NodeHelper = require("node_helper")
var exec = require('child_process').exec
var spawn = require('child_process').spawn
const pm2 = require('pm2')
var log = (...args) => { /* do nothing */ }
const npmCheck = require ("./components/npmCheck.js")
const gitCheck = require("./components/gitCheck.js")

module.exports = NodeHelper.create({
  start: function () {
    this.Checker= []
    this.config= {}

    this.ForceCheck = false
    this.init = false
	  this.updateTimer= null
	  this.updateProcessStarted= false
    this.gitCheck= null

    console.log("[UN] EXT-UpdateNotification Version:", require('./package.json').version, "rev:", require('./package.json').rev)
    console.log("[UN] MagicMirror is running on pid:", process.pid)
  },

  configureModules: async function (modules) {
		for (const moduleName of modules) {
			if (!this.ignoreUpdateChecking(moduleName)) {
				await this.gitCheck.add(moduleName)
			} else {
        log("Ignore module: " + moduleName)
      }
		}
		await this.gitCheck.add("MagicMirror")
    log("Total of Check:", this.gitCheck.gitRepos.length)
  },

  socketNotificationReceived: async function (notification, payload) {
    switch (notification) {
      case "CONFIG":
        this.config = payload
        if (this.config.debug) log = (...args) => { console.log("[UN]", ...args) }
        this.gitCheck= new gitCheck(this.config)
        if (this.config.notification.sendReady) this.sendSocketNotification("WELCOME", process.pid)
        break
      case "MODULES":
      /*
        clearTimeout(this.updateTimer)
        this.updateTimer = null
        this.simpleGits = []
        var data = []
        this.configureModules(payload).then(async () => {
          data = await this.performFetch()
          this.sendSocketNotification("INITIALIZED", require('./package.json').version)
          this.sendStatus(data)
          this.scheduleNextFetch(this.config.updateInterval)
          this.performNPMCheck(payload)
        })
        break
      */
        if (!this.updateProcessStarted) {
          this.sendSocketNotification("INITIALIZED", require('./package.json').version)
				  this.updateProcessStarted = true
				  await this.configureModules(payload)
				  await this.performFetch()
          this.performNPMCheck(payload)
			  }
        break
      case "DISPLAY_ERROR":
        console.log("[UN] Callbacks errors:\n\n" + payload)
        break
      case "UPDATE":
        this.updateProcess(payload)
        break
      case "FORCE_CHECK":
        this.ForceCheck = true
        this.updateForce(payload)
        break
      case "CLOSEMM":
        this.doClose()
        break
      case "RESTARTMM":
        this.restartMM()
        break
    }
  },

	async performFetch() {
    if (this.ForceCheck) log("Force Scan Start")
		const repos = await this.gitCheck.getRepos()

		//for (const repo of repos) {
			this.sendSocketNotification("STATUS", repos)
		//}

		this.scheduleNextFetch(this.config.updateInterval)
	},

  updateForce: async function (handler) {
    clearTimeout(this.updateTimer)
    var info = []
    info = await this.performFetch()
    if (this.ForceCheck) log("Force Scan End.")
    this.sendStatus(info)
    this.sendSocketNotification("SCAN_COMPLETE", handler)
    this.ForceCheck = false
    this.scheduleNextFetch(this.config.updateInterval)
  },
  /************************************************/

  scheduleNextFetch: function (delay) {
    if (delay < 60 * 1000) delay = 60 * 1000

    clearTimeout(this.updateTimer)
    this.updateTimer = setTimeout(async ()=> {
      var data = []
      data = await this.performFetch()
      this.sendStatus(data)
      this.scheduleNextFetch(this.config.updateInterval)
    }, delay)
  },

  ignoreUpdateChecking: function (moduleName) {
    // Should not check for updates for default modules
    if (defaultModules.indexOf(moduleName) >= 0) {
      return true
    }

    // Should not check for updates for ignored modules
    if (this.config.ignoreModules.indexOf(moduleName) >= 0) {
      return true
    }

    // The rest of the modules that passes should check for updates
    return false
  },

  sendStatus: function (data) {
    if (!data) return
    this.sendSocketNotification("STATUS", data)
  },

  /** update **/
  updateProcess: function (module) {
    if (module == "MagicMirror") {
      var modulePath = path.normalize(__dirname + "/../../")
    } else {
      var Path = path.normalize(__dirname + "/../")
      var modulePath = Path + module
    }
    this.config.updateCommands.forEach(updateCommand => {
      if (updateCommand.module == module) Command = updateCommand.command
    })

    if (!Command) return console.log(`[UN] Update of $(module) not supported.`)

    exec(Command, {cwd : modulePath, timeout: this.config.update.timeout } , (error, stdout, stderr) => {
      if (error) {
        console.error(`[UN] exec error: ${error}`)
        if (this.config.notification.useTelegramBot && this.config.notification.useCallback) {
          var res = {'results': error.toString().split('\n')}
          var final = "Update logs of " + module + ":\n\n"
          res.results.forEach(value => {
            if (value) final += this.ExtraChars(this.StripColor(value)) + "\n"
          })
          final += "\n" + this.ExtraChars("[UN] Update error!") + "\n"
          this.sendSocketNotification("SendResult", final)
        }
        this.sendSocketNotification("ERROR_UPDATE" , module)
      } else {
        console.log(`[UN] Update logs of ${module}: ${stdout}`)
        if (this.config.notification.useTelegramBot && this.config.notification.useCallback) {
          /** trying to parse stdout to Telegram without errors ... it's horrible ! **/
          var res = {'results': stdout.split('\n')}
          var final = "Update logs of " + module + ":\n\n"
          res.results.forEach(value => {
            if (value) final += this.ExtraChars(this.StripColor(value)) + "\n"
          })
          final += "\n" + this.ExtraChars("[UN] Process update done") + "\n"
          this.sendSocketNotification("SendResult", final)
        }
        this.sendSocketNotification("UPDATED", module)
        if (this.config.update.autoRestart) {
          log("Process update done")
          setTimeout(() => this.restartMM(), 3000)
        } else {
          log("Process update done, don't forget to restart MagicMirror!")
          this.sendSocketNotification("NEEDRESTART")
        }
      }
    })
  },

  /** MagicMirror restart and stop **/
  restartMM: function() {
    if (this.config.update.usePM2) {
      pm2.restart(this.config.update.PM2Name, (err, proc) => {
        if (err) {
          console.log("[UN] " + err)
          if (this.config.notification.useTelegramBot) this.sendSocketNotification("SendResult", err.toString())
        }
      })
    }
    else this.doRestart()
  },

  doRestart: function() {
    /** if don't use PM2 and launched with mpn start **/
    /** but no control of it **/
    /** I add stopMM command on telegram to stop process **/
    /** @Saljoke is happy it's sooOOooOO Good ! **/
    console.log("Restarting MagicMirror...")
    var MMdir = path.normalize(__dirname + "/../../")
    const out = this.config.update.logToConsole ? process.stdout : fs.openSync('./MagicMirror.log', 'a')
    const err = this.config.update.logToConsole ? process.stderr : fs.openSync('./MagicMirror.log', 'a')
    const subprocess = spawn("npm start", {cwd: MMdir, shell: true, detached: true , stdio: [ 'ignore', out, err ]})
    subprocess.unref()
    process.exit()
  },

  doClose: function() {
    if (!this.config.update.usePM2) process.abort()
    else {
      pm2.stop(this.config.update.PM2Name, (err, proc) => {
        if (err) {
          console.log("[UN] " + err)
          if (this.config.notification.useTelegramBot) this.sendSocketNotification("SendResult", err.toString())
        }
      })
    }
  },

  /** remove ExtraChars for telegramBot markdown **/
  ExtraChars: function(str) {
    str = str.replace(/[\s]{2,}/g," ") // delete space doubles, and more
    str = str.replace(/^[\s]/, "") // delete space on the begin
    str = str.replace(/[\s]$/,"") // delete space on the end
    str = str.replace("|",":") // simple replace | to : for more visibility
    /** special markdown for Telegram **/
    str = str.replace(new RegExp("_", "g"), "\\_") //
    str = str.replace(new RegExp("\\*", "g"), "\\*")
    str = str.replace(new RegExp("\\[", "g"), "\\[")
    str = str.replace(new RegExp("`", "g"), "\\`")
    return str
  },

  /** remove only color **/
  StripColor: function(str) {
    str = str.replace(/\[(\[H\033\[2J|\d+;\d+H|\d+(;\d+;\d+(;\d+;\d+)?m|[m])|1K)|\[m/g, '')
    return str
  },

  performNPMCheck: function(modules) {
    if (!modules) return // should never happen ...
    this.Checker= []
    modules.forEach(module => {
      if (defaultModules.indexOf(module) >= 0) {
        return
      }

      if (this.config.ignoreModules.indexOf(module) >= 0) {
        log("Ignore npmCheck module:", module)
        return
      }

      var cfg = {
        dirName: path.resolve(__dirname + "/../" + module),
        moduleName: module,
        timer: this.config.updateInterval,
        debug: this.config.debug
      }
      this.Checker[module] = new npmCheck(cfg, update => { this.sendSocketNotification("NPM_UPDATE", update)} )
    })
  }
});
