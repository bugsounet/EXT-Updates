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
    updateInterval: 60 * 1000, // every 10 minutes
    refreshInterval: 24 * 60 * 60 * 1000, // one day
    ignoreModules: [],
    updateCommands: [
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
      useTelegramBot: false,
      useScreen: true
    },
    update: {
      autoUpdate: true,
      autoRestart: true,
      usePM2: true, // only coded true
      PM2Name: "0"
    }
  },

  suspended: false,
  moduleList: {},
  npmList: {},
  notiTB: {},

  start: function () {
    console.log("[UPDATE] Start MMM-UpdateNotification")
    this.config = configMerge({}, this.defaults, this.config)
    this.suspended = !this.config.notification.useScreen
    this.updating = false
    setInterval(() => {
      this.moduleList = {}
      this.npmList = {}
      this.updateDom(2)
    }, this.config.refreshInterval)
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === "DOM_OBJECTS_CREATED") {
      this.sendSocketNotification("CONFIG", this.config)
      this.sendSocketNotification("MODULES", Module.definitions)
    }
    if (notification === "NPM_UPDATE") {
      this.updateUI(payload)
    }
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "STATUS") {
      this.updateUI(payload)
    }
    if (notification === "UPDATED") {
      this.updating = false
      this.sendNotification("TELBOT_TELL_ADMIN", "Update done with success: " + payload)
    }
    if (notification === "ERROR_UPDATE") {
      this.updating = false
      this.sendNotification("TELBOT_TELL_ADMIN", "Update Error: " + payload)
    }
    if (notification === "SendResult") {
      this.updating = false
      this.sendNotification("TELBOT_TELL_ADMIN", payload)
    }
  },

  updateUI: function (payload) {
    if (payload) {
      if (payload.installed && payload.latest && payload.library) {
        this.npmList[payload.library + " [" + payload.module +"]"] = payload
        this.updateDom(2)
      }
      else if (payload.behind > 0) {
        // if we haven't seen info for this module
        if (this.moduleList[payload.module] === undefined) {
          // save it
          this.moduleList[payload.module] = payload
          this.updateDom(2)
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
          this.updateDom(2)
        }
      }
    }
  },

  diffLink: function (module, text) {
    var localRef = module.hash
    var remoteRef = module.tracking.replace(/.*\//, "")
    return '<a href="https://github.com/MichMich/MagicMirror/compare/' + localRef + "..." + remoteRef + '" ' + 'class="xsmall dimmed" ' + 'style="text-decoration: none;" ' + 'target="_blank" >' + text + "</a>"
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

        //var updateInfoKeyName = m.behind === 1 ? "UPDATE_INFO_SINGLE" : "UPDATE_INFO_MULTIPLE"
        var subtextHtml = this.translate(updateInfoKeyName, {
          COMMIT_COUNT: m.behind,
          BRANCH_NAME: m.current
        })

        var text = document.createElement("span")
        if (m.module === "default") {
          text.innerHTML = this.translate("UPDATE_NOTIFICATION")
          subtextHtml = this.diffLink(m, subtextHtml)
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
          if (m.module === "default") {
            TB = this.translate("UPDATE_NOTIFICATION")
          } else {
            TB = this.translate("UPDATE_NOTIFICATION_MODULE", { MODULE_NAME: m.module }) + "\n"
          }
          TB += this.translate(updateInfoKeyName, { COMMIT_COUNT: m.behind, BRANCH_NAME: m.current }) + "\n"
          console.log("[UPDATE] ", TB)
          this.sendNotification("TELBOT_TELL_ADMIN", TB)
        }
        if (this.config.update.autoUpdate && !this.updating) {
          this.updateProcess(m.module)
          this.updating = true
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
          console.log("[UPDATE] ", TB)
        }
        if (this.config.update.autoUpdate && !this.updating) {
          this.updateProcess(mpm.module)
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
      description: "update command manager",
      callback: "Update"
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

  /** TelegramBot Commands **/

  Update: function(command, handler) {
    if (this.updating) handler.reply("TEXT", "Please wait update in progress !")
    if (handler.args) {
      var found = false
      /** update process **/
      for (let [name, value] of Object.entries(this.notiTB)) {
        if (this.updating) return
        if (name) {
          if ((this.npmList[name] && this.npmList[name].module == handler.args) || (this.moduleList[name] && this.moduleList[name].module == handler.args)) {
            found = true
            this.updating = true
            handler.reply("TEXT", "Updating: " + handler.args)
            return this.updateProcess(handler.args)
          }
        }
      }
      if (!found) handler.reply("TEXT", "Module not found:" + handler.args)
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
            if (this.moduleList[name].module === "default") {
              updateTxt += "- *MagicMirror²*: "
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

  updateProcess(module) {
    this.sendSocketNotification("UPDATE", module)
  }
});
