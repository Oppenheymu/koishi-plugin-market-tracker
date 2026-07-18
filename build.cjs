const { build } = require('esbuild');
const { copyFileSync, readFileSync } = require('fs');
const yaml = require('js-yaml');

// esbuild 插件：将 .yml/.yaml 文件解析为 JSON 内联到打包产物中
const yamlPlugin = {
  name: 'yaml',
  setup(build) {
    build.onLoad({ filter: /\.ya?ml$/ }, (args) => {
      const text = readFileSync(args.path, 'utf8');
      return {
        contents: JSON.stringify(yaml.load(text)),
        loader: 'json',
      };
    });
  },
};

// 构建脚本：将 src/index.ts 打包为 lib/index.js (CJS)
// 使用 packages=external 自动将 node_modules 依赖标记为外部模块
// 使用 banner + define polyfill import.meta.url（CJS 格式下不可用）
// 构建后复制 template.html 到 lib/（render.ts 运行时 readFileSync 读取）
build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'lib/index.js',
  tsconfig: 'tsconfig.json',
  packages: 'external',
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.json', '.yml'],
  banner: {
    js: 'const import_meta_url = require("url").pathToFileURL(__filename).href;',
  },
  define: {
    'import.meta.url': 'import_meta_url',
  },
  plugins: [yamlPlugin],
  logLevel: 'info',
}).then(
  () => {
    copyFileSync('src/template.html', 'lib/template.html');
    console.log('Build complete: lib/index.js, lib/template.html');
  },
  (e) => { console.error('BUILD FAILED:', e); process.exit(1); }
);
