import arg from 'arg'
import inquirer from 'inquirer'
import { login } from './login'
import init from './init'

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
        {
            '--dev': Boolean,
        },
        {
            argv: rawArgs.slice(2),
        }
    )
    return {
        dev: args['--dev'] || false,
        command: args._[0],
    }
}

export async function cli(args) {
    let options = parseArgumentsIntoOptions(args)
    if (!options.command || options.command === 'help') {
        displayHelp()
        return
    }
    debug(options, options)
    if (options.command === 'login') {
        login(options)
    }
    if (options.command === 'init') {
        init(options)
    }
}
function debug(options, message) {
    if (options.dev) {
        console.log(message)
    }
}

// loadCreds()

function displayHelp() {
    console.log(`usage: snapfu <command>
    
These are the snapfu commnads used in various situations

    login    Oauths with github
    init     Creates a new snap project`)
}
