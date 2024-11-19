var log = () => { /* do nothing */ };

const childProcess = require("child_process");

class Update {
  constructor (config, Tools) {
    this.config = config;
    this.root_path = this.config.root_path;
    this.sendSocketNotification = (...args) => Tools.sendSocketNotification(...args);
    if (this.config.debug) log = (...args) => { console.log("[UPDATES] [UPDATE]", ...args); };
  }

  process (module) {
    let Command = null;
    var Path = `${this.root_path}/modules/`;
    var modulePath = Path + module;

    if (module.startsWith("EXT-") || module === "MMM-GoogleAssistant") Command = "npm run update";

    if (!Command) return console.warn(`[UPDATES] Update of ${module} is not supported.`);
    console.log(`[UPDATES] [UPDATE] Updating ${module}...`);

    childProcess.exec(Command, { cwd: modulePath, timeout: this.config.timeout }, (error, stdout) => {
      var res = {};
      var final = "";
      if (error) {
        console.error(`[UPDATES] exec error: ${error}`);

        res = { results: error.toString().split("\n") };
        final = `Update logs of ${module}:\n\n`;
        res.results.forEach((value) => {
          if (value) final += `${this.ExtraChars(this.StripColor(value))}\n`;
        });
        final += `\n${this.ExtraChars("[UPDATES] Update error!")}\n`;
        this.sendSocketNotification("SendResult", final);

        this.sendSocketNotification("ERROR_UPDATE", module);
      } else {
        console.log(`[UPDATES] Update logs of ${module}: ${stdout}`);

        /** trying to parse stdout to Telegram without errors ... it's horrible ! **/
        res = { results: stdout.split("\n") };
        final = `Update logs of ${module}:\n\n`;
        res.results.forEach((value) => {
          if (value) final += `${this.ExtraChars(this.StripColor(value))}\n`;
        });
        final += `\n${this.ExtraChars("[UPDATES] Process update done")}\n`;
        this.sendSocketNotification("SendResult", final);

        this.sendSocketNotification("UPDATED", module);
        if (this.config.autoRestart) {
          log("Process update done");
          setTimeout(() => this.sendSocketNotification("RESTART"), 3000);
        } else {
          log("Process update done, don't forget to restart MagicMirror!");
          this.sendSocketNotification("NEEDRESTART");
        }
      }
    });
  }

  /** remove ExtraChars for telegramBot markdown **/
  ExtraChars (str) {
    let result = str;
    result = result.replace(/[\s]{2,}/g, " "); // delete space doubles, and more
    result = result.replace(/^[\s]/, ""); // delete space on the begin
    result = result.replace(/[\s]$/, ""); // delete space on the end
    result = result.replace("|", ":"); // simple replace | to : for more visibility
    /** special markdown for Telegram **/
    result = result.replace(new RegExp("_", "g"), "\\_"); //
    result = result.replace(new RegExp("\\*", "g"), "\\*");
    result = result.replace(new RegExp("\\[", "g"), "\\[");
    result = result.replace(new RegExp("`", "g"), "\\`");
    return result;
  }

  /** remove only color **/
  StripColor (str) {
    let result = str;
    result = result.replace(/\[(\[H\033\[2J|\d+;\d+H|\d+(;\d+;\d+(;\d+;\d+)?m|[m])|1K)|\[m/g, "");
    return result;
  }
}

module.exports = Update;
