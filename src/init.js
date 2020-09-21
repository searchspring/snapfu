const os = require('os')
const { readdirSync, readFileSync, existsSync } = require('fs')
const { exit, cwd } = require('process')
const fs = require('fs').promises
const path = require('path')
const chalk = require('chalk')
const { Octokit } = require('@octokit/rest')
const inquirer = require('inquirer')
const clone = require('git-clone')
var ncp = require('ncp').ncp

exports.createDir = dir => {
    return new Promise((resolutionFunc, rejectionFunc) => {
        let folderName = dir.substring(dir.lastIndexOf('/') + 1)
        let files = readdirSync(dir)
        if (files.length !== 0) {
            rejectionFunc('folder not empty, exiting')
        }
        resolutionFunc(folderName)
    })
}
exports.init = async config => {

    try {
        let dir = cwd()
        let folderName = await exports.createDir(dir)
        let credsLocation = os.homedir() + '/.searchspring/creds.json'
        if (!existsSync(credsLocation)) {
            console.log(chalk.red(`no creds file found, please use snapfu login`))
            exit(1)
        }
        let creds = readFileSync(credsLocation, 'utf8')
        if (!creds) {
            console.log(chalk.red(`no creds file found, please use snapfu login`))
            exit(1)
        }
        let user = JSON.parse(creds)
        let octokit = new Octokit({
            auth: user.token,
        })
        let orgs = await octokit.orgs
            .listForAuthenticatedUser()
            .then(({ data }) => {
                return data.map((org) => {
                    return org.login
                })
            })
        let questions = [
            {
                type: 'input',
                name: 'name',
                validate: (input) => {
                    return input && input.length > 0
                },
                message: 'Please choose the name of this repository',
                default: folderName,
            },
            {
                type: 'list',
                name: 'framework',
                message: "Please choose the framework you'd like to use",
                choices: ['preact'],
                default: 'preact',
            },
            {
                type: 'list',
                name: 'organization',
                message:
                    'Please choose which github organization to create this repository in',
                choices: orgs,
                default: 'searchspring',
            },
            {
                type: 'list',
                name: 'color',
                message: 'Please choose a color scheme',
                choices: ['simple'],
                default: 'simple',
            },
        ]
        const answers = await inquirer.prompt(questions)
        if (config.dev) {
            console.log(
                chalk.blueBright('dev mode skipping new repo creation')
            )
        } else {
            await octokit.repos.createInOrg({
                org: answers.organization,
                name: answers.name,
                private: true,
            }).catch((exception) => {
                if (!exception.message.includes('already exists')) {
                    console.log(chalk.red(exception.message))
                    exit(1)
                } else {
                    console.log(chalk.yellow('repository already exists, continuing...'))
                }
            })
        }

        let repoUrl = `https://github.com/${answers.organization}/${answers.name}`
        if (!config.dev) {
            await exports.cloneAndCopyRepo(repoUrl, false)
            console.log(`repository: ${chalk.blue(repoUrl)}`)
        }
        let templateUrl = `https://github.com/searchspring/snapfu-template-${answers.framework}`
        await exports.cloneAndCopyRepo(templateUrl, true)
        console.log(`template initialized from: snapfu-template-${answers.framework}`)
    } catch (exception) {
        console.log(chalk.red(exception))
        exit(1)
    }
}

exports.cloneAndCopyRepo = async function (sourceRepo, excludeGit) {
    let folder = await fs
        .mkdtemp(path.join(os.tmpdir(), 'snapfu-temp'))
        .then(async (folder, err) => {
            if (err) throw err
            return folder
        })
    await clonePromise(sourceRepo, folder)
    let options = { clobber: false }
    if (excludeGit) {
        options.filter = (name) => {
            return !name.endsWith('/.git')
        }
    }
    await copyPromise(folder, '.', options)
}

function clonePromise(repoUrl, destination) {
    return new Promise(async (resolutionFunc, rejectionFunc) => {
        clone(repoUrl, destination, (err) => {
            if (err) {
                rejectionFunc(err)
            }
            resolutionFunc()
        })
    })
}

function copyPromise(source, destination, options) {
    return new Promise(async (resolutionFunc, rejectionFunc) => {
        // ncp can be used to modify the files while copying - see https://www.npmjs.com/package/ncp
        ncp(source, destination, options, function (err) {
            if (err) {
                rejectionFunc(err)
            }
            resolutionFunc()
        })
    })
}
