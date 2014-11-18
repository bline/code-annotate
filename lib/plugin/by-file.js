/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
// # annotate.js
(function () {
  'use strict';
  module.exports = require('code-annotate-plugin').extend({
    name: 'part',
    isFileFormatter: true,
    Plugin: ByFile,
    requires: ['marked']
  });

  function ByFile() {
    ByFile.super_.apply(this, arguments);
  }
  ByFile.prototype.formatFile = function (annotation, callback) {
    var root = '/byFile',
      byFile = annotation.sections.byFile = {
      nav: {
        title: 'By File',
        href: root,
        sections: []
      },
      content: []
    };
    annotation.files.forEach(function (file) {
      var toc = file.markedToc,
        fileId = file.relative.replace(/\W+/g, '-'),
        last = nav = { title: file.relative, href: root + "/" + fileId, sections: [] },
        content = { title: file.relative, id: fileId, sections: [] },
        lastDepth = 0;
      toc.forEach(function (toc) {
        var depth = toc.depth,
          section = {
            title: toc.header,
            sections: []
          }
        if (depth < lastDepth) {
          var up = lastDepth - depth;
          while (up-- > 0)
            last = last.parent;
        }
        curRoot = last.href;
        section.href = curRoot + '/' + toc.id;
        last.sections.push(section);
        section.parent = last;
        if (depth > lastDepth) {
          last = section;
        }
        lastDepth = depth;
      });
      byFile.nav.sections.push(nav);
      file.sections.forEach(function (fileSection) {
      });
    });
  };

})();
