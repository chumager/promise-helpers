
"use strict";

module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        useBuiltIns: "entry",
        corejs: 3,
        targets: {
          node: true
        }
      }
    ]
  ],
  plugins: ["@babel/plugin-proposal-optional-chaining", "@babel/plugin-proposal-nullish-coalescing-operator"]
};
