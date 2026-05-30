const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');

const buildOptions = [
  {
    entryPoints: ['src/background/background.ts'],
    bundle: true,
    outfile: 'dist/background.js',
    format: 'iife',
    target: 'chrome90',
  },
  {
    entryPoints: ['src/content/content.ts'],
    bundle: true,
    outfile: 'dist/content.js',
    format: 'iife',
    target: 'chrome90',
  },
  {
    entryPoints: ['src/popup/popup.ts'],
    bundle: true,
    outfile: 'dist/popup.js',
    format: 'iife',
    target: 'chrome90',
  },
  {
    entryPoints: ['src/options/options.ts'],
    bundle: true,
    outfile: 'dist/options.js',
    format: 'iife',
    target: 'chrome90',
  },
];

async function build() {
  try {
    for (const options of buildOptions) {
      await esbuild.build(options);
      console.log(`Built: ${options.outfile}`);
    }
    console.log('All builds completed!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

if (isWatch) {
  // Watch mode not implemented for simplicity
  console.log('Watch mode: run build manually');
  build();
} else {
  build();
}
