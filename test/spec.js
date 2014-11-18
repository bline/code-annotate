/*
 * Copyright (C) 2014 Scott Beck, all rights reserved
 *
 * Licensed under the MIT license
 *
 */
(function () {
  'use strict';
  describe("code-annotate#import", function () {
    it("should not throw", function () {
      (function () { require("../index.js"); })
        .should.not.throw();
    });
  });
})();
