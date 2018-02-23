"use strict";

let workflowModel = require('./workflow.model');
let express = require('express');
let router = express.Router();
let bodyParser = require('body-parser');
router.use(bodyParser.json());

router.post('/workflow/new', function (req, res) {
    req.body.content = req.body.content || "{}";
    workflowModel.createWorkflow(req.body, function (done) {
        res.send(done);
    }, req.dbConnection)
});

router.post('/workflow/edit', function (req, res) {
    req.body.content = req.body.content || "{}";
    workflowModel.editWorkflow(req.body, function (done) {
        res.send(done);
    }, req.dbConnection)
});

router.post('/workflow/info', function (req, res) {
    workflowModel.infoWorkflow(req.body, function (done) {
        res.send(done);
    }, req.dbConnection)
});

router.delete('/workflow/delete', function (req, res) {
    workflowModel.deleteWorkflow(req.body, function (done) {
        res.send(done);
    }, req.dbConnection)
});

module.exports = router;