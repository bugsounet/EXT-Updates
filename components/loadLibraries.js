/** Load sensible library without black screen **/
var log = (...args) => { /* do nothing */ }

function libraries(that) {
  if (that.config.debug) log = (...args) => { console.log("[UN] [LIB]", ...args) }
  let libraries= [
    // { "library to load" : "store library name" }
    { "fs": "fs" },
    { "path": "path" },
    { "child_process": "childProcess" },
    { "pm2": "pm2" },
    { "util" : "util" },
    { "../../default/defaultmodules.js": "defaultModules" },
    { "../components/npmCheck.js": "npmCheck" },
    { "../components/gitCheck.js": "gitCheck" },
    { "../components/check.js": "check" },
    { "../components/update.js": "update" },
    { "../components/tools.js": "tools" }
  ]
  let errors = 0
  return new Promise(resolve => {
    libraries.forEach(library => {
      for (const [name, configValues] of Object.entries(library)) {
        let libraryToLoad = name
        let libraryName = configValues

        try {
          if (!that.lib[libraryName]) {
            that.lib[libraryName] = require(libraryToLoad)
            log("Loaded:", libraryToLoad, "->", "this.lib."+libraryName)
          }
        } catch (e) {
          console.error("[UN] [LIB]", libraryToLoad, "Loading error!" , e.toString(), e)
          that.sendSocketNotification("WARNING" , {library: libraryToLoad })
          errors++
          that.lib.error = errors
        }
      }
    })
    resolve(errors)
    if (!errors) console.log("[UN] [LIB] All libraries loaded!")
  })
}

exports.libraries = libraries
