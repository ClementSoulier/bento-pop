import * as esbuild from 'esbuild';
import fs from 'fs';
const out = await esbuild.build({
  entryPoints: ['src/index.jsx'], bundle: true, format: 'iife', globalName: 'MonBentoPop',
  alias: { react: './src/react-shim.js' }, minify: true, write: false, target: ['es2019'], legalComments: 'none',
});
let js = out.outputFiles[0].text;
// list exported component names (functions starting with uppercase)
const src = fs.readFileSync('src/index.jsx', 'utf8');
const names = [...src.matchAll(/^export function ([A-Z][A-Za-z0-9]*)/gm)].map(m => m[1]);
const header = '/* @ds-bundle: ' + JSON.stringify({ format: 4, namespace: 'MonBentoPop', components: names.map(n => ({ name: n })) }) + ' */\n';
js = header + js + '\nwindow.MonBentoPop = MonBentoPop;\n';
if (/<\/script|<!--/i.test(js)) { console.error('FORBIDDEN SEQUENCE'); process.exit(1); }
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/bundle.js', js);
fs.copyFileSync('src/bundle.css', 'dist/bundle.css');
console.log('bundle.js', js.length, 'bytes;', names.length, 'components:', names.join(', '));
