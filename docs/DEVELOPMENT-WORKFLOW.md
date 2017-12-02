## Getting Started

### Setup Machine for Development
Install/setup the following:

- NodeJS v9+
- Visual Studio Code or similar code editor
- TypeScript 2.6+
- Git + SourceTree, SmartGit or similar (optional)
- Ensure to install **global NPM modules** using the following:


```bash
npm install -g git gulp
```


#### Cloning Repo

- Run `git clone https://github.com/sketch7/signalr-client.git`


### Project Setup
The following process need to be executed in order to get started.

```bash
npm install
```


### Building the code

```bash
npm run build
```
In order to view all other tasks invoke `gulp` or check the gulp tasks directly.

### Running the tests

```bash
npm test
```


### Development utils

#### Trigger gulp watch
Handles compiling of changes.

```bash
npm start
```


#### Running Continuous Tests
Spawns test runner and keep watching for changes.

```bash
npm run tdd
```


### Preparation for Release

In order to release follow the following procedure.

 - Create branch e.g. `feature/xyz`.. *onces changes are ready...*
 - Run `npm run prepare-release -- --bump major|minor|patch|prerelease (default: patch)`
 - Create a PR from `feature/xyz` to `master`
 - Once merged it will auto `npm publish` and `git tag`