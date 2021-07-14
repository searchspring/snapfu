# Snapfu

**snap · fu** - _"the way of snap"_

![build](https://github.com/searchspring/snapfu/workflows/build/badge.svg?branch=master)

Snapfu is the scaffolding command line tool for the Snap SDK. This tool creates a new Searchspring website from one of our existing snap templates and bootstraps a development environment and, if you have access, deploys to an AWS S3 bucket behind a Cloudfront distribution.

## Installation

```bash
npm install -g snapfu
```

## Login

Login to access your Github organizations - the following command will open a browser window
to give snapfu access to your Github organizations and to be able to create repositories in subsequent steps.

```bash
snapfu login
```

## Init

Create your website with the init command. Init will gather some information about the kind
of Snap build template you wish to create. You will need your siteId from the SMC before you run this command. This command will,

-   download template files
-   create and initialize a repository in the Github organization you selected

```bash
snapfu init my-awesome-website
```

<img src="https://raw.githubusercontent.com/searchspring/snapfu/main/cli.png">

## Run it

Now you can run the project with your standard `npm` tooling.

```bash
npm install
npm run dev
```

See the `package.json` for other npm commands.

## Deployment

This tool integrates with the Searchspring build and deploy process. In order to take advantage of this you must select searchspring-implementations as your organizaiton during init.

The tool uses Github actions to copy files to our AWS S3 backed CDN (Cloudfront).

When you commit to the main branch (production), the github action will deploy all the files that build into `./dist` to a publicly readable S3 bucket which can be accessed at the following URLs:

```
http://snapui.searchspring.io/<siteId>/bundle.js
http://snapui.searchspring.io/<siteId>/production/bundle.js
```

Similarly, if you push a branch to github called `my-branch` that will be available at

```
http://snapui.searchspring.io/<siteId>/my-branch/bundle.js
```

## Deploying to other places

You can modify the file `deploy.yml` in your generated project under `my-awesome-website/.github/workflows/deploy.yml`
to complete different actions if you don't want to use the Searchspring build process or
don't have access to it.

### SCP

Deploy the built artifacts using `scp`. [https://github.com/marketplace/actions/scp-command-to-transfer-files](https://github.com/marketplace/actions/scp-command-to-transfer-files)

### Google Cloud

Deploy to GCP using `gcloud`. [https://github.com/marketplace/actions/setup-gcloud-environment](https://github.com/marketplace/actions/setup-gcloud-environment)

### SFTP

Deploy a built artifacts through SFTP. [https://github.com/marketplace/actions/sftp-deploy](https://github.com/marketplace/actions/sftp-deploy)
