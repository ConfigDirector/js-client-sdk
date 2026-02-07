import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { dts } from "rollup-plugin-dts";

const input = 'src/index.ts';
const plugins = [resolve({
      extensions: ['.ts', '.js']
    }), typescript(), commonjs(), terser()];

export default [
  {
    input,
    output: {
      name: 'ConfigDirectorClient',
      file: './dist/configdirector-client.min.js',
      format: 'umd',
      sourcemap: true,
    },
    plugins,
  },
  {
    input,
    output: {
      file: "dist/configdirector-client.cjs.js",
      format: 'cjs',
      sourcemap: true,
    },
    plugins,
  },
  {
    input,
    output: {
      file: "dist/configdirector-client.es.js",
      format: 'es',
      sourcemap: true,
    },
    plugins,
  },
  {
    input: "./dist/index.d.ts",
    output: [{ file: "dist/configdirector-client.d.ts", format: "es" }],
    plugins: [dts()],
  },
];
