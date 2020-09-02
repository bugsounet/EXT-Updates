/* Magic Mirror
 * Module: UpdateNotification
 *
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */

/** All credit to Michael Teeuw https://michaelteeuw.nl **/
/** modified by @bugsounet for TelegramBot and NPM_UPDATE checker support **/

Module.register("MMM-UpdateNotification", {
  defaults: {
    debug: true,
    updateInterval: 10 * 60 * 1000, // every 10 minutes
    refreshInterval: 24 * 60 * 60 * 1000, // restart time : 24 hours
    startDelay: 60 * 1000, // delay before 1st scan
    ignoreModules: [],
    updateCommands: [
      {
        module: "MagicMirror",
        command: "rm package-lock.json && git pull && npm install"
      },
      {
        module: "MMM-GoogleAssistant",
        command: "npm run update -- without-prompt"
      },
      {
        module: "MMM-Assistant2Display",
        command: "npm run update -- without-prompt"
      }
    ],
    notification: {
      useTelegramBot: true,
      sendReady: true,
      useScreen: true,
      useCallback: true
    },
    update: {
      autoUpdate: true,
      autoRestart: true,
      usePM2: true,
      PM2Name: "0",
      defaultCommand: "git pull && npm install",
      updateMagicMirror: false,
      logToConsole: false
    }
  },

  suspended: false,
  moduleList: {},
  npmList: {},
  notiTB: {},

  start: function () {
    console.log("[UN] Start MMM-UpdateNotification")
    this.config = configMerge({}, this.defaults, this.config)
    this.suspended = !this.config.notification.useScreen
    this.init= false
    this.updating= false
    this.modulesName= []
    this.modulesInfo( cb => console.log("[UN] Modules find:", this.modulesName.length))
    setInterval(() => {
      /** reset all and restart **/
      this.modulesName= []
      this.moduleList = {}
      this.npmList = {}
      this.modulesInfo(cb => this.sendSocketNotification("MODULES", this.modulesName))
      this.updateDom(2)
    }, this.config.refreshInterval)
  },

  notificationReceived: function (notification, payload, sender) {
    switch (notification) {
      case "DOM_OBJECTS_CREATED":
        this.sendSocketNotification("CONFIG", this.config)
        /** wait a little time ... every one is loading ! it's just an RPI !!! **/
        setTimeout(() => this.sendSocketNotification("MODULES", this.modulesName), this.config.startDelay)
        break
      case "NPM_UPDATE":
        //console.log("npm", payload)
        this.updateUI(payload)
        break
    }
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "STATUS":
        //console.log("modules", payload)
        this.updateUI(payload)
        break
      case "INITIALIZED":
        this.init=true
        if (this.config.notification.useTelegramBot && this.config.notification.sendReady) {
          this.sendNotification("TELBOT_TELL_ADMIN", this.translate("INITIALIZED", { VERSION: payload }))
        }
        break
      case "WELCOME":
        this.sendNotification("TELBOT_TELL_ADMIN", this.translate(this.config.update.usePM2 ? "WELCOME" : "WELCOMEPID", this.config.update.usePM2 ? {} : { PID: payload }))
        break
      case "UPDATED":
        this.updating = false
        this.sendNotification("TELBOT_TELL_ADMIN", this.translate("UPDATE_DONE", { MODULE_NAME: payload }))
        break
      case "NEEDRESTART":
        this.sendNotification("TELBOT_TELL_ADMIN",  this.translate("NEEDRESTART"))
        break
      case "ERROR_UPDATE":
        this.updating = false
        this.sendNotification("TELBOT_TELL_ADMIN",  this.translate("UPDATE_ERROR", { ERROR: payload }))
        break
      case "SendResult":
        this.updating = false
        this.sendNotification("TELBOT_TELL_ADMIN", payload, {parse_mode:'Markdown'})
        break
      case "SCAN_COMPLETE":
        this.checkCallback()
        break
    }
  },

  updateUI: function (payload) {
    if (payload) {
      if (payload.installed && payload.latest && payload.library) {
        this.npmList[payload.library + " [" + payload.module +"]"] = payload
        this.updateDom(2);
      }
      else if (payload.behind > 0) {
        // if we haven't seen info for this module
        if (this.moduleList[payload.module] === undefined) {
          // save it
          this.moduleList[payload.module] = payload
          this.updateDom(2);
        }
      } else if (payload.behind === 0) {
        // if the module WAS in the list, but shouldn't be
        if (this.notiTB[payload.module] !== undefined) {
          // remove from TelegramBot
          delete this.notiTB[payload.module]
        }
        if (this.moduleList[payload.module] !== undefined) {
          // remove it
          delete this.moduleList[payload.module]
          this.updateDom(2);
        }
      }
    }
  },

  // Override dom generator.
  getDom: function () {
    var wrapper = document.createElement("div")
    // process the hash of module info found
    for (var key of Object.keys(this.moduleList)) {
      if (typeof this.notiTB[key] === "undefined") {
        this.notiTB[key] = true
      }
      let m = this.moduleList[key]
      var updateInfoKeyName = m.behind === 1 ? "UPDATE_INFO_SINGLE" : "UPDATE_INFO_MULTIPLE"

      if (this.suspended === false) {
        var message = document.createElement("div")
        message.className = "small bright"

        var icon = document.createElement("i")
        icon.className = "fa fa-exclamation-circle"
        icon.innerHTML = "&nbsp;"
        message.appendChild(icon)

        var subtextHtml = this.translate(updateInfoKeyName, {
          COMMIT_COUNT: m.behind,
          BRANCH_NAME: m.current
        })

        var text = document.createElement("span")
        if (m.module === "MagicMirror") {
          text.innerHTML = this.translate("UPDATE_NOTIFICATION")
          subtextHtml = ""
        } else {
          text.innerHTML = this.translate("UPDATE_NOTIFICATION_MODULE", {
          MODULE_NAME: m.module
          })
        }

        message.appendChild(text)
        wrapper.appendChild(message)

        var subtext = document.createElement("div")
        subtext.innerHTML = subtextHtml
        subtext.className = "xsmall dimmed"
        wrapper.appendChild(subtext)
      }

      /** send a noti wia telegram **/
      if (this.notiTB[key]) {
        if (this.config.notification.useTelegramBot) {
          let TB = null
          if (m.module === "MagicMirror") {
            TB = this.translate("UPDATE_NOTIFICATION") + "\n"
          } else {
            TB = this.translate("UPDATE_NOTIFICATION_MODULE", { MODULE_NAME: m.module }) + "\n"
          }
          TB += this.translate(updateInfoKeyName, { COMMIT_COUNT: m.behind, BRANCH_NAME: m.current }) + "\n"
          console.log("[UN] ", TB)
          this.sendNotification("TELBOT_TELL_ADMIN", TB)
        }
        if (this.config.update.autoUpdate && !this.updating) {
          if (m.module == "MagicMirror" && !this.config.updateMagicMirror) {
            /** don't update MM **/
            this.notiTB[key] = false
            this.updating = false
          }
          else {
            this.updateProcess(m.module)
            this.updating = true
          }
        }
        this.notiTB[key] = false
      }
    }
    for (var key of Object.keys(this.npmList)) {
      if (typeof this.notiTB[key] === "undefined") {
        this.notiTB[key] = true
      }
      let npm = this.npmList[key]

      if (this.suspended === false) {
        var message = document.createElement("div")
        message.className = "small bright"

        var icon = document.createElement("i")
        icon.className = "fa fa-exclamation-circle"
        icon.innerHTML = "&nbsp;"
        message.appendChild(icon)

        var subtextHtml = "[NPM] " + npm.library + " v" + npm.installed +" --> v" + npm.latest

        var text = document.createElement("span")
        text.innerHTML = this.translate("UPDATE_NOTIFICATION_MODULE", { MODULE_NAME: npm.module })

        message.appendChild(text)
        wrapper.appendChild(message)

        var subtext = document.createElement("div")
        subtext.innerHTML = subtextHtml
        subtext.className = "xsmall dimmed"
        wrapper.appendChild(subtext)
      }

      /** send a noti wia telegram **/
      if (this.notiTB[key]) {
        if (this.config.notification.useTelegramBot) {
          let TB = this.translate("UPDATE_NOTIFICATION_MODULE", { MODULE_NAME: npm.module }) + "\n"
          TB += "[NPM] " + npm.library + " v" + npm.installed +" -> v" + npm.latest + "\n"
          this.sendNotification("TELBOT_TELL_ADMIN", TB)
          console.log("[UN] ", TB)
        }
        if (this.config.update.autoUpdate && !this.updating) {
          this.updateProcess(npm.module)
          this.updating = true
        }
        this.notiTB[key] = false
      }
    }
    return wrapper
  },

  suspend: function () {
    this.suspended = true
  },
  resume: function () {
    if (this.config.notification.useScreen) {
      this.suspended = false
      this.updateDom(2)
    }
  },

  /** Update from Telegram **/
  getCommands: function(commander) {
    commander.add({
      command: "update",
      description: this.translate("HELP_UPDATE"),
      callback: "Update"
    })
    commander.add({
      command: "scan",
      description: this.translate("HELP_SCAN"),
      callback: "Scan"
    })
    commander.add({
      command: "stopMM",
      description: this.translate("HELP_STOP"),
      callback: "Stop"
    })
    commander.add({
      command: "restartMM",
      description: this.translate("HELP_RESTART"),
      callback: "Restart"
    })
    commander.add({
      command: "UN",
      description: this.translate("HELP_UN"),
      callback: "UNCommands"
    })
  },

  getTranslations: function() {
    return {
      en: "translations/en.json",
      fr: "translations/fr.json",
      it: "translations/it.json",
      de: "translations/de.json",
    }
  },

  getScripts: function () {
    return [
     "configMerge.min.js"
    ]
  },

  /** List Of all Modules with reading config file **/
  /** Module.definition return no info sometimes **/
  modulesInfo: function (cb) {
    for (let [item, value] of Object.entries(config.modules)) {
      if (!value.disabled) {
        this.modulesName.push(value.module)
      }
    }
    cb()
  },

  /** TelegramBot Commands **/
  Stop: function(command, handler) {
    handler.reply("TEXT", "Bye Bye!")
    this.sendSocketNotification("CLOSEMM")
  },

  Restart: function(command, handler) {
    /** @Saljoke says: Saljoke [02.09.20 00:27] Cedric philosophy 😂 **/
    /** So I make Joke ! **/
    handler.reply("TEXT", "[UN] Daddy @bugsounet haven't found a pretty sentence for restarting!\n")
    handler.reply("TEXT", "[@bugsounet] Ok... So restart now! You are lazy UpdateNotification ???")
    handler.reply("TEXT", "[UN] Sorry, I will restart ! I'M NOT LAZY !!!")
    setTimeout(() => {
      handler.reply("TEXT", "[@Saljoke] Cedric philosophy 😂")
      this.sendSocketNotification("RESTARTMM")
    }, 2000)
  },

  UNCommands: function(command, handler) {
    var helping = this.translate("HELP_UN") + "\n/update\n/scan\n/stopMM\n/restartMM\n"
    helping += this.translate("HELP_COMMAND")
    handler.reply("TEXT", helping + "\n")
  },

  Scan: function(command, handler) {
    if (!this.init) return handler.reply("TEXT", this.translate("INIT_INPROGRESS"))
    handler.reply("TEXT", this.translate("UPDATE_SCAN"))
    this.sendSocketNotification("FORCE_CHECK")
  },

  Update: function(command, handler) {
    if (!this.init) return handler.reply("TEXT", this.translate("INIT_INPROGRESS"))
    if (this.updating) return handler.reply("TEXT", this.translate("UPDATE_INPROGRESS"))
    if (handler.args) {
      var found = false
      /** update process **/
      for (let [name, value] of Object.entries(this.notiTB)) {
        if (this.updating) return
        if (name) {
          if ((this.npmList[name] && this.npmList[name].module == handler.args) || (this.moduleList[name] && this.moduleList[name].module == handler.args)) {
            found = true
            this.updating = true
            handler.reply("TEXT", this.translate("UPDATING", { MODULE_NAME: handler.args}))
            return this.updateProcess(handler.args)
          }
        }
      }
      if (!found) {
        if (this.modulesName.indexOf(handler.args) > 0) {
          handler.reply("TEXT", this.translate("NOUPDATE_TB",  { MODULE_NAME: handler.args}))
        }
        else handler.reply("TEXT", this.translate("MODULENOTFOUND",  { MODULE_NAME: handler.args}))
      }
    }
    else {
      /** List of all update **/
      var updateTxt = ""
      for (let [name, value] of Object.entries(this.notiTB)) {
        if (name) {
          if (this.npmList[name]) {
            updateTxt += "- *" + this.npmList[name].module + "*: " + this.npmList[name].library + " v" + this.npmList[name].installed + " --> v" +  this.npmList[name].latest + "\n"
          }
          else if (this.moduleList[name]) {
            if (this.moduleList[name].module === "MagicMirror") {
              updateTxt += "- *MagicMirror*: "
            } else {
              updateTxt += "- *" + this.moduleList[name].module + "*: "
            }
            var updateInfoKeyName = this.moduleList[name].behind === 1 ? "UPDATE_INFO_SINGLE" : "UPDATE_INFO_MULTIPLE"
            updateTxt += this.translate(updateInfoKeyName, { COMMIT_COUNT: this.moduleList[name].behind, BRANCH_NAME: this.moduleList[name].current }) + "\n"
          }
        }
      }
      if (updateTxt) {
        updateTxt += "\n"+ this.translate("UPDATE_HELPTB")
        handler.reply("TEXT", this.translate("UPDATE_TB") + "\n" + updateTxt, {parse_mode:'Markdown'})
      }
      else handler.reply("TEXT", this.translate("NOUPDATE_TB"), {parse_mode:'Markdown'})
    }
  },

  checkCallback() {
    /** callback for no module found **/
    var found = 0
    for (let [name, value] of Object.entries(this.notiTB)) {
      if (this.npmList[name] || this.moduleList[name]) found = 1
    }
    if (!found) this.sendNotification("TELBOT_TELL_ADMIN", this.translate("NOUPDATE_TB"))
  },

  updateProcess(module) {
    this.sendNotification("WAKEUP")
    this.sendSocketNotification("UPDATE", module)
  }
});
