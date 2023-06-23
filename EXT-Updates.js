/* Magic Mirror
 * plugin: EXT-Updates v1
 * @bugsounet ©2023/06
 * MIT Licensed.
 */

Module.register("EXT-Updates", {
  requiresVersion: "2.24.0",
  defaults: {
    debug: false,
    notification: {
      useTelegramBot: true,
      sendReady: true,
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

  start: function () {
    this.init= false
    this.update = {}
    this.updating= false
    this.modulesName= []
    this.session= {}
    this.moduleList= {}
    this.npmList= {}
    this.notify= {}
  },

  notificationReceived: function (notification, payload, sender) {
    switch (notification) {
      case "UPDATES":
        console.log("updates:", payload)
        this.checkUpdate(payload)
      case "DOM_OBJECTS_CREATED":
        this.modulesName= Object.keys(Module.definitions)
        break
      case "GW_READY":
        if (sender.name == "Gateway") this.sendSocketNotification("CONFIG", this.config)
        break
      case "EXT_UPDATENOTIFICATION-UPDATE":
        if (!this.init || this.updating) return
        this.updateFirstOnly()
        break
    }
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "READY":
        this.sendSocketNotification("MODULES", this.modulesName)
        break
      case "INITIALIZED":
        this.init=true
        this.sendNotification("EXT_HELLO", this.name)
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
      icon: "modules/EXT-Updates/resources/update.png"
    })
  },

  checkUpdate: function (updates) {
    updates.forEach((update) => {
      if (update.behind > 0) {
        // if we haven't seen info for this module
        if (this.moduleList[update.module] === undefined) {
          this.moduleList[update.module] = update
        }
        if (typeof this.notify[update.module] === "undefined") {
          this.notify[update.module] = true
        }
        if (this.notify[update.module]) {
          if (this.config.notification.useTelegramBot) {
            let TB = null
            let updateInfoKeyName = update.behind === 1 ? "UPDATE_INFO_SINGLE" : "UPDATE_INFO_MULTIPLE"
            if (update.module === "MagicMirror") {
              TB = this.translate("UPDATE_NOTIFICATION") + "\n"
            } else {
              TB = this.translate("UPDATE_NOTIFICATION_MODULE", { MODULE_NAME: update.module }) + "\n"
            }
            TB += this.translate(updateInfoKeyName, { COMMIT_COUNT: update.behind, BRANCH_NAME: update.current }) + "\n"
            this.sendAdmin(TB)
          }
          if (this.config.update.autoUpdate && !this.updating) {
            if (update.module == "MagicMirror" || !this.canBeUpdated(update.module)) {
              this.updating = false
            }
            else {
              this.updateProcess(update.module)
              this.updating = true
            }
          }
          this.notify[update.module] = false
        }
      } else if (update.behind === 0) {
        // if the module WAS in the list, but shouldn't be
        if (this.notify[update.module] !== undefined) {
          delete this.notify[update.module]
        }
        if (this.moduleList[update.module] !== undefined) {
          delete this.moduleList[update.module]
        }
      }
    })
    if (Object.keys(this.moduleList).length) this.sendNotification("EXT_UPDATES-MODULE_UPDATE", this.moduleList)
  },

  // Override dom generator.
  getDom: function () {
    var wrapper = document.createElement("div")
    wrapper.style.display = 'none'
    return wrapper
  },

  getStyles: function() {
    return [ "font-awesome.css" ]
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
      command: "close",
      description: this.translate("HELP_STOP"),
      callback: "Close"
    })
    commander.add({
      command: "restart",
      description: this.translate("HELP_RESTART"),
      callback: "Restart"
    })
    commander.add({
      command: "UN",
      description: this.translate("HELP_UN"),
      callback: "UNCommands"
    })
  },

  /** TelegramBot Commands **/
  Close: function(command, handler) {
    handler.reply("TEXT", "Bye Bye!")
    this.sendSocketNotification("CLOSE")
  },

  Restart: function(command, handler) {
    handler.reply("TEXT", "Restarting MagicMirror...")
    setTimeout(() => {
      this.sendSocketNotification("RESTART")
    }, 1000)
  },

  UNCommands: function(command, handler) {
    var helping = this.translate("HELP_UN") + "\n/update\n/scan\n/close\n/restart\n"
    helping += this.translate("HELP_COMMAND")
    handler.reply("TEXT", helping + "\n")
  },

  Scan: function(command, handler) {
    if (!this.init) return handler.reply("TEXT", this.translate("INIT_INPROGRESS"))
    var found = 0
    for (let [name, value] of Object.entries(this.notify)) {
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
      for (let [name, value] of Object.entries(this.notify)) {
        if (this.updating) return
        if (name) {
          if ((this.npmList[name] && this.npmList[name].module == handler.args) || (this.moduleList[name] && this.moduleList[name].module == handler.args)) {
            if (this.canBeUpdated(handler.args)) {
              found = true
              this.updating = true
              handler.reply("TEXT", this.translate("UPDATING", { MODULE_NAME: handler.args}))
              return this.updateProcess(handler.args)
            } else {
              handler.reply("TEXT", this.translate("NOTAVAILABLE", { MODULE_NAME: handler.args}))
              return
            }
          }
        }
      }
      if (!found) {
        if (this.modulesName.indexOf(handler.args) > 0) {
          handler.reply("TEXT", this.translate("NOUPDATE_TB",  { MODULE_NAME: handler.args}))
        }
        else handler.reply("TEXT", this.translate("MODULENOTFOUND",  { MODULE_NAME: handler.args}))
      }
    } else {
      /** List of all update **/
      var updateTxt = ""
      for (let [name, value] of Object.entries(this.notify)) {
        if (name) {
          if (this.moduleList[name]) {
            if (this.moduleList[name].module === "MagicMirror") {
              updateTxt += "- *MagicMirror*: "
            } else {
              updateTxt += "- *" + this.moduleList[name].module + "*: "
            }
            var updateInfoKeyName = this.moduleList[name].behind === 1 ? "UPDATE_INFO_SINGLE" : "UPDATE_INFO_MULTIPLE"
            updateTxt += this.translate(updateInfoKeyName, { COMMIT_COUNT: this.moduleList[name].behind, BRANCH_NAME: this.moduleList[name].current }) + "\n"
          }
          if (this.npmList[name]) {
            updateTxt += "- *" + this.npmList[name].module + "*: " + this.npmList[name].library + " v" + this.npmList[name].installed + " --> v" +  this.npmList[name].latest + "\n"
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
    for (let [name, value] of Object.entries(this.notify)) {
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
    this.sendNotification("EXT_SCREEN-WAKEUP")
    this.sendSocketNotification("UPDATE", module)
  },

  updateFirstOnly: function() {
    if (!this.init || this.updating) return
    var modules= Object.keys(this.notify)
    modules.forEach(module => {
      if (this.canBeUpdated(module) && !this.updating) {
        if (this.npmList[module] || this.moduleList[module]) {
          this.updating = true
          console.log("[UN] Updating:", module)
          this.updateProcess(module)
        }
      }
      else console.log("[UN] Can't Update", module)
    })
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
  },

  canBeUpdated: function(module) {
    if (module.startsWith("EXT-") || module === "MMM-GoogleAssistant" || module === "Gateway") return true
    else return false
  }
});
