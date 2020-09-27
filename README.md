# Snapfu

![build](https://github.com/searchspring/snapfu/workflows/build/badge.svg?branch=master) **snap·fu** - _the way of snap_

The scaffolding command line tool for the Snap SKD. This tool creates a new Searchspring website from one of our existing templates and bootstraps a development environment and by default, deploys to an AWS S3 bucket behind a Cloudfront distribution.

## Installation

```bash
npm install -g snapfu
```

## Usage

Login to access your github organizations - the following command will open a browser window
to give snapfu access to your github organizations.

```bash
snapfu login
```

Create your website with the init command. Init will gather some information about the kind
of Snap SDK template you wish to use. You will need your siteId from the SMC before you run this command.

```bash
mkdir my-awesome-website
cd my-awesome-website
snapfu init
```

## Deployment

This tool integrates with the Searchspring build and deploy process. In order to take advantage of this you must select searchspring-implementations as the organization you deploy into.

The tool uses Github actions to create a distribution files that are deployed to our AWS S3 backed CDN (Cloudfront).

When you commit to master, the github action will deploy all the files that build into `./dist` to a publicly readable S3 bucket which can be accessed at the following URL:

```
https://b7i-customer-cdn.s3.amazonaws.com/<siteId>/master/index.html
```

Similarly, if you push a branch to github called `my-branch` that will be available at

```
https://b7i-customer-cdn.s3.amazonaws.com/<siteId>/my-branch/index.html
```

## Other example deployments.

You can modify the file `deploy.yml` in your generated project under `my-awesome-website/.github/workflows/deploy.yml`
to complete different actions.

### SCP

Deploy the built artifacts using `scp`. [https://github.com/marketplace/actions/scp-command-to-transfer-files](https://github.com/marketplace/actions/scp-command-to-transfer-files)

### Google Cloud

Deploy to GCP using `gcloud`. [https://github.com/marketplace/actions/setup-gcloud-environment](https://github.com/marketplace/actions/setup-gcloud-environment)

### SFTP

Deploy a built artifacts through SFTP. [https://github.com/marketplace/actions/sftp-deploy](https://github.com/marketplace/actions/sftp-deploy)
