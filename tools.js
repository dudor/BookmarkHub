const path = require('path');
const glob = require('glob');
const paths = require('./config/paths');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const allSitePath = (isEnvDevelopment) => {
  let entryFiles = glob.sync(paths.appSrc + '/views/*');

  let map = {};
  entryFiles.forEach((item) => {
    let filename = item.substring(item.lastIndexOf('/') + 1);
    let filePath = `${item}/${filename}.tsx`;

    map[filename] = [
      isEnvDevelopment &&
        require.resolve('react-dev-utils/webpackHotDevClient'),
      filePath
    ].filter(Boolean);
  });

  return map;
}

const htmlPlugin = (isEnvProduction, isEnvDevelopment) => {
  let fileNameLists = Object.keys(
    allSitePath(isEnvDevelopment)
  );

  let arr = [];
  fileNameLists.forEach(item => {
    let filename = item.substring(item.lastIndexOf('/') + 1);

    arr.push(
      // Generates an `index.html` file with the <script> injected.
      new HtmlWebpackPlugin(
        Object.assign(
          {},
          {
            inject: true,
            filename: item + '.html',
            chunks: [item],
            template: path.resolve(paths.appSrc, `views/${filename}/${filename}.html`),
          },
          isEnvProduction
            ? {
                minify: {
                  removeComments: true,
                  collapseWhitespace: true,
                  removeRedundantAttributes: true,
                  useShortDoctype: true,
                  removeEmptyAttributes: true,
                  removeStyleLinkTypeAttributes: true,
                  keepClosingSlash: true,
                  minifyJS: true,
                  minifyCSS: true,
                  minifyURLs: true,
                },
              }
            : undefined
        )
      )
    );
  });

  return arr;
}

module.exports = {
  allSitePath,
  htmlPlugin
}