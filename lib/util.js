/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
// # util.js
(function () {
  'use strict';
  var path = require('path');
  module.exports = function (anno) {
    var opt = anno.opt;
    return {
      loadSrc: function (src, callback) {
        var srcPath = src, name, lang,
          ext = opt.extension,
          on = outcome.error(callback);

        if (_.isString(src))
          src = { path: src };
        else {
          if (!_.has(src, 'path'))
            throw new Error('src must contain a path');
          srcPath = src.path;
        }

        if (src.path[0] !== '/')
          src.path = path.join(opt.basePath, src.path);
        src.name = path.basename(srcPath);
        src.relative = path.relative(process.cwd(), srcPath);
        if (!ext)
          ext = path.extname(src.name) || src.name;
        src.ent = src.lang = ext;
        if (src.lang[0] === '.')
          src.lang = src.lang.slice(1);
        src.id = src.relative.replace(/^\s+|\s+$/g, '').replace(/\W+/g, '-');
        if (typeof src.contents === 'undefined') {
          fs.readFile(src.path, (src.readOpt || { encoding: 'utf8' }), on.success(function (contents) {
            src.contents = contents;
            callback(null, src);
          }));
        } else
          callback(null, src);
        return this;
      }
    };
  };
})();
