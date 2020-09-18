const os = require('os')
const { readdirSync, readFileSync, existsSync } = require('fs')
const { exit, cwd } = require('process')
const chalk = require('chalk')
const { Octokit } = require('@octokit/rest')
const inquirer = require('inquirer')
const clone = require('git-clone')

export default async function init(options) {
    let dir = cwd()
    let folderName = dir.substring(dir.lastIndexOf('/') + 1)
    let files = readdirSync(dir)
    if (files.length !== 0) {
        console.log(chalk.red(`folder not empty, exiting`))
        exit(1)
    }
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
    try {
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
                choices: ['light', 'simple', 'custom'],
                default: 'simple',
            },
            {
                type: 'input',
                name: 'hex',
                message:
                    'Please pass in a color scheme using: https://colorscheme.searchspring.com/v1',
                when: (answers) => {
                    return answers.color === 'custom'
                },
                validate: (input) => {
                    return input && input.length > 0
                },
            },
        ]
        const answers = await inquirer.prompt(questions)
        try {
            await octokit.repos.createInOrg({
                org: answers.organization,
                name: answers.name,
                private: true,
            })
        } catch (exception) {
            if (!exception.message.indexOf('already exists') === -1) {
                console.log(chalk.red(exception.message))
                exit(1)
            }
        }
        let repoUrl = `https://github.com/${answers.organization}/${answers.name}`
        clone(repoUrl, '.', () => {
            console.log(`repository: ${chalk.blue(repoUrl)}`)
        })
    } catch (exception) {
        console.log(exception)
        console.log(chalk.red(`creds file corrupt, please use snapfu login`))
        exit(1)
    }
}
