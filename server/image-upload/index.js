'use strict';
const express = require('express');
const config = require('config');

const cors = require('cors');
const fs = require('fs');
const formidable = require('formidable');
let ResponseJSON = require('../response');
let errorCodes = require('../../error-codes');
let hashDir = require('wi-import').hashDir; // hashDir.createPath();

let router = express.Router();

router.use(cors());

router.post('/image-upload', imageUpload);

let saveDir = __dirname + '/../../wi-images/';

function imageUpload(req, res) {
  var form = new formidable.IncomingForm();
  form.multiples = false;
  form.uploadDir = '/tmp';

  form.on('end', function () {

  });

  form.on('field', function (name, value) {

  });
  form.on('file', function (name, file) {
    let fileHashDir = hashDir.createPath(saveDir, file.path, file.name);
    fs.rename(file.path, fileHashDir, function (err) {
      if ( err ) {
        res.end(JSON.stringify(ResponseJSON(errorCodes.CODES.INTERNAL_SERVER_ERROR, 'Upload image failed!')));        
      }
      let fileDir = fileHashDir.replace(saveDir, '');
      res.end(JSON.stringify(ResponseJSON(errorCodes.CODES.SUCCESS, "Upload success", fileDir)));
    });
  });
  form.on('error', function (err) {

  });

  form.parse(req);

}

module.exports = router;