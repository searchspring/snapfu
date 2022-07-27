#!/usr/bin/env node
import { cli } from '../src/cli.js';
cli(process.argv);

// require = require('esm')(module /*, options*/);
// require('../src/cli').cli(process.argv);