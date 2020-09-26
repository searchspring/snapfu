# Snapfu

The scaffolding CLI for the Snap SKD. This tool creates a new Searchspring website from one of our existing templates and
bootstraps a development environment.

## Installation

```bash
npm install -g snapfu
```

## Usage

Login to access your github organizationsnope,

```bash
snapfu login
```

Create your website

```bash
mkdir my-awesome-website
cd my-awesome-website
snapfu init
```

## Deployment

This tool integrates with the Searchspring build and deploy process. In order to take advantage of this you must select
searchspring-implementations as the organization you deploy into.

The tool uses Github actions to create a distribution files that are deployed to our AWS S3 backed CDN (Cloudfront).

When you commit to master, the github action will deploy files to an S3 bucket.

## Other example deployments.

You can modify the file `deploy.yml` in your generated project under `my-awesome-website/.github/workflows/deploy.yml`
to complete different actions.

### SFTP

Deploy a built artifact through SFTP. [https://github.com/marketplace/actions/sftp-deploy](https://github.com/marketplace/actions/sftp-deploy)
