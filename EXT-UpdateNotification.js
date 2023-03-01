/* Magic Mirror
 * Module: EXT-UpdateNotification
 * @bugsounet ©2022/02
 * MIT Licensed.
 */

Module.register("EXT-UpdateNotification", {
  defaults: {
    debug: false,
    updateInterval: 10 * 60 * 1000, // every 10 minutes
    startDelay: 60 * 1000, // delay before 1st scan
    ignoreModules: [],
    updateCommands: [],
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
      defaultCommand: "git reset --hard && git pull && npm install",
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
      {
        module: "MMM-Pronote",
        command: "npm run update"
      },
      {
        module: "MMM-Freebox",
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
        module: "EXT-Background",
        command: "npm run update"
      },
      {
        module: "EXT-Browser",
        command: "npm run update"
      },
      {
        module: "EXT-Deezer",
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
        module: "EXT-Led",
        command: "npm run update"
      },
      {
        module: "EXT-MusicPlayer",
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
        module: "EXT-RadioPlayer",
        command: "npm run update"
      },
      {
        module: "EXT-Setup",
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
        module: "EXT-Spotify",
        command: "npm run update"
      },
      {
        module: "EXT-SpotifyCanvasLyrics",
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
      },
      {
        module: "EXT-YouTubeVLC",
        command: "npm run update"
      }
    ]
    this.nbDefaultCommands= this.internalCommands.length
    console.warn("[UN] Wow! there is", this.nbDefaultCommands, "@bugsounet modules in database")
    this.nbPersonalCommands= this.config.updateCommands.length
    this.personalCommands= this.config.updateCommands
    // merge internal database to config
    this.config.updateCommands = configMerged([], this.internalCommands, this.config.updateCommands)
    this.suspended = !this.config.notification.useScreen
    this.init= false
    this.update = {}
    this.updating= false
    this.modulesName= []
    this.commandsError = []
    this.error = this.updateCommandsChk(this.personalCommands)
    this.modulesInfo( cb => console.log("[UN] Modules find:", this.modulesName.length))
    this.session= {}
  },

  updateCommandsChk: function(str) {
    this.commandsError = []
    error = 0
    modules =[]
    nb = 1
    str.forEach(x => {
      var err = {}
      if (!x.module && !x.command) {
        error +=1
        err = {
          type: "unknow",
          module: "unknow",
          place: nb
        }
        this.commandsError.push(err)
      }
      if (!x.module && x.command) {
        error += 1
        err = {
          type: "module",
          module: "unknow",
          place: nb
        }
        this.commandsError.push(err)
      }
      if (!x.command && x.module) {
        error += 1
        err = {
          type: "command",
          module: x.module,
          place: nb
        }
        this.commandsError.push(err)
      }
      if (x.module && this.internalCommands.find(module => module.module === x.module)) {
        error += 1
        err = {
          type: "double",
          module: x.module,
          place: nb
        }
        this.commandsError.push(err)
      }
      else if (x.module) modules.push(x.module)
      nb += 1
    })
    if (error) console.log("[UN] " + error + " errors in updateCommands !!!",  this.commandsError)
    return error
  },

  notificationReceived: function (notification, payload, sender) {
    switch (notification) {
      case "DOM_OBJECTS_CREATED":
        this.sendSocketNotification("CONFIG", this.config)
        /** wait a little time ... every one is loading ! it's just an RPI !!! **/
        if (this.error) {
          if (this.config.notification.useTelegramBot) this.sendAdmin(this.translate("TB_WELCOMEERROR", { ERROR: this.error }), true)
          else {
            this.sendAlert(this.translate("ALERT_WELCOMEERROR", { ERROR: this.error }), 5000, "error")
            this.updateCommands(null, null, null, true)
          }
        }
        else setTimeout(() => this.sendSocketNotification("MODULES", this.modulesName), this.config.startDelay)
        break
      case "GAv4_READY":
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
        if (!this.error) {
          this.init=true
          if (this.config.notification.sendReady) {
            if (this.config.notification.useTelegramBot) this.sendAdmin(this.translate("INITIALIZED", { VERSION: payload }))
            else this.sendAlert(this.translate("INITIALIZED", { VERSION: payload }), 5*1000, "information")
          }
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
        if (!this.error) this.updateUI(payload)
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
    // broadcast for Gateway v2
    this.sendNotification("EXT_UN-MODULE_UPDATE", this.moduleList)
    this.sendNotification("EXT_UN-NPM_UPDATE", this.npmList)
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
    commander.add({
      command: "UNConfig",
      description: this.translate("HELP_CONFIG"),
      callback: "UNConfig"
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

  updateCommands: function(command, handler, moduleClass, style = false) {
    var text = this.translate("DEFAULTCONFIG")
    var nb, err

    /** display default updateCommands **/
    this.internalCommands.forEach(update => {
      text += "*"+ update.module + ":* `" + update.command + "`\n"
    })

    if (this.nbPersonalCommands) {
      nb = 1
      text += this.translate("PERSONALCONFIG")
      this.personalCommands.forEach(update => {
        err = 0
        if (!this.error) {
          text += "*"+ nb +". " + update.module + ":* `" + update.command + "` ✅\n"
        }
        else {
          this.commandsError.forEach(error => {
            if (error.place === nb) {
              text += "*"+error.place+". " + update.module + ":* `" + update.command + "` 🚫\n"
              err = 1
            }
          })
          if (!err) {
            text += "*"+ nb +". " + update.module + ":* `" + update.command + "` ✅\n"
          }
        }
        nb += 1
      })

      if (this.error) {
        text += this.translate("ERRORCONFIG")
        this.commandsError.forEach(error => {
          if (error.type == "unknow") text+= "*"+error.place+ "*: " + this.translate("UNKNOWCONFIG") + "\n"
          if (error.type == "double") text+= "*"+error.place+ "*: " + this.translate("DOUBLECONFIG", { MODULE_NAME: this.ExtraChars(error.module)}) + "\n"
          if (error.type == "command") text += "*"+error.place+"*: " + this.translate("COMMANDCONFIG", { MODULE_NAME: this.ExtraChars(error.module)}) + "\n"
          if (error.type == "module") text += "*"+error.place+"*: " + this.translate("MODULECONFIG") + "\n"
        })
        text += this.translate("ERRORCONFIGNOTACTIVATED")
      }
    }
    if (!style) handler.reply("TEXT", text + "\n", {parse_mode:'Markdown'})
    else this.sendSocketNotification("DISPLAY_ERROR", text)
  },

  UNCommands: function(command, handler) {
    var helping = this.translate("HELP_UN") + "\n/update\n/scan\n/stopMM\n/restartMM\n/updateCommands\n/UNConfig\n"
    helping += this.translate("HELP_COMMAND")
    handler.reply("TEXT", helping + "\n")
  },

  UNConfig: function(command, handler) {
    /** show the config like in config.js file with ALL value **/
    var text = "{\n"
    text += "  module: \"EXT-UpdateNotification\",\n",
    text += "  position: \"" + this.data.position + "\",\n"
    text += "  config: {\n"
    text += "    debug: " + this.config.debug + ",\n"
    text += "    updateInterval: " + this.config.updateInterval + ",\n"
    text += "    startDelay: " + this.config.startDelay + "\n"
    text += "    ignoreModules: ["
    if (this.config.ignoreModules.length > 0) {
      text += " "
      this.config.ignoreModules.forEach((moduleName,nb) => {
        text += "\"" + moduleName
        if (nb != this.config.ignoreModules.length-1) text += "\", "
        else text += "\" "
      })
      text += "],\n"
    }
    else text += " ],\n"

    /** display updateCommands : [] **/
    /** use this.data.config.updateCommands for fetch real config in config.js **/
    /** method @bugsounet **/
    /** maybe not the best method... **/
    /** if someone can do better make PR :)) **/
    /** because i'm not so strong with regex ! **/
    text += "    updateCommands: ["
    if (this.data.config && this.data.config.updateCommands) {
      text += "\n"
      this.data.config.updateCommands.forEach((data,nb) => { // loop on each array value, nb is the number of the value
        text += "      {\n" // add spaces and open {
        /** prepare formating **/
        var field = JSON.stringify(data) // stringify array values
        field = field.replace(new RegExp(":", "g"), ": ") // add space between 2 values
        field = field.replace("{","") // delete {
        field = field.replace("}","") // delete }
        field = field.replace(",",",\n        ") // to go the line (separate value) and add spaces
        /** prepare done ! **/
        text += "        " + field + "\n" // add spaces and send result :)
        if (nb != this.data.config.updateCommands.length-1) text += "      },\n" // it's not the last array value so it's `},`
        else text += "      }\n" // it's the last array value so just close `}`
      })
      text += "    ],\n"
    }
    else text += " ],\n"
    /** updateCommands process done **/

    text += "    notification: {\n"
    text += "      useTelegramBot: " + this.config.notification.useTelegramBot + ",\n"
    text += "      sendReady: " + this.config.notification.sendReady + ",\n"
    text += "      useScreen: " + this.config.notification.useScreen + ",\n"
    text += "      useCallback: " + this.config.notification.useCallback + "\n"
    text += "    },\n"
    text += "    update: {\n"
    text += "      autoUpdate: "+ this.config.update.autoUpdate + ",\n"
    text += "      autoRestart: "+ this.config.update.autoRestart + ",\n"
    text += "      usePM2: "+ this.config.update.usePM2 + ",\n"
    text += "      PM2Name: \"" + this.config.update.PM2Name + "\",\n"
    text += "      defaultCommand: \"" +this.config.update.defaultCommand + "\",\n"
    text += "      logToConsole: " + this.config.update.logToConsole + "\n"
    text += "      timeout: " + this.config.update.timeout + "\n"
    text += "    }\n  }\n},"
    handler.reply("TEXT", text + "\n")
    if (this.error) this.updateCommands(command, handler)
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
    if (this.error) return
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
