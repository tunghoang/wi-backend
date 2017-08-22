var express = require('express');
var router = express.Router();
var zoneSetModel = require('./zone-set.model');
var bodyParser = require('body-parser');

router.use(bodyParser.json());

router.post('/zone-set/info', function (req, res) {
    zoneSetModel.getZoneSetInfo(req.body,function (status) {
        res.send(status);
    })
});
router.post('/zone-set/new', function (req, res) {
    zoneSetModel.createNewZoneSet(req.body,function (status) {
        res.send(status);
    })
});
router.post('/zone-set/edit', function (req, res) {
    zoneSetModel.editZoneSet(req.body,function (status) {
        res.send(status);
    })
});
router.delete('/zone-set/delete', function (req, res) {
    zoneSetModel.deleteZoneSet(req.body,function (status) {
        res.send(status);
    })
});


module.exports = router;