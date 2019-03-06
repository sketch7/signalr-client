[releaseWorkflowWiki]: ./RELEASE-WORKFLOW.md

## Getting Started

### Setup Machine for Development
Install/setup the following:

- NodeJS v10+
- Visual Studio Code or similar code editor
- TypeScript 3.1+
- Git + SourceTree, SmartGit or similar (optional)
- Ensure to install **global NPM modules** using the following:


```bash
npm install -g git gulp
```


### Project Setup
The following process need to be executed in order to get started.

```bash
npm install
```


### Building the code

```bash
npm run build
```

### Running the tests

```bash
npm test
```

#### Watch
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

- Update changelogs
- bump version


Check out the [release workflow guide][releaseWorkflowWiki] in order to guide you creating a release and publishing it.