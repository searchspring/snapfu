import { escape } from 'querystring'
import open from 'open'
import http from 'http'
import { parse } from 'url'
import { exit } from 'process'
import { promises as fsp } from 'fs'
import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import os from 'os'

export const login = async (options, opener, port) => {
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

export const orgAccess = async (options, opener) => {
    let uri = github.createOrgAccessUrl({ isDev: options.dev })
    if (!opener) {
        open(uri)
    } else {
        opener(uri)
    }
}
export const whoami = async (options) => {
    return auth.loadCreds()
}

export const github = {
    scopes: 'user:email,repo',
    createOauthUrl: (config) => {
        let clientId = config.isDev
            ? 'e02c8965ff92aa84b6ee'
            : '5df635731e7fa3513c1d'
        let redirectUrl = config.isDev
            ? 'http://localhost:3000'
            : 'https://token.kube.searchspring.io'
        return `https://github.com/login/oauth/authorize?response_type=token&scope=${escape(
            github.scopes
        )}&client_id=${clientId}&redirect_uri=${escape(redirectUrl)}`
    },
    createOrgAccessUrl: (config) => {
        let clientId = config.isDev
            ? 'e02c8965ff92aa84b6ee'
            : '5df635731e7fa3513c1d'
        return `https://github.com/settings/connections/applications/${clientId}`
    },
}

export const auth = {
    home: () => {
        return os.homedir()
    },
    saveCredsFromUrl: async (url, location) => {
        let dir = path.join(auth.home(), '/.searchspring')
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
                await fsp.writeFile(path.join(dir, '/creds.json'), query.user)
                return user
            } catch (e) {
                console.log(chalk.red(e.message, query.user))
            }
        }
    },
    loadCreds: async () => {
        return new Promise((resolve, reject) => {
            let credsLocation = path.join(
                auth.home(),
                '/.searchspring/creds.json'
            )
            if (!fs.existsSync(credsLocation)) {
                reject('creds not found')
            }
            let creds = fs.readFileSync(credsLocation, 'utf8')
            if (!creds) {
                reject('creds not found')
            }
            let user = JSON.parse(creds)
            resolve({ login: user.login, name: user.name })
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
