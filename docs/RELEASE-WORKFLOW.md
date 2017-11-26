# Release workflow
In order to release follow the following procedure.

 - Create branch e.g. `feature/xyz`.. *onces changes are ready...*
 - Run `npm run prepare-release -- --bump major|minor|patch|prerelease (default: patch)`
 - Create a PR from `feature/xyz` to `master`
 - Once merged it will auto `npm publish` and `git tag`