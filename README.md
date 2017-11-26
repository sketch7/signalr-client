[projectUri]: https://github.com/sketch7/ssv.signalr-client
[projectGit]: https://github.com/sketch7/ssv.signalr-client.git
[changeLog]: ./CHANGELOG.md
[releaseWorkflowWiki]: ./docs/RELEASE-WORKFLOW.md

[npm]: https://www.npmjs.com

# ssv.signalr-client
[![CircleCI](https://circleci.com/gh/sketch7/ssv.signalr-client.svg?style=shield)](https://circleci.com/gh/sketch7/ssv.signalr-client)
[![bitHound Overall Score](https://www.bithound.io/github/sketch7/ssv.signalr-client/badges/score.svg)](https://www.bithound.io/github/sketch7/ssv.signalr-client)
[![npm version](https://badge.fury.io/js/ssv.signalr-client.svg)](https://badge.fury.io/js/ssv.signalr-client)

SignalR client library built on top of `@aspnet/signalr-client`. This gives you more features and easier to use.

## Features:
* todo 


**Quick links**

[Change logs][changeLog] | [Project Repository][projectUri]

## Installation

Get library via [npm]
```bash
npm install @ssv/signalr-client --save
```

## Usage
**TODO**


## Getting Started

### Setup Machine for Development
Install/setup the following:

- NodeJS v9+
- Visual Studio Code or similar code editor
- TypeScript 2.6+
- Git + SourceTree, SmartGit or similar (optional)
- Ensure to install **global NPM modules** using the following:


```bash
npm install -g git gulp yarn
```


#### Cloning Repo

- Run `git clone https://github.com/sketch7/ssv.signalr-client.git`


### Project Setup
The following process need to be executed in order to get started.

```bash
npm install
```


### Building the code

```
gulp build
// or
npm run build
```
In order to view all other tasks invoke `gulp` or check the gulp tasks directly.

### Running the tests

```
gulp test
// or
npm test
```


### Development utils

#### Trigger gulp watch
Handles compiling of changes.
```
gulp watch
// or
npm start
```


#### Running Continuous Tests
Spawns test runner and keep watching for changes.
```
gulp tdd
// or
npm run tdd
```


### Preparation for Release

```
npm run prepare-release -- --bump major|minor|patch|prerelease (default: patch)
```
Check out the [release workflow guide][releaseWorkflowWiki] in order to guide you creating a release and publishing it.