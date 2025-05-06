import { defineConfig } from 'vitest/config';
import { babel } from '@rollup/plugin-babel';
import debuggerInstrumentation from './.babel/plugins/debugger-instrumentation/index.js';
import expectSoft from './.babel/plugins/expect-soft/index.js';

export default defineConfig({
  plugins: [
    babel({
      babelrc: false,
      configFile: false,
      // files to run through Babel
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      plugins: [[debuggerInstrumentation, { maxVars: 50 }], expectSoft],
    }),
  ],

  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    reporters: ['json', 'default'],
    outputFile: './.blamy/coverage/vitest-coverage.json'
  },
  workers: {
    isolate: true,
    threads: false
  }
});
