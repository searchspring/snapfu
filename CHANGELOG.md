# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 1.0.10 (2022-01-27)


### Bug Fixes

* **recs-command:** removing debug line and allowing dashes in sync ([#11](https://github.com/searchspring/snapfu/issues/11)) ([431dbfb](https://github.com/searchspring/snapfu/commit/431dbfb73a0429e01bd040b5e6e0cc9640005b85))


### Code Refactoring

* **init.js:** add a null check and fail out if no repos found ([825be15](https://github.com/searchspring/snapfu/commit/825be15b56d640c72c547c404cdadfd6b73ad6fa))
* **init.js:** paginate octokit repos list call to ensure we get every public repo in the future ([9fd9137](https://github.com/searchspring/snapfu/commit/9fd91377ad42e05fca6214dd991442f65b47686e))
* **recs.js:** refactor recs init questions order, check for template type in getTemplates ([4b184ec](https://github.com/searchspring/snapfu/commit/4b184ec51cd5ccfeeed60015f30c818b19a54c9d))
* **recs.js:** seperate out recs init answers so it always asks for type ([25e6a97](https://github.com/searchspring/snapfu/commit/25e6a97ab22116793df3e7cea44f92c183eeb08a))
* **snapfu:** cleaned up a bit, changed to use type rather than isEmail ([970b041](https://github.com/searchspring/snapfu/commit/970b0410ffb0d5dd787af39eb6988d47cafc239c))
