# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.9.5](https://github.com/searchspring/snapfu/compare/v1.9.4...v1.9.5) (2025-06-24)

### [1.9.4](https://github.com/searchspring/snapfu/compare/v1.9.3...v1.9.4) (2025-06-24)

### [1.9.3](https://github.com/searchspring/snapfu/compare/v1.9.2...v1.9.3) (2025-06-24)

### [1.9.2](https://github.com/searchspring/snapfu/compare/v1.9.1...v1.9.2) (2025-06-13)


### Bug Fixes

* fix custom patchApply logic ([e41a895](https://github.com/searchspring/snapfu/commit/e41a8957abf8c7289d40217763dc87b53e93847c))

### [1.9.1](https://github.com/searchspring/snapfu/compare/v1.9.0...v1.9.1) (2025-06-13)

## [1.9.0](https://github.com/searchspring/snapfu/compare/v1.8.0...v1.9.0) (2025-05-28)


### Features

* add support for custom patches ([e0a1080](https://github.com/searchspring/snapfu/commit/e0a108073e783f1ce081aeed75a0479f1b188ccf))


### Bug Fixes

* custom patches not being applied ([30516d5](https://github.com/searchspring/snapfu/commit/30516d5140e61e6738a8b573740fc0e21f49e574))
* remove cmp from custom patches ([06adb9f](https://github.com/searchspring/snapfu/commit/06adb9f67209652e75e8097b889bfc4d35a75ec9))

## [1.8.0](https://github.com/searchspring/snapfu/compare/v1.7.1...v1.8.0) (2024-10-18)


### Features

* add snap distribution to context object ([3885719](https://github.com/searchspring/snapfu/commit/38857198606939582b660635e196d63d9f8bdc50))


### Bug Fixes

* exit without error when no badge templates to sync ([2c9eace](https://github.com/searchspring/snapfu/commit/2c9eacebe1dd74fceb357a67c72b0878c85f42a4))

### [1.7.1](https://github.com/searchspring/snapfu/compare/v1.7.0...v1.7.1) (2024-07-05)

## [1.7.0](https://github.com/searchspring/snapfu/compare/v1.6.0...v1.7.0) (2024-06-26)


### Features

* **patch:** add find-replace to patch functions ([a51928c](https://github.com/searchspring/snapfu/commit/a51928c5b86541312d4057df1c40b67877f891e5))


### Bug Fixes

* **badges:** updating sync function to allow syncing of locations without the existence of templates ([627fce6](https://github.com/searchspring/snapfu/commit/627fce6dce6ff96d08691f62e659950b5aee65ce))

## [1.6.0](https://github.com/searchspring/snapfu/compare/v1.5.2...v1.6.0) (2024-05-16)


### Features

* **templates:** renaming all variables to include handleized one as 'class' ([f65b976](https://github.com/searchspring/snapfu/commit/f65b97627159b8f075c6dddba7dea12a8332196a))

### [1.5.2](https://github.com/searchspring/snapfu/compare/v1.5.1...v1.5.2) (2024-05-16)

### [1.5.1](https://github.com/searchspring/snapfu/compare/v1.5.0...v1.5.1) (2024-03-11)


### Bug Fixes

* **fetch:** bugfix for missing fetch on older versions of node ([997a593](https://github.com/searchspring/snapfu/commit/997a5935dbf758c3395ba80ba1fcec21bc250b2e))
* **recs-archive:** bugfix for recs archive requiring branches to exist locally ([76095ec](https://github.com/searchspring/snapfu/commit/76095ec23c76584d666c0f8e1a3fff996759fc76))

## [1.5.0](https://github.com/searchspring/snapfu/compare/v1.4.0...v1.5.0) (2024-03-07)


### Features

* **packages:** updating packes to eliminate vulnerabilites ([75851a1](https://github.com/searchspring/snapfu/commit/75851a16c6b9ce4615f0b525fb320db1f81bc7c8))


### Bug Fixes

* **recs/init:** got rename working ([ff6c0bc](https://github.com/searchspring/snapfu/commit/ff6c0bc4fb304b3ab65b15c2a963165c15d4b946))
* **recs/init:** modifying the order of questions and misc text ([2fc616b](https://github.com/searchspring/snapfu/commit/2fc616bcb44e3eb48f7f0a30ea0c40abf022688a))
* **recs/init:** removing clobber and adding logging ([0213ac5](https://github.com/searchspring/snapfu/commit/0213ac5d6000f90efeefc86fb79772526a5e06dd))
* **secret:** moving to libsodium.js and fetch ([e852d5a](https://github.com/searchspring/snapfu/commit/e852d5a3c40e7ddbbc11686a05d3f32ec8cd876f))

## [1.4.0](https://github.com/searchspring/snapfu/compare/v1.3.3...v1.4.0) (2024-01-04)


### Features

* **patch:** adding `move` change to `edit-json` action for renaming ([fb1e517](https://github.com/searchspring/snapfu/commit/fb1e51777ec6994398afd88621396401c9a0a1f0))

### [1.3.3](https://github.com/searchspring/snapfu/compare/v1.3.2...v1.3.3) (2023-11-13)


### Bug Fixes

* **context:** change to how the organization and name of the repository is extracted for the context ([9b0af9c](https://github.com/searchspring/snapfu/commit/9b0af9c1bdc5d57c300578e88f3f1717b1458a1f))

### [1.3.2](https://github.com/searchspring/snapfu/compare/v1.3.1...v1.3.2) (2023-09-06)


### Bug Fixes

* **init:** fixing issue with repository name / owner / repoName ([27bb736](https://github.com/searchspring/snapfu/commit/27bb736d3e2d04dca6759a0da9c37d29d34f1ec0))

### [1.3.1](https://github.com/searchspring/snapfu/compare/v1.3.0...v1.3.1) (2023-09-05)


### Bug Fixes

* **init:** renaming snapfu.yml template config to snapfu.config.yml and excluding it from copy ([7ce3118](https://github.com/searchspring/snapfu/commit/7ce31183c8d4692fa701c994ae42ab7a2c5a761b))


### Docs

* **init:** fixing comment ([0a59efb](https://github.com/searchspring/snapfu/commit/0a59efb441f36f9cb09fd4aba35925e8ca2e1138))

## [1.3.0](https://github.com/searchspring/snapfu/compare/v1.2.1...v1.3.0) (2023-09-01)


### Features

* **init:** adding ability to use private template repositories for initialization ([0e615a8](https://github.com/searchspring/snapfu/commit/0e615a862af37eb415fd1cbb8f622cd264f47732))

### [1.2.1](https://github.com/searchspring/snapfu/compare/v1.2.0...v1.2.1) (2023-08-09)


### Bug Fixes

* **recs/sync:** making the sync command exit with error when encountering problems ([ea13cbc](https://github.com/searchspring/snapfu/commit/ea13cbce1575e2536163043c9d8502591ede9e21))

## [1.2.0](https://github.com/searchspring/snapfu/compare/v1.1.0...v1.2.0) (2023-02-23)


### Features

* **init:** adding tag protection to init step ([b3fc452](https://github.com/searchspring/snapfu/commit/b3fc4524a2b03c271cd00ed9c2a2e9b4897a49da))

## [1.1.0](https://github.com/searchspring/snapfu/compare/v1.0.29...v1.1.0) (2023-01-19)


### Features

* **publish:** attempting to fix the versioning issue with releases ([5e2190f](https://github.com/searchspring/snapfu/commit/5e2190fb99f898823264b5674d23f8886cbe29e1))

### 1.0.29 (2023-01-19)

### 1.0.28 (2022-12-08)

### 1.0.27 (2022-10-21)

### 1.0.26 (2022-08-19)

### 1.0.25 (2022-08-04)

### 1.0.24 (2022-07-20)

### 1.0.23 (2022-07-20)

### 1.0.22 (2022-06-01)

### 1.0.21 (2022-05-19)

### 1.0.20 (2022-05-17)

### 1.0.19 (2022-05-17)

### 1.0.18 (2022-05-11)

### 1.0.17 (2022-05-11)

### 1.0.16 (2022-04-19)

### 1.0.15 (2022-04-11)

### 1.0.14 (2022-03-31)

### 1.0.13 (2022-03-31)

### 1.0.12 (2022-03-28)

### 1.0.11 (2022-01-27)

### 1.0.10 (2022-01-27)
