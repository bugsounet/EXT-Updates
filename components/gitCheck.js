var log = (...args) => { /* do nothing */ }

class gitCheck {
  constructor(config, lib) {
    this.gitRepos = []
    if (config.debug) log = (...args) => { console.log("[UN] [GIT]", ...args) }
    this.debug = config.debug
    this.lib = lib
  }

  isGitRepo(moduleFolder) {
    return new Promise(resolve => {
      var git = this.lib.SimpleGit(moduleFolder)
      git.getRemotes(true, (err, remotes) => {
        if (err) console.log(moduleFolder, "err:", err)
        if (remotes.length < 1 || remotes[0].name.length < 1) {
          // No valid remote for folder, skip
          return resolve(false)
        }
        // Folder has .git and has at least one git remote, watch this folder
        return resolve(git)
      })
    })
  }

  async add(moduleName) {
    let moduleFolder = this.lib.path.normalize(`${__dirname}/../../../`)

    if (moduleName !== "MagicMirror") moduleFolder = `${moduleFolder}modules/${moduleName}`

    try {
      if (moduleName == "MagicMirror") log("Found git for MagicMirror")
      else log("Found git for " + (moduleName.startsWith("EXT") ? "plugin:" : "module:") , moduleName)
      // Throws error if file doesn't exist
      this.lib.fs.statSync(this.lib.path.join(moduleFolder, ".git"))

      // Fetch the git or throw error if no remotes
      const isGitRepo = await this.isGitRepo(moduleFolder)
      if (isGitRepo) {
        // Folder has .git and has at least one git remote, watch this folder
        this.gitRepos.push({ module: moduleName, folder: moduleFolder, git: isGitRepo })
      }
    } catch (err) {
      console.error("Error:", err)
      // Error when directory .git doesn't exist or doesn't have any remotes
      // This module is not managed with git, skip
    }
  }

  async getStatusInfo(repo) {
    return new Promise(resolve => {
      repo.git
        .fetch(err => {
          if(err) {
            console.error("[UN] [GIT] Error:", repo.module, err)
            resolve()
          }
        })
        .status((err, data) => {
          //log("Scan:" , repo.module)
          if (err) {
            log("Scan Error: " + data.module, err)
            resolve()
          } else {
            /** send ONLY needed info **/
            var moduleGitInfo = {
              module: repo.module,
              behind: data.behind,
              current: data.current,
              tracking: data.tracking
            }
            if (!moduleGitInfo.current || !moduleGitInfo.tracking) {
              log("Scan Infos not complete:", repo.module)
              resolve()
            } else {
              //log("Scan Infos:", moduleGitInfo)
              resolve(moduleGitInfo)
            }
          }
        })
    })
  }

  async getRepos() {
    const gitResultList = []
    const npmResultList = []

    for (const repo of this.gitRepos) {
      log("Get git info for", repo.module)
      try {
        const gitInfo = await this.getStatusInfo(repo)
        if (gitInfo && gitInfo.behind) {
          gitResultList.push(gitInfo)
          log(repo.module, "git return:", gitInfo)
        } else {
          log(repo.module, "git return: No update")
        }

        if (repo.module == "MagicMirror") continue

        /** check npm now **/
        let npmCheck = new this.lib.npmCheck(
          {
            dirName: repo.folder,
            moduleName: repo.module,
            debug: this.debug
          }
        )
        let resultNPM = await npmCheck.check()
        if (resultNPM) npmResultList.push(resultNPM)
      } catch (e) {
        console.error(`[UN] [GIT] Failed to retrieve repo info for ${repo.module}: ${e}`)
      }
    }

    return { gitResultList, npmResultList }
  }
}

module.exports = gitCheck;
