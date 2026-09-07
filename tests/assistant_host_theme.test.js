const assert = require('node:assert/strict');
const fs = require('node:fs');

// Exercise the actual MCP-exported action bodies, not a duplicate implementation.
const source = fs.readFileSync('_c8oProject/mobileNgxApp.yaml', 'utf8');
function action(name) {
  const start = source.indexOf('  ↓' + name + ' [');
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  ↓', start + 1);
  const block = source.slice(start, end < 0 ? undefined : end);
  const value = block.match(/→: \|\n( +)'([\s\S]*?)\n\1'/);
  assert.ok(value, name + ' FormatedContent');
  const code = value[2].replace(new RegExp('\\n' + value[1], 'g'), '\n').replace(/''/g, "'");
  return new Function('page', 'props', 'window', 'document', 'resolve', 'Events', 'setTimeout',
    code.replace(/page as any/g, 'page'));
}
const handle = action('HandlePostMessage');
const theme = action('GetTheme');
function fixture({early, noCode = false} = {}) {
  let listener;
  let writes = 0;
  let ticks = 0;
  let navigations = 0;
  const classes = () => {
    const values = new Set();
    return {values, add: x => values.add(x), remove: (...xs) => xs.forEach(x => values.delete(x))};
  };
  const document = {documentElement: {classList: classes()}, body: {classList: classes()}};
  const window = {
    location: {search: noCode ? '?assistantSurface=nocode' : '?dark-theme=true', hash: ''},
    localStorage: {getItem: () => null, setItem: () => writes++},
    matchMedia: () => ({matches: false}), parent: {postMessage() {}},
    addEventListener: (_event, callback) => { listener = callback; }
  };
  const conversation = {id: 'in-progress', steps: [1, 2]};
  const page = {
    global: {conversation}, local: {}, tick: () => ticks++,
    c8o: {log: {debug() {}, warn() {}}},
    angularRouter: {url: '/path-to-xfirst/existing?agentBridge=1', navigate: () => navigations++},
    getInstance: () => ({publish() {}}), getUrlDarkThemeOverride: () => true
  };
  const args = [page, {}, window, document, () => {}, {}, callback => callback()];
  handle(...args);
  const send = payload => listener({data: {type: 'lib_ConvertigoAssistant.context', payload}});
  listener({data: {type: 'init'}});
  if (early) send(early);
  theme(...args);
  const expectTheme = dark => {
    assert.equal(page.global.themeDark, dark);
    for (const el of [document.documentElement, document.body]) {
      assert.equal(el.classList.values.has(dark ? 'force-dark' : 'force-light'), true);
      assert.equal(el.classList.values.size, 1);
    }
    assert.equal(writes, 0, 'host theme must not overwrite personal preference');
    assert.equal(navigations, 0, 'host updates must not navigate away from the conversation');
    assert.equal(page.global.conversation, conversation);
    assert.ok(ticks > 0);
  };
  return {send, expectTheme, page};
}

const live = fixture();
live.expectTheme(true);
live.send({assistantSurface: 'studio', darkTheme: false});
live.expectTheme(false);
live.send({assistantSurface: 'studio', darkTheme: true});
live.expectTheme(true);
live.send({assistantSurface: 'studio', theme: 'light'});
live.expectTheme(false);
live.send({assistantSurface: 'studio', 'dark-theme': 'true'});
live.expectTheme(true);
live.send({assistantSurface: 'studio', defaultProject: 'OtherProject'});
live.expectTheme(true);
live.send({assistantSurface: 'studio', darkTheme: 'invalid'});
live.expectTheme(true);
const early = fixture({early: {assistantSurface: 'studio', darkTheme: false}});
early.expectTheme(false);
const nocode = fixture({noCode: true});
nocode.send({assistantSurface: 'nocode', darkTheme: true});
nocode.expectTheme(false);
console.log('Assistant host theme tests passed');
