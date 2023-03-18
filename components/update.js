var log = (...args) => { /* do nothing */ }

class Update {
  constructor(that) {
    this.lib= that.lib
    this.config= that.config
    this.restart = that.tools.restart
    this.sendSocketNotification = (...args) => that.sendSocketNotification(...args)
    if (that.config.debug) log = (...args) => { console.log("[UN] [UPDATE]", ...args) }
  }

  process(module) {
    let Command = null
    var Path = this.lib.path.normalize(__dirname + "/../../")
    var modulePath = Path + module

    if (module.startsWith("EXT-") || module === "MMM-GoogleAssistant") Command = "npm run update"

    if (!Command) return console.warn(`[UN] Update of ${module} is not supported.`)
    console.log(`[UN] [UPDATE] Updating ${module}...`)
    //console.log("Command:", Command)
    //console.log("cwd:", modulePath)
    //console.log("timeout:", this.config.update.timeout)
    //return
    this.lib.childProcess.exec(Command, {cwd : modulePath, timeout: this.config.update.timeout } , (error, stdout, stderr) => {
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
          setTimeout(() => this.restart(), 3000)
        } else {
          log("Process update done, don't forget to restart MagicMirror!")
          this.sendSocketNotification("NEEDRESTART")
        }
      }
    })
  }

  /** remove ExtraChars for telegramBot markdown **/
  ExtraChars(str) {
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

  /** remove only color **/
  StripColor(str) {
    str = str.replace(/\[(\[H\033\[2J|\d+;\d+H|\d+(;\d+;\d+(;\d+;\d+)?m|[m])|1K)|\[m/g, '')
    return str
  }
}

module.exports = Update;
