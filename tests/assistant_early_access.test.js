const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('_c8oProject/mobileNgxApp.yaml', 'utf8');
const block = source.slice(source.indexOf('  ↓HandlePostMessage ['));
const value = block.match(/→: \|\n( +)'([\s\S]*?)\n\1'/);
assert.ok(value, 'exported initialization action');
const code = value[2].replace(new RegExp('\\n' + value[1], 'g'), '\n').replace(/''/g, "'");
const initialize = new Function('page', 'props', 'window', 'document', 'resolve', 'Events', 'setTimeout',
  code.replace(/page as any/g, 'page'));

function fixture({hash = '', search = '', version = '8.4.4', context = {}, startup = false} = {}) {
  let listener;
  let navigationListener;
  const navigations = [];
  const location = {hash, search, pathname: '/projects/lib_ConvertigoAssistant/DisplayObjects/mobile/'};
  const window = {
    location,
    history: {state: {navigationId: 2}, replaceState(state, _title, url) {
      assert.equal(state.navigationId, 2);
      location.hash = url.includes('#') ? '#' + url.split('#')[1] : '';
    }},
    parent: {postMessage() {}},
    addEventListener(_name, fn) { listener = fn; }
  };
  const page = {
    global: {agentEarlyAccessAtStartup: startup}, local: {},
    angularRouter: {url: '/path-to-lightrag',
      events: {subscribe(fn) { navigationListener = fn; return {}; }},
      navigate(path, options) { navigations.push({path, options}); }},
    c8o: {log: {debug() {}, warn() {}}}, tick() {}, getInstance() { return {publish() {}}; }
  };
  initialize(page, {}, window, {title: 'Assistant'}, () => {}, {}, fn => fn());
  const send = payload => listener({data: {type: 'lib_ConvertigoAssistant.context', payload}});
  listener({data: {type: 'init'}});
  send({assistantSurface: 'studio', studioVersion: version, ...context});
  return {page, window, send, navigations, navigateEvent: event => navigationListener(event),
    enabled: () => page.global.isAssistantAgentReleaseEnabled()};
}

const standard = fixture();
assert.equal(standard.enabled(), false);
assert.equal(standard.navigations.length, 0, 'normal Studio stays on How-To');
assert.equal(fixture({context: {localAgentBridgeAvailable: true, agentBridgeAvailable: true}}).enabled(), false);
assert.equal(fixture({search: '?agentBridge=1&assistantMode=agent'}).enabled(), false);

for (const version of ['8.4.4', '8.4.4_beta', '8.4.5', '8.5.0', '9.0.0']) {
  const early = fixture({hash: '#early-access-agent', version});
  assert.equal(early.enabled(), true, version);
  assert.equal(early.navigations.length, 1);
  assert.deepEqual(early.navigations[0].path, ['/path-to-xfirst', ':threadid']);
  assert.equal(early.navigations[0].options.preserveFragment, true);
  assert.equal(early.page.global.agentActivationAssistantPath(), '/projects/lib_ConvertigoAssistant/DisplayObjects/mobile/');
}
for (const version of ['8.4.2', '8.4.3', '', 'unknown']) {
  assert.equal(fixture({hash: '#early-access-agent', version,
    context: {agentOnboardingFeatureVersion: '1'}}).enabled(), false, version);
}
for (const hash of ['#early-access-agent-other', '#not-early-access-agent', '#foo=early-access-agent']) {
  assert.equal(fixture({hash}).enabled(), false, hash);
}
const withAuth = fixture({hash: '#authToken=one-use&early-access-agent'});
assert.equal(withAuth.enabled(), true);
withAuth.window.location.hash = '';
withAuth.navigateEvent({urlAfterRedirects: '/path-to-xfirst/new?agentBridge=1'});
assert.equal(withAuth.window.location.hash, '#early-access-agent', 'navigation preserves opt-in without auth token');
withAuth.send({assistantUrl: 'http://localhost:18082/convertigo/projects/lib_ConvertigoAssistant/DisplayObjects/mobile/'});
assert.equal(withAuth.enabled(), true, 'later host updates do not lose startup choice');
assert.equal(fixture({startup: true}).enabled(), true, 'constructor captured fragment before router initialization');
assert.equal(fixture({context: {assistantUrl: 'https://assistant.convertigo.com/#early-access-agent'}}).enabled(), true);
assert.equal(fixture().enabled(), false, 'fresh opening without fragment does not reuse previous opt-in');

const installed = {assistantRuntime: 'local', localAgentStackAvailable: true};
const local = fixture({context: installed});
assert.equal(local.enabled(), true, 'installed local Assistant opens without early access fragment');
assert.equal(local.navigations.length, 1);
assert.equal(fixture({context: {...installed, localAgentStackAvailable: 'true'}}).enabled(), true);
assert.equal(fixture({context: {...installed, assistantRuntime: 'remote'}}).enabled(), false,
  'installed projects do not unlock the hosted Assistant');
assert.equal(fixture({context: {...installed, localAgentStackAvailable: false}}).enabled(), false,
  'local URL alone does not unlock a missing stack');
assert.equal(fixture({version: '8.4.3', context: installed}).enabled(), false);
local.page.global.agentReleasePolicy.minimumStudioVersion = '8.4.5';
assert.equal(local.enabled(), false, 'local installation still respects the minimum Studio version');

const publicRelease = fixture();
publicRelease.page.global.agentReleasePolicy.publiclyAvailable = true;
assert.equal(publicRelease.enabled(), true);
publicRelease.page.global.agentReleasePolicy.minimumStudioVersion = '8.4.5';
assert.equal(publicRelease.enabled(), false);
publicRelease.send({studioVersion: '8.4.5'});
assert.equal(publicRelease.enabled(), true);
assert.equal(publicRelease.page.global.agentActivationAssistantPath(), '/projects/lib_ConvertigoAssistant/DisplayObjects/mobile/');

for (const assistantSurface of ['nocode', 'c8oforms', 'server']) {
  assert.equal(fixture({version: '', context: {assistantSurface}}).enabled(), true);
}
assert.equal(fixture({context: {assistantRuntime: 'server'}}).enabled(), true, 'Studio Web explicit server integration');
assert.equal(fixture({hash: '#early-access-agent', context: {assistantSurface: 'admin'}}).enabled(), false);
standard.navigateEvent({navigationTrigger: 'imperative', url: '/path-to-agent/new'});
assert.deepEqual(standard.navigations.at(-1).path, ['/path-to-lightrag']);
standard.navigateEvent({navigationTrigger: 'imperative', url: '/path-to-xfirst/new?agentBridge=1'});
assert.deepEqual(standard.navigations.at(-1).path, ['/path-to-lightrag']);
const before = standard.navigations.length;
standard.navigateEvent({navigationTrigger: 'imperative', url: '/path-to-xfirst/new?agentBridge=0'});
assert.equal(standard.navigations.length, before, 'component assistant remains accessible');
console.log('Assistant early access routing tests passed');
