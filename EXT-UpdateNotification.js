/* Magic Mirror
 * Module: EXT-UpdateNotification v2
 * @bugsounet ©2023/03
 * MIT Licensed.
 */

Module.register("EXT-UpdateNotification", {
  defaults: {
    debug: false,
    updateInterval: 10 * 60 * 1000, // every 10 minutes
    startDelay: 60 * 1000, // delay before 1st scan
    ignoreModules: [],
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
      logToConsole: true,
      timeout: 2*60*1000
    }
  },

  suspended: false,
  moduleList: {},
  npmList: {},
  notiTB: {},

  start: function () {
    console.log("[UN] Start EXT-UpdateNotification")
    this.internalCommands= [
      {
        module: "MMM-GoogleAssistant",
        command: "npm run update"
      },
      /** all EXT **/
      {
        module: "Gateway",
        command: "npm run update"
      },
      {
        module: "EXT-Alert",
        command: "npm run update"
      },
      {
        module: "EXT-Bring",
        command: "npm run update"
      },
      {
        module: "EXT-Background",
        command: "npm run update"
      },
      {
        module: "EXT-Browser",
        command: "npm run update"
      },
      {
        module: "EXT-Detector",
        command: "npm run update"
      },
      {
        module: "EXT-FreeboxTV",
        command: "npm run update"
      },
      {
        module: "EXT-GooglePhotos",
        command: "npm run update"
      },
      {
        module: "EXT-Governor",
        command: "npm run update"
      },
      {
        module: "EXT-Internet",
        command: "npm run update"
      },
      {
        module: "EXT-Librespot",
        command: "npm run update"
      },
      {
        module: "EXT-Keyboard",
        command: "npm run update"
      },
      {
        module: "EXT-Motion",
        command: "npm run update"
      },
      {
        module: "EXT-MusicPlayer",
        command: "npm run update"
      },
      {
        module: "EXT-Pages",
        command: "npm run update"
      },
      {
        module: "EXT-Photos",
        command: "npm run update"
      },
      {
        module: "EXT-Pir",
        command: "npm run update"
      },
      {
        module: "EXT-Raspotify",
        command: "npm run update"
      },
      {
        module: "EXT-RadioPlayer",
        command: "npm run update"
      },
      {
        module: "EXT-Screen",
        command: "npm run update"
      },
      {
        module: "EXT-ScreenManager",
        command: "npm run update"
      },
      {
        module: "EXT-ScreenTouch",
        command: "npm run update"
      },
      {
        module: "EXT-Selfies",
        command: "npm run update"
      },
      {
        module: "EXT-SelfiesFlash",
        command: "npm run update"
      },
      {
        module: "EXT-SelfiesSender",
        command: "npm run update"
      },
      {
        module: "EXT-SelfiesViewer",
        command: "npm run update"
      },
      {
        module: "EXT-Spotify",
        command: "npm run update"
      },
      {
        module: "EXT-SpotifyCanvasLyrics",
        command: "npm run update"
      },
      {
        module: "EXT-StreamDeck",
        command: "npm run update"
      },
      {
        module: "EXT-Telegrambot",
        command: "npm run update"
      },
      {
        module: "EXT-UpdateNotification",
        command: "npm run update"
      },
      {
        module: "EXT-Volume",
        command: "npm run update"
      },
      {
        module: "EXT-Welcome",
        command: "npm run update"
      },
      {
        module: "EXT-YouTube",
        command: "npm run update"
      },
      {
        module: "EXT-YouTubeCast",
        command: "npm run update"
      }
    ]
    this.nbDefaultCommands= this.internalCommands.length
    console.warn("[UN] Wow! there is", this.nbDefaultCommands, "@bugsounet modules in database")
    // merge internal database to config
    this.suspended = !this.config.notification.useScreen
    this.init= false
    this.update = {}
    this.updating= false
    this.modulesName= []
    this.modulesInfo( cb => console.log("[UN] Modules find:", this.modulesName.length))
    this.session= {}
  },

  notificationReceived: function (notification, payload, sender) {
    switch (notification) {
      case "DOM_OBJECTS_CREATED":
        this.sendSocketNotification("CONFIG", this.config)
        /** wait a little time ... every one is loading ! it's just an RPI !!! **/
        setTimeout(() => this.sendSocketNotification("MODULES", this.modulesName), this.config.startDelay)
        break
      case "GAv5_READY":
        if (sender.name == "MMM-GoogleAssistant") this.sendNotification("EXT_HELLO", this.name)
        break
      case "EXT_UPDATENOTIFICATION-UPDATE":
        if (!this.updating) this.updateFirstOnly()
        break
    }
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "STATUS":
        this.updateUI(payload)
        break
      case "INITIALIZED":
        this.init=true
        if (this.config.notification.sendReady) {
          if (this.config.notification.useTelegramBot) this.sendAdmin(this.translate("INITIALIZED", { VERSION: payload }))
          else this.sendAlert(this.translate("INITIALIZED", { VERSION: payload }), 5*1000, "information")
        }
        break
      case "WELCOME":
        if (this.config.notification.useTelegramBot) this.sendAdmin(this.translate(this.config.update.usePM2 ? "TB_WELCOME" : "TB_WELCOMEPID", this.config.update.usePM2 ? {} : { PID: payload }))
        else if (!this.config.update.usePM2) {
          this.sendAlert(this.translate("ALERT_WELCOMEPID", { PID: payload }), 5*1000, "information")
        }
        break
      case "UPDATED":
        this.updating = false
        if (this.config.notification.useTelegramBot) this.sendAdmin(this.translate("UPDATE_DONE", { MODULE_NAME: payload }))
        else this.sendAlert(this.translate("UPDATE_DONE", { MODULE_NAME: payload }), 5*1000, "information")
        break
      case "NEEDRESTART":
        if (this.config.notification.useTelegramBot) this.sendAdmin(this.translate("NEEDRESTART"))
        else this.sendAlert(this.translate("NEEDRESTART"), 5*1000, "warning")
        break
      case "ERROR_UPDATE":
        if (this.config.notification.useTelegramBot) this.sendAdmin(this.translate("TB_UPDATE_ERROR", { MODULE_NAME: payload }))
        else this.sendAlert(this.translate("ALERT_UPDATE_ERROR", { MODULE_NAME: payload }), 5*1000, "error")
        break
      case "SendResult":
        this.sendAdmin(payload, true)
        break
      case "SCAN_COMPLETE":
        this.checkCallback(payload)
        break
      case "NPM_UPDATE":
        this.updateUI(payload)
        break
    }
  },

  sendAdmin: function (text, parse) {
    if (parse) this.sendNotification("EXT_TELBOT-TELL_ADMIN", text, {parse_mode:'Markdown'})
    else this.sendNotification("EXT_TELBOT-TELL_ADMIN", text)
  },

  sendAlert: function (text, timer = 0, type) {
    this.sendNotification("EXT_ALERT", {
      type: type ,
      message: text,
      timer: timer,
      icon: "modules/EXT-UpdateNotification/resources/update.png"
    })
  },

  updateUI: function (modules) {
    modules.forEach((dataValue) => {
      if (dataValue) {
        if (dataValue.installed && dataValue.latest && dataValue.library) {
          this.npmList[dataValue.library + " [" + dataValue.module +"]"] = dataValue
          this.updateDom(2)
        }
        else if (dataValue.behind > 0) {
          // if we haven't seen info for this module
          if (this.moduleList[dataValue.module] === undefined) {
            // save it
            this.moduleList[dataValue.module] = dataValue
            this.updateDom(2)
          }
        } else if (dataValue.behind === 0) {
          // if the module WAS in the list, but shouldn't be
          if (this.notiTB[dataValue.module] !== undefined) {
            // remove from TelegramBot
            delete this.notiTB[dataValue.module]
          }
          if (this.moduleList[dataValue.module] !== undefined) {
            // remove it
            delete this.moduleList[dataValue.module]
            this.updateDom(2)
          }
        }
      }
    })
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
          this.sendAdmin(TB)
        }
        if (this.config.update.autoUpdate && !this.updating) {
          if (m.module == "MagicMirror") {
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
    if (Object.keys(this.moduleList).length) this.sendNotification("EXT_UN-MODULE_UPDATE", this.moduleList)

    /** display NPN module update **/
    for (var key of Object.keys(this.npmList)) {
      if (typeof this.notiTB[key] === "undefined") {
        this.notiTB[key] = true
      }
      let npm = this.npmList[key]

      /** NPM: if module is on ignoreModules array ... delete it **/
      if (this.config.ignoreModules.indexOf(npm.module) >= 0) {
        delete this.notiTB[key]
        delete this.npmList[key]
        continue
      }

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
          this.sendAdmin(TB)
        }
        if (this.config.update.autoUpdate && !this.updating) {
          this.updateProcess(npm.module)
          this.updating = true
        }
        this.notiTB[key] = false
      }
    }
    if (Object.keys(this.npmList).length) this.sendNotification("EXT_UN-NPM_UPDATE", this.npmList)

    return wrapper
  },

  getStyles: function() {
    return [ "font-awesome.css" ]
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
  EXT_TELBOTCommands: function(commander) {
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
    commander.add({
      command: "updateCommands",
      description: this.translate("HELP_UPDATECOMMAND"),
      callback: "updateCommands"
    })
  },

  getTranslations: function() {
    return {
      en: "translations/en.json",
      fr: "translations/fr.json",
      it: "translations/it.json",
      de: "translations/de.json",
      es: "translations/es.json",
      nl: "translations/nl.json"
    }
  },

  getScripts: function () {
    return [
     "configMerged.js"
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
    handler.reply("TEXT", "Restarting MagicMirror...")
    setTimeout(() => {
      this.sendSocketNotification("RESTARTMM")
    }, 1000)
  },

  UNCommands: function(command, handler) {
    var helping = this.translate("HELP_UN") + "\n/update\n/scan\n/stopMM\n/restartMM\n"
    helping += this.translate("HELP_COMMAND")
    handler.reply("TEXT", helping + "\n")
  },

  Scan: function(command, handler) {
    if (!this.init) return handler.reply("TEXT", this.translate("INIT_INPROGRESS"))
    var found = 0
    for (let [name, value] of Object.entries(this.notiTB)) {
      if (this.npmList[name] || this.moduleList[name]) found += 1
    }
    this.update.old = found
    handler.reply("TEXT", this.translate("UPDATE_SCAN"))
    /** try to manage session ... **/
    var chatId = handler.message.chat.id
    var userId = handler.message.from.id
    var messageId = handler.message.message_id
    var sessionId = messageId + ":" + userId + ":" + chatId
    this.session[sessionId] = handler
    this.sendSocketNotification("FORCE_CHECK", sessionId)
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

  checkCallback: function (session) {
    /** callback for update found **/
    var found = 0
    for (let [name, value] of Object.entries(this.notiTB)) {
      if (this.npmList[name] || this.moduleList[name]) found += 1
    }
    this.update.new = found

    let result = parseInt(this.update.new-this.update.old)
    if (!result || result <= 0) this.Reply("scan", this.session[session], this.translate("NOUPDATE_TB"), session)
    else if (result == 1) this.Reply("scan", this.session[session], this.translate("ONEUPDATE_TB"), session)
    else this.Reply("scan", this.session[session], this.translate("SOMEUPDATE_TB", { update: result }), session)
  },

  /** send a reply after all info received **/
  Reply: function(command, handler, message, session, markdown = false) {
    if (!message || !session) return console.log("[UN] Reply -- wrong Format!", message, session)
    handler.reply("TEXT", message, markdown )
    delete this.session[session]
  },

  updateProcess: function (module) {
    this.sendNotification("WAKEUP")
    this.sendSocketNotification("UPDATE", module)
  },

  updateFirstOnly: function() {
    if (!this.init || this.updating) return
    var name = Object.keys(this.notiTB)[0]
    if (!name) return
    if (this.npmList[name]) {
      this.updating = true
      console.log("NPM Updating:", this.npmList[name].module)
      this.updateProcess(this.npmList[name].module)
    } else if (this.moduleList[name]) {
      this.updating = true
      console.log("Module Updating:", this.moduleList[name].module)
      this.updateProcess(this.moduleList[name].module)
    }
  },

  ExtraChars: function(str) {
    /** special markdown for Telegram **/
    /** needed only if no markdown active **/
    if (!str) return str
    try {
      str = TelegramBotExtraChars(str)
    } catch (e) {
      // don't transform it :'(
      // TelegramBot can crash !
    }
    return str
  }
});
