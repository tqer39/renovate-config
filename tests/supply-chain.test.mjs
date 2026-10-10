import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

// Use the exact Renovate installation provided by npx, including its rule engine.
const validator = process.env.PATH.split(delimiter)
  .map((directory) => join(directory, 'renovate-config-validator'))
  .find((file) => existsSync(file));
assert.ok(validator, 'Run through the Renovate npx command documented in README.md');
const renovateDist = dirname(realpathSync(validator));
const require = createRequire(join(renovateDist, 'config-validator.js'));
const load = (file) => import(pathToFileURL(join(renovateDist, file)).href);
const { init } = await load('logger/index.js');
await init();
const { resolveConfigPresets } = await load('config/presets/index.js');
const { mergeChildConfig } = await load('config/utils.js');
const { getConfig: getDefaultConfig } = await load('config/defaults.js');
const { resolveUpdateTypeConfig, filterInternalChecks } = await load('workers/repository/process/lookup/filter-checks.js');
const { applyMinimumReleaseAgeToDigestUpdate } = await load('workers/repository/process/lookup/digest.js');
const { checkMinimumReleaseAge } = await load('util/minimum-release-age.js');
const { api: versioning } = await load('modules/versioning/npm/index.js');
const raw = require('json5').parse(readFileSync(new URL('../renovate.json5', import.meta.url), 'utf8'));
const { config: preset } = await resolveConfigPresets(raw);
const config = mergeChildConfig(getDefaultConfig(), preset);

function dependency(packageName = 'dayjs', manager = 'npm', datasource = 'npm') {
  return { ...config, packageName, depName: packageName, manager, datasource, currentVersion: '1.0.0' };
}

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

test('young or undated releases stay pending; mature releases can proceed', async () => {
  for (const releaseTimestamp of [daysAgo(1), daysAgo(13), undefined]) {
    const result = await filterInternalChecks(dependency(), versioning, 'patch', [{ version: '1.0.1', releaseTimestamp }]);
    assert.equal(result.pendingChecks, true);
  }
  const result = await filterInternalChecks(dependency(), versioning, 'patch', [
    { version: '1.0.1', releaseTimestamp: daysAgo(15) },
    { version: '1.0.2', releaseTimestamp: daysAgo(1) },
  ]);
  assert.equal(result.pendingChecks, false);
  assert.equal(result.release.version, '1.0.1');
});

test('existing grouping rules preserve manual major updates and automatic minor/patch updates', async () => {
  for (const input of [dependency(), dependency('pytest', 'pip_requirements', 'pypi'), dependency('actions/checkout', 'github-actions', 'github-tags')]) {
    assert.equal((await resolveUpdateTypeConfig(input, 'major')).automerge, false);
    for (const updateType of ['minor', 'patch']) {
      const effective = await resolveUpdateTypeConfig(input, updateType);
      assert.equal(effective.automerge, true);
      assert.equal(checkMinimumReleaseAge(effective, daysAgo(1)).isPending, true);
    }
  }
});

test('updates without release-age support require manual review, even after package grouping', async () => {
  for (const packageName of ['dayjs', 'pip', 'pytest']) {
    for (const updateType of ['pin', 'replacement', 'lockFileMaintenance', 'lockfileUpdate', 'rollback', 'bump']) {
      const effective = await resolveUpdateTypeConfig(dependency(packageName), updateType);
      assert.equal(effective.automerge, false, `${packageName}: ${updateType}`);
      assert.equal(effective.minimumReleaseAge, null);
      assert.ok(effective.prBodyNotes.some((note) => note.includes('Review changed dependencies')));
    }
  }
});

test('digest updates wait for release age; initial digest pinning requires manual review', async () => {
  const input = dependency('actions/checkout', 'github-actions', 'github-tags');
  for (const updateType of ['digest', 'pinDigest']) {
    for (const timestamp of [daysAgo(1), undefined]) {
      const update = { updateType };
      await applyMinimumReleaseAgeToDigestUpdate(update, input, {}, true, timestamp);
      assert.equal(update.pendingChecks, true);
    }
    const update = { updateType };
    await applyMinimumReleaseAgeToDigestUpdate(update, input, {}, true, daysAgo(15));
    assert.notEqual(update.pendingChecks, true);
  }
  assert.equal((await resolveUpdateTypeConfig(input, 'pinDigest')).automerge, false);
});

test('vulnerability overrides bypass release-age checks and preserve automatic merging', async () => {
  for (const updateType of ['patch', 'major', 'lockfileUpdate']) {
    const regular = await resolveUpdateTypeConfig(dependency(), updateType);
    // Renovate's vulnerability initialization applies these as a force override.
    const security = mergeChildConfig(regular, { force: config.vulnerabilityAlerts });
    assert.equal(security.automerge, true);
    assert.equal(checkMinimumReleaseAge(security, daysAgo(0)).isPending, false);
    assert.equal(checkMinimumReleaseAge(security, undefined).isPending, false);
    assert.deepEqual(security.schedule, ['at any time']);
  }
});

test('supported lockfile operations disable scripts and Composer plugins', () => {
  assert.equal(config.ignoreScripts, true);
  assert.equal(config.ignorePlugins, true);
  assert.equal(config.osvVulnerabilityAlerts, true);
  assert.equal('allowedPostUpgradeCommands' in raw, false);
  assert.equal('allowedCommands' in raw, false);
});
