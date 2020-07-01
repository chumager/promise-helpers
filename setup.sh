#!/bin/sh

touch yarn.lock 
yarn set version berry
unset YARN_WRAP_OUTPUT 
yarn
yarn pnpify --sdk 
yarn plugin import interactive-tools
yarn config set packageExtensions --json '{"gulp-javascript-obfuscator@*": {"dependencies": {"vinyl-sourcemaps-apply":"*"}}}' \
  || echo "Si no puede cargar la configuracion para gulp-javascript-obfuscator, entonces agregue la siguiente línea a .yarnrc.yml:
packageExtensions:
  gulp-javascript-obfuscator@*:
    dependencies:
      vinyl-sourcemaps-apply: \"*\"
Luego proceda a ejecutar yarn nuevamente
"
yarn
