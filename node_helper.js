/** All credit to Michael Teeuw https://michaelteeuw.nl **/
/** modified by @bugsounet for TelegramBot, NPM_UPDATE checker support **/
/** and add auto-updater **/

const SimpleGit = require("simple-git")
const fs = require("fs")
const path = require("path")
const defaultModules = require(__dirname + "/../default/defaultmodules.js")
const Log = require(__dirname + "/../../js/logger.js")
const NodeHelper = require("node_helper")
var exec = require('child_process').exec
var spawn = require('child_process').spawn
const pm2 = require('pm2')
var log = (...args) => { /* do nothing */ }

module.exports = NodeHelper.create({
  start: function () {
    this.simpleGits = []
    this.config= {}
    this.updateTimer= null
    this.ForceCheck = false
    this.init = false
    console.log("[UN] MMM-UpdateNotification Version:", require('./package.json').version)
    console.log("[UN] MagicMirror is running on pid:", process.pid)
  },

  configureModules: function (modules) {
    // Push MagicMirror itself , biggest chance it'll show up last in UI and isn't overwritten
    // others will be added in front
    // this method returns promises so we can't wait for every one to resolve before continuing
    this.simpleGits.push({ module: "MagicMirror", git: SimpleGit(path.normalize(__dirname + "/../../")) })

    var promises = []

    modules.forEach(moduleName => {
      if (!this.ignoreUpdateChecking(moduleName)) {
        // Default modules are included in the main MagicMirror repo
        var moduleFolder = path.normalize(__dirname + "/../" + moduleName)
        try {
          log("Checking git for module: " + moduleName + " in " + moduleFolder)
          let stat = fs.statSync(path.join(moduleFolder, ".git"))
          promises.push(this.resolveRemote(moduleName, moduleFolder))
        } catch (err) {
          return console.log("[UN] err: " + err)
          // Error when directory .git doesn't exist
          // This module is not managed with git, skip
        }
      } else log("Ignore module: " + moduleName)
    })
    log("Total modules to Check:", promises.length)
    return Promise.all(promises)
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "CONFIG":
        this.config = payload
        if (this.config.debug) log = (...args) => { console.log("[UN]", ...args) }
        if (this.config.notification.useTelegramBot && this.config.notification.sendReady) {
          this.sendSocketNotification("WELCOME", process.pid)
        }
        break
      case "MODULES":
        clearTimeout(this.updateTimer)
        this.updateTimer = null
        this.simpleGits = []
        this.configureModules(payload).then(() => this.performFetch())
        break
      case "UPDATE":
        this.updateProcess(payload)
        break
      case "FORCE_CHECK":
        this.ForceCheck = true
        this.performFetch()
        break
      case "CLOSEMM":
        this.doClose()
        break
      case "RESTARTMM":
        this.restartMM()
        break
    }
  },

  resolveRemote: function (moduleName, moduleFolder) {
    return new Promise((resolve, reject) => {
      var git = SimpleGit(moduleFolder)
      git.getRemotes(true, (err, remotes) => {
        if (remotes.length < 1 || remotes[0].name.length < 1) {
          // No valid remote for folder, skip
          return resolve()
        }
        // Folder has .git and has at least one git remote, watch this folder
        this.simpleGits.unshift({ module: moduleName, git: git })
        resolve()
      })
    })
  },

  performFetch: function () {
    var moduleGitInfo = {}
    if (this.ForceCheck) log("Force Scan Start")
    this.simpleGits.forEach((sg,nb) => {
      sg.git.fetch().status((err, data) => {
        data.module = sg.module
        log("[" + (nb+1) + "/" + this.simpleGits.length +"] Scan:" , data.module)
        if (!err) {
          /** send ONLY needed info **/
          moduleGitInfo = {
            module: data.module,
            behind: data.behind,
            current: data.current,
            tracking: data.tracking
          }
          if (!moduleGitInfo.current || !moduleGitInfo.tracking) {
            return log("Scan Infos not complete:", data.module)
          } else {
            log("Scan Infos:", moduleGitInfo)
            this.sendSocketNotification("STATUS", moduleGitInfo)
            if (this.ForceCheck || !this.init) this.scanChk(nb,this.simpleGits.length-1, this.init)
          }
        } else {
          log("Scan Error: " + data.module, err)
          if (this.ForceCheck || !this.init) this.scanChk(nb,this.simpleGits.length-1, this.init)
        }
      })
    })
    this.scheduleNextFetch(this.config.updateInterval);
  },

  scanChk: function(nb,length, init) {
    if (nb == length) {
      if (this.init) {
        this.ForceCheck = false
        log("Force Scan Complete")
        this.sendSocketNotification("SCAN_COMPLETE")
      }
      else {
        this.init = true
        this.sendSocketNotification("INITIALIZED", require('./package.json').version)
      }
    }
  },

  scheduleNextFetch: function (delay) {
    if (delay < 60 * 1000) {
      delay = 60 * 1000;
    }

    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(()=> {
      this.performFetch();
    }, delay);
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

  /** update **/
  updateProcess: function (module) {
    if (module == "MagicMirror") {
      var modulePath = path.normalize(__dirname + "/../../")
    } else {
      var Path = path.normalize(__dirname + "/../")
      var modulePath = Path + module
      var Command= this.config.update.defaultCommand
    }
    this.config.updateCommands.forEach(updateCommand => {
      if (updateCommand.module == module) Command = updateCommand.command
    })

    exec(Command, {cwd : modulePath } , (error, stdout, stderr) => {
      if (error) {
        console.error(`[UN] exec error: ${error}`)
        if (this.config.notification.useTelegramBot) {
          this.sendSocketNotification("SendResult", error.toString())
          this.sendSocketNotification("ERROR_UPDATE" , module)
        }
        return
      }
      log(`Update logs of ${module}: ${stdout}`)
      if (!error) {
        if (this.config.notification.useTelegramBot) {
          /** trying to parse stdout to Telegram without errors ... it's horrible ! **/
          var res = {'results': stdout.split('\n')}
          var final = "Update logs of " + module + "\n"
          res.results.forEach(value => {
            if (value) final += this.ExtraChars(value) + "\n"
          })
          //log("[UN] Final for telegramBot:", final)
          final += this.ExtraChars("[UN] Process update done! I do it... because you are so too lazy :)))") + "\n"
          if (this.config.notification.useCallback) this.sendSocketNotification("SendResult", final)
          this.sendSocketNotification("UPDATED" , module)
        }
        console.log("[UN] Process update done! I do it... because you are so too lazy :)))")
        if (this.config.update.autoUpdate || this.config.update.autoRestart) setTimeout(() => this.restartMM(), 3000)
      }
    });
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
    log("Restarting MagicMirror...")
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
  }
});
