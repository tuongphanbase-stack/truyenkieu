const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),dataFile=path.join(root,'js','narrative-layers.js');
assert.ok(fs.existsSync(dataFile));const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(dataFile,'utf8'),sandbox);
const anchors=[1,2,83,409,441,723,1533,2365,2465,3225,3241,3251,3253];
for(const line of anchors)assert.ok(sandbox.window.narrativeLayersForLine(line));
assert.ok(sandbox.window.KIEU_PSYCHOLOGY_TIMELINE.length>=10);assert.ok(sandbox.window.narrativeLayersForLine(2).variant);assert.ok(sandbox.window.narrativeLayersForLine(1).connections.some(c=>c.target===3241));assert.ok(sandbox.window.psychologyContextForLine(723).current);
console.log('narrative layers data validation passed:',anchors.length,'anchors');
