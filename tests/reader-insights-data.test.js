const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const dataFile = path.join(root, 'js', 'reader-insights.js');
assert.ok(fs.existsSync(dataFile), 'reader insights module must exist');
const sandbox = { window: {} };
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(dataFile, 'utf8'), sandbox);
assert.ok(sandbox.window.KIEU_READER_INSIGHTS);assert.strictEqual(typeof sandbox.window.readerInsightForLine, 'function');
const anchors=[723,725,1533,1539,2327,2357,2365,2465,2499,3225];
for(const line of anchors){const insight=sandbox.window.readerInsightForLine(line);assert.ok(insight);assert.ok(insight.pair);assert.ok(insight.plain);assert.ok(insight.context);assert.ok(insight.grammar||insight.allusion||insight.subtext)}
console.log('reader insights validation passed:',anchors.length,'curated anchors');
