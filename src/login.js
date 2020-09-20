const { escape } = require('querystring')
const open = require('open')
const http = require('http')
const { parse } = require('url')
const { exit } = require('process')
const fsp = require('fs').promises
const fs = require('fs')
const chalk = require('chalk')
const os = require('os')

export const login = async (options, opener, port) => {
    if (!options.dev) {
        console.log("must use --dev as everything else isn't implemented")
        exit(1)
    }
    let uri = github.createOauthUrl({ isDev: options.dev })
    let receivedUrl = auth.listenForCallback(port | 3827)
    if (!opener) {
        open(uri, { wait: true })
    } else {
        opener(uri)
    }
    await receivedUrl.then(async (val) => {
        try {
            let creds = await auth.saveCredsFromUrl(val)
            console.log(`Authenticated ${chalk.green(creds.login)}`)
            exit(0)
        } catch (err) {
            console.log(err)
            exit(1)
        }
    })
}

export const github = {
    scopes: 'user:email,repo',
    createOauthUrl: (config) => {
        let clientId = config.isDev ? 'e02c8965ff92aa84b6ee' : '5df635731e7fa3513c1d'
        let redirectUrl = config.isDev ? 'http://localhost:3000' : 'http://token.searchspring.com'
        return `https://github.com/login/oauth/authorize?response_type=token&scope=${escape(
            github.scopes
        )}&client_id=${clientId}&redirect_uri=${escape(redirectUrl)}`
    },
}

export const auth = {
    saveCredsFromUrl: async (url, location) => {
        let dir = os.homedir() + '/.searchspring'
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
    listenForCallback: (port) => {
        return new Promise((resolutionFunc, rejectionFunc) => {
            var server = http.createServer(function (req, res) {
                let url = req.url
                res.end(
                    `<html><body>You may close this window now.<script>javascript:window.close('','_parent','')</script></body></html>`
                )
                server.close()
                resolutionFunc(url)
            })
                ; (async function () {
                    server.listen(port)
                })()
        })
    },
}
