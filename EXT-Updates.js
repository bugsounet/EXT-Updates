/*
 * EXT-Updates
 */

Module.register("EXT-Updates", {
  requiresVersion: "2.25.0",
  defaults: {
    debug: false,
    autoUpdate: true,
    autoRestart: true,
    logToConsole: true,
    timeout: 2 * 60 * 1000,
    welcome: true
  },

  start () {
    this.init = false;
    this.updating = false;
    this.modulesName = [];
    this.moduleList = {};
    this.scanTimer = null;
  },

  notificationReceived (notification, payload, sender) {
    switch (notification) {
      case "UPDATES":
        this.checkUpdate(payload);
        break;
      case "DOM_OBJECTS_CREATED":
        this.modulesName = Object.keys(Module.definitions);
        break;
      case "GA_READY":
        if (sender.name === "MMM-GoogleAssistant") this.sendSocketNotification("CONFIG", this.config);
        break;
      case "EXT_UPDATES-UPDATE":
        if (!this.init || this.updating) return;
        this.updateFirstOnly();
        break;
    }
  },

  socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "READY":
        this.sendSocketNotification("MODULES", this.modulesName);
        break;
      case "INITIALIZED":
        this.init = true;
        this.sendNotification("EXT_HELLO", this.name);
        break;
      case "WELCOME":
        if (this.config.welcome) {
          this.sendAdmin(this.translate("TB_WELCOMEPID", { PID: payload.PID }));
          this.sendAlert(this.translate("ALERT_WELCOMEPID", { PID: payload.PID }), 5 * 1000, "information");
        }
        break;
      case "UPDATED":
        this.updating = false;
        this.sendAdmin(this.translate("UPDATE_DONE", { MODULE_NAME: payload }));
        this.sendAlert(this.translate("UPDATE_DONE", { MODULE_NAME: payload }), 5 * 1000, "success");
        break;
      case "RESTART":
        this.sendNotification("EXT_GATEWAY-Restart");
        break;
      case "NEEDRESTART":
        this.sendAdmin(this.translate("NEEDRESTART"));
        this.sendAlert(this.translate("NEEDRESTART"), 5 * 1000, "warning");
        this.sendNotification("SCAN_UPDATES");
        break;
      case "ERROR_UPDATE":
        this.sendAdmin(this.translate("TB_UPDATE_ERROR", { MODULE_NAME: payload }));
        this.sendAlert(this.translate("ALERT_UPDATE_ERROR", { MODULE_NAME: payload }), 5 * 1000, "error");
        break;
      case "SendResult":
        this.sendAdmin(payload, true);
        break;
    }
  },

  sendAdmin (text, parse) {
    if (parse) this.sendNotification("EXT_TELBOT-TELL_ADMIN", text, { parse_mode: "Markdown" });
    else this.sendNotification("EXT_TELBOT-TELL_ADMIN", text);
  },

  sendAlert (text, timer = 0, type) {
    this.sendNotification("GA_ALERT", {
      type: type,
      message: text,
      timer: timer,
      icon: "modules/EXT-Updates/resources/update.png"
    });
  },

  checkUpdate (updates) {
    if (!this.init) return console.warn("[UPDATES] Hey, i'm not ready... please wait!");
    clearTimeout(this.scanTimer);
    updates.forEach((update) => {
      if (update.behind > 0) {
        // if we haven't seen info for this module
        if (this.moduleList[update.module] === undefined) {
          this.moduleList[update.module] = update;
          this.moduleList[update.module].canBeUpdated = this.canBeUpdated(update.module);
          this.moduleList[update.module].notify = true;
        }
        if (this.moduleList[update.module].notify) {
          let TB = null;
          let updateInfoKeyName = update.behind === 1 ? "UPDATE_INFO_SINGLE" : "UPDATE_INFO_MULTIPLE";
          TB = `${this.translate("UPDATE_NOTIFICATION_MODULE", { MODULE_NAME: update.module })}\n`;
          TB += `${this.translate(updateInfoKeyName, { COMMIT_COUNT: update.behind, BRANCH_NAME: update.current })}\n`;
          this.sendAdmin(TB);

          if (this.config.autoUpdate && !this.updating) {
            if (!this.moduleList[update.module].canBeUpdated) {
              this.updating = false;
            } else {
              this.updateProcess(update.module);
              this.updating = true;
            }
          }

          this.moduleList[update.module].notify = false;
        }
      } else if (update.behind === 0) {
        // if the module WAS in the list, but shouldn't be
        if (this.moduleList[update.module] !== undefined) delete this.moduleList[update.module];
      }
    });
    if (Object.keys(this.moduleList).length) this.sendNotification("EXT_UPDATES-MODULE_UPDATE", this.moduleList);
  },

  // Override dom generator.
  getDom () {
    var wrapper = document.createElement("div");
    wrapper.style.display = "none";
    return wrapper;
  },

  getTranslations () {
    return {
      en: "translations/en.json",
      fr: "translations/fr.json",
      it: "translations/it.json",
      de: "translations/de.json",
      es: "translations/es.json",
      nl: "translations/nl.json",
      tr: "translations/tr.json"
    };
  },

  /** Update from Telegram **/
  EXT_TELBOTCommands (commander) {
    commander.add({
      command: "update",
      description: this.translate("HELP_UPDATE"),
      callback: "Update"
    });
    commander.add({
      command: "scan",
      description: this.translate("HELP_SCAN"),
      callback: "Scan"
    });
  },

  /** TelegramBot Commands **/
  Scan (command, handler) {
    if (!this.init) return handler.reply("TEXT", this.translate("INIT_INPROGRESS"));
    clearTimeout(this.scanTimer);
    handler.reply("TEXT", this.translate("UPDATE_SCAN"));
    this.sendNotification("EXT_SCREEN-FORCE_WAKEUP");
    this.sendNotification("SCAN_UPDATES");
    this.scanTimer = setTimeout(() => {
      handler.reply("TEXT", this.translate("NOUPDATE_TB"));
    }, 60000);
  },

  Update (command, handler) {
    if (!this.init) return handler.reply("TEXT", this.translate("INIT_INPROGRESS"));
    if (this.updating) return handler.reply("TEXT", this.translate("UPDATE_INPROGRESS"));
    if (handler.args) {
      var found = false;

      /** update process **/
      for (let [name] of Object.entries(this.moduleList)) {
        if (this.updating) return;
        if (name) {
          if (this.moduleList[name] && this.moduleList[name].module === handler.args) {
            if (this.moduleList[name].canBeUpdated) {
              found = true;
              this.updating = true;
              handler.reply("TEXT", this.translate("UPDATING", { MODULE_NAME: name }));
              return this.updateProcess(name);
            } else {
              handler.reply("TEXT", this.translate("NOTAVAILABLE", { MODULE_NAME: name }));
              return;
            }
          }
        }
      }
      if (!found) {
        if (this.modulesName.indexOf(handler.args) > 0) {
          handler.reply("TEXT", this.translate("NOUPDATE_TB", { MODULE_NAME: handler.args }));
        }
        else handler.reply("TEXT", this.translate("MODULENOTFOUND", { MODULE_NAME: handler.args }));
      }
    } else {

      /** List of all update **/
      var manualUpdateTxt = "";
      var autoUpdateTxt = "";
      var finalUpdateTxt = "";
      for (let [name] of Object.entries(this.moduleList)) {
        if (this.moduleList[name] && this.moduleList[name].canBeUpdated) {
          autoUpdateTxt += `- *${this.moduleList[name].module}*\n`;
        }
        if (this.moduleList[name] && !this.moduleList[name].canBeUpdated) {
          manualUpdateTxt += `- *${this.moduleList[name].module}*\n`;
        }
      }
      if (manualUpdateTxt) {
        finalUpdateTxt = `${this.translate("UPDATE_MANUAL") + manualUpdateTxt}\n`;
      }
      if (autoUpdateTxt) {
        autoUpdateTxt += `\n${this.translate("UPDATE_HELPTB")}`;
        finalUpdateTxt += this.translate("UPDATE_AUTO") + autoUpdateTxt;
      }
      if (finalUpdateTxt) handler.reply("TEXT", finalUpdateTxt, { parse_mode: "Markdown" });
      else handler.reply("TEXT", this.translate("NOUPDATE_TB"), { parse_mode: "Markdown" });
    }
  },

  updateProcess (module) {
    this.sendNotification("EXT_SCREEN-FORCE_WAKEUP");
    this.sendSocketNotification("UPDATE", module);
  },

  updateFirstOnly () {
    if (!this.init || this.updating) return;
    var modules = Object.keys(this.moduleList);
    modules.forEach((module) => {
      if (this.moduleList[module].canBeUpdated && !this.updating) {
        this.updating = true;
        console.log("[UPDATES] Updating:", module);
        this.updateProcess(module);
      }
      else console.log("[UPDATES] Can't Update", module);
    });
  },

  canBeUpdated (module) {
    if (module.startsWith("EXT-") || module === "MMM-GoogleAssistant") return true;
    else return false;
  }
});
