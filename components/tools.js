class Tools {
  constructor(that) {
    this.lib= that.lib
    this.config= that.config
    this.sendSocketNotification = (...args) => that.sendSocketNotification(...args)
  }

  /** MagicMirror restart and stop **/
  restart() {
    if (this.config.update.usePM2) {
      this.lib.pm2.restart(this.config.update.PM2Name, (err, proc) => {
        if (err) {
          console.error("[UN] [TOOLS]" + err)
          if (this.config.notification.useTelegramBot) this.sendSocketNotification("SendResult", err.toString())
        }
      })
    }
    else this.doRestart()
  }

  doRestart() {
    console.log("[UN] [TOOLS] Restarting MagicMirror...")
    var MMdir = this.lib.path.normalize(__dirname + "/../../../")
    const out = this.config.update.logToConsole ? process.stdout : fs.openSync('./MagicMirror.log', 'a')
    const err = this.config.update.logToConsole ? process.stderr : fs.openSync('./MagicMirror.log', 'a')
    const subprocess = this.lib.childProcess.spawn("npm start", {cwd: MMdir, shell: true, detached: true , stdio: [ 'ignore', out, err ]})
    subprocess.unref()
    process.exit()
  }

  close() {
    console.log("[UN] [TOOLS] Closing MagicMirror...")
    if (!this.config.update.usePM2) process.abort()
    else {
      this.lib.pm2.stop(this.config.update.PM2Name, (err, proc) => {
        if (err) {
          console.error("[UN] [TOOLS]" + err)
          if (this.config.notification.useTelegramBot) this.sendSocketNotification("SendResult", err.toString())
        }
      })
    }
  }
}

module.exports = Tools;
