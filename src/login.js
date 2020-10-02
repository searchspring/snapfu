const { escape } = require('querystring')
const open = require('open')
const http = require('http')
const { parse } = require('url')
const { exit } = require('process')
const fsp = require('fs').promises
const fs = require('fs')
const chalk = require('chalk')
const os = require('os')

exports.login = async (options, opener, port) => {
    let uri = exports.github.createOauthUrl({ isDev: options.dev })
    let receivedUrl = exports.auth.listenForCallback(port | 3827)
    if (!opener) {
        open(uri, { wait: true })
    } else {
        opener(uri)
    }
    await receivedUrl.then(async (val) => {
        try {
            let creds = await exports.auth.saveCredsFromUrl(val)
            console.log(`Authenticated ${chalk.green(creds.login)}`)
            exit(0)
        } catch (err) {
            console.log(err)
            exit(1)
        }
    })
}

exports.orgAccess = async (options, opener) => {
    let uri = exports.github.createOrgAccessUrl({ isDev: options.dev })
    if (!opener) {
        open(uri)
    } else {
        opener(uri)
    }
}
exports.whoami = async (options) => {
    return exports.auth.loadCreds()
}

exports.github = {
    scopes: 'user:email,repo',
    createOauthUrl: (config) => {
        let clientId = config.isDev
            ? 'e02c8965ff92aa84b6ee'
            : '5df635731e7fa3513c1d'
        let redirectUrl = config.isDev
            ? 'http://localhost:3000'
            : 'https://token.kube.searchspring.io'
        return `https://github.com/login/oauth/authorize?response_type=token&scope=${escape(
            exports.github.scopes
        )}&client_id=${clientId}&redirect_uri=${escape(redirectUrl)}`
    },
    createOrgAccessUrl: (config) => {
        let clientId = config.isDev
            ? 'e02c8965ff92aa84b6ee'
            : '5df635731e7fa3513c1d'
        return `https://github.com/settings/connections/applications/${clientId}`
    },
}

exports.auth = {
    home: () => {
        return os.homedir()
    },
    saveCredsFromUrl: async (url, location) => {
        let dir = exports.auth.home() + '/.searchspring'
        if (location) {
            dir = location
        }
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir)
        }
        const query = parse(url, true).query
        if (query && query.user) {
            try {
                let user = JSON.parse(query.user)
                await fsp.writeFile(dir + '/creds.json', query.user)
                return user
            } catch (e) {
                console.log(chalk.red(e.message, query.user))
            }
        }
    },
    loadCreds: async () => {
        return new Promise((resolve, reject) => {
            let credsLocation =
                exports.auth.home() + '/.searchspring/creds.json'
            if (!fs.existsSync(credsLocation)) {
                reject('creds not found')
            }
            let creds = fs.readFileSync(credsLocation, 'utf8')
            if (!creds) {
                reject('creds not found')
            }
            let user = JSON.parse(creds)
            resolve(user.login)
        })
    },
    listenForCallback: (port) => {
        return new Promise((resolutionFunc, rejectionFunc) => {
            let server = http.createServer(function (req, res) {
                let url = req.url
                res.end(
                    `<html><body>You may close this window now.<script>javascript:window.close('','_parent','')</script></body></html>`
                )
                server.close()
                resolutionFunc(url)
            })
            ;(async function () {
                server.listen(port)
            })()
        })
    },
}
