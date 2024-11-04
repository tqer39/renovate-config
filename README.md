<p align="center">
  <a href="">
    <img src="./docs/header.jpg" alt="header" width="100%">
  </a>
  <span align="center" style="font-size: 4rem;">Renovate Config</span>
</p>

<p align="center">
  <i>This repository is a repository that allows you to reference and use the configuration files of Renovate, a dependency update tool, from multiple repositories by consolidating them.</i>
</p>

---

## Usage

1. Create a `renovate.json` file in the root directory of your project.
2. Add the following settings to the `renovate.json` file.

```json
{
  "extends": [
    "github>tqer39/renovate-config"
  ]
}
```

## Customize settings for each repository

1. Create a `renovate.json` file in the root directory of your project.
2. Add the following settings to the `renovate.json` file.

```json
{
  "extends": [
    "github>tqer39/renovate-config"
  ],
  "packageRules": [
    {
      "packagePatterns": ["^@tqer39/"],
      "automerge": true
    }
  ]
}
```

### If you want to customize the common settings of this repository for your own use

1. Fork this repository.
2. Add the settings to the `renovate.json` file using the URL of the forked repository.

```json
{
  "extends": [
    "github>Your GitHub username/renovate-config"
  ]
}
```

## Processing contents

```mermaid
sequenceDiagram
    renovate.json->>tqer39/renovate-config: Load common settings
    tqer39/renovate-config->>renovate.json: Return settings
```

## Description of settings/ Files

| File Name | Description |
|-----------|-------------|
| [automergeGitHubActions.json](https://docs.renovatebot.com/configuration-options/#automerge) | Auto-merge settings for GitHub Actions |
| [automergeNodeEnv.json](https://docs.renovatebot.com/configuration-options/#automerge) | Auto-merge settings for the Node.js environment |
| [automergePreCommit.json](https://docs.renovatebot.com/configuration-options/#automerge) | Auto-merge settings for pre-commit |
| [automergePyEnv.json](https://docs.renovatebot.com/configuration-options/#automerge) | Auto-merge settings for pyenv |
| [automergePython.json](https://docs.renovatebot.com/configuration-options/#automerge) | Auto-merge settings for Python packages |
| [automergeSchedule.json](https://docs.renovatebot.com/configuration-options/#schedule) | Schedule settings for auto-merging |
| [automergeStrategy.json](https://docs.renovatebot.com/configuration-options/#automerge) | Strategy settings for auto-merging |
| [dependencyDashboard.json](https://docs.renovatebot.com/configuration-options/#dependencydashboard) | Settings for the dependency dashboard |
| [major.json](https://docs.renovatebot.com/configuration-options/#major) | Settings for major updates |
| [minor.json](https://docs.renovatebot.com/configuration-options/#minor) | Settings for minor updates |
| [patch.json](https://docs.renovatebot.com/configuration-options/#patch) | Settings for patch updates |
| [platformAutomerge.json](https://docs.renovatebot.com/configuration-options/#automerge) | Auto-merge settings for platforms |
| [prHourlyLimit.json](https://docs.renovatebot.com/configuration-options/#prhourlylimit) | Hourly limit settings for pull requests |
| [schedule.json](https://docs.renovatebot.com/configuration-options/#schedule) | Schedule settings |
| [separateMajorMinor.json](https://docs.renovatebot.com/configuration-options/#separatemajorminor) | Settings for separating major and minor updates |
| [separateMultipleMajor.json](https://docs.renovatebot.com/configuration-options/#separatemultiplemajor) | Settings for separating multiple major updates |
| [timezone.json](https://docs.renovatebot.com/configuration-options/#timezone) | Time zone settings |
| [vulnerabilityAlerts.json](https://docs.renovatebot.com/configuration-options/#vulnerabilityalerts) | Vulnerability alert settings. This enables notifications if vulnerabilities are detected in dependencies. |

## Contribution

If you find any issues or have improvements, please create an Issue or submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).
