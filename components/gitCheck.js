const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs");
const path = require("path");
var log = (...args) => { /* do nothing */ }

const BASE_DIR = path.normalize(`${__dirname}/../../../`);

class gitCheck {
	constructor(config) {
		this.gitRepos = [];
    if (config.debug) log = (...args) => { console.log("[UN] [GIT]", ...args) }
	}

	getRefRegex(branch) {
		return new RegExp(`s*([a-z,0-9]+[.][.][a-z,0-9]+)  ${branch}`, "g");
	}

	async execShell(command) {
		const { stdout = "", stderr = "" } = await exec(command);

		return { stdout, stderr };
	}

	async isGitRepo(moduleFolder) {
		const { stderr } = await this.execShell(`cd ${moduleFolder} && git remote -v`);

		if (stderr) {
			console.error(`Failed to fetch git data for ${moduleFolder}: ${stderr}`);

			return false;
		}

		return true;
	}

	async add(moduleName) {
		let moduleFolder = BASE_DIR;

		if (moduleName !== "MagicMirror") {
			moduleFolder = `${moduleFolder}modules/${moduleName}`;
		}

		try {
      if (moduleName == "MagicMirror") log("Checking git for main core")
			else log("Checking git for " + (moduleName.startsWith("EXT") ? "plugin:" : "module:") , moduleName);
			// Throws error if file doesn't exist
			fs.statSync(path.join(moduleFolder, ".git"));

			// Fetch the git or throw error if no remotes
			const isGitRepo = await this.isGitRepo(moduleFolder);

			if (isGitRepo) {
				// Folder has .git and has at least one git remote, watch this folder
				this.gitRepos.push({ module: moduleName, folder: moduleFolder });
			}
		} catch (err) {
			// Error when directory .git doesn't exist or doesn't have any remotes
			// This module is not managed with git, skip
		}
	}

	async getStatusInfo(repo) {
		let gitInfo = {
			module: repo.module,
			behind: 0, // commits behind
			current: "", // branch name
			tracking: "", // remote branch
		}

		const { stderr, stdout } = await this.execShell(`cd ${repo.folder} && git status -sb`)

		if (stderr) {
			console.error(`[UN] [GIT] Failed to get git status for ${repo.module}: ${stderr}`)
			// exit without git status info
			return
		}

		// only the first line of stdout is evaluated
		let status = stdout.split("\n")[0];
		// examples for status:
		// ## develop...origin/develop
		// ## master...origin/master [behind 8]
		// ## master...origin/master [ahead 8, behind 1]
		status = status.match(/## (.*)\.\.\.([^ ]*)(?: .*behind (\d+))?/)
		// examples for status:
		// [ '## develop...origin/develop', 'develop', 'origin/develop' ]
		// [ '## master...origin/master [behind 8]', 'master', 'origin/master', '8' ]
		// [ '## master...origin/master [ahead 8, behind 1]', 'master', 'origin/master', '1' ]
		gitInfo.current = status[1]
		gitInfo.tracking = status[2]

		if (status[3]) {
			// git fetch was already called before so `git status -sb` delivers already the behind number
			gitInfo.behind = parseInt(status[3])
		}

		return gitInfo
	}

	async getRepoInfo(repo) {
		const gitInfo = await this.getStatusInfo(repo)

		if (!gitInfo) {
			return
		}

		if (gitInfo.isBehindInStatus) {
			return gitInfo
		}

		const { stderr } = await this.execShell(`cd ${repo.folder} && git fetch --dry-run`)

		// example output:
		// From https://github.com/MichMich/MagicMirror
		//    e40ddd4..06389e3  develop    -> origin/develop
		// here the result is in stderr (this is a git default, don't ask why ...)
		const matches = stderr.match(this.getRefRegex(gitInfo.current))

		if (!matches || !matches[0]) {
			// no refs found, nothing to do
			return
		}

		// get behind with refs
		try {
			const { stdout } = await this.execShell(`cd ${repo.folder} && git rev-list --ancestry-path --count ${matches[0]}`)
			gitInfo.behind = parseInt(stdout);

			return gitInfo
		} catch (err) {
			console.error(`[UN] [GIT] Failed to get git revisions for ${repo.module}: ${err}`)
		}
	}

	async getRepos() {
		const gitResultList = []

		for (const repo of this.gitRepos) {
			try {
				const gitInfo = await this.getRepoInfo(repo);

				if (gitInfo) {
					gitResultList.push(gitInfo);
				}
			} catch (e) {
				console.error(`[UN] [GIT] Failed to retrieve repo info for ${repo.module}: ${e}`)
			}
		}

		return gitResultList
	}
}

module.exports = gitCheck;
