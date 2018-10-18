const hasdDir = require('wi-import').hashDir;
const fs = require('fs');
const config = require('config');
const async = require('async');
const convertLength = require('../utils/convert-length');

module.exports = function (parents, dataset, dbConnection) {
    return new Promise(function (resolve) {
        if (!isFinite(dataset.top) || !isFinite(dataset.bottom) || !dataset.step || dataset.step === '0' || dataset.step === 0) {
            console.log("No top|bottom|step");
            resolve();
        } else {
            dataset.step = parseFloat(dataset.step);
            dataset.top = parseFloat(dataset.top);
            dataset.bottom = parseFloat(dataset.bottom);
            let curve = {
                name: '__MD',
                unit: dataset.unit,
                idFamily: 743,
                description: 'MD Curve',
                idDataset: dataset.idDataset,
                createdBy: parents.username,
                updatedBy: parents.username
            };
            dbConnection.Curve.create(curve).then(c => {
                if (c) {
                    let hashPath = hasdDir.createPath(config.curveBasePath, parents.username + parents.project + parents.well + dataset.name + c.name, c.name + '.txt');
                    console.log(hashPath);
                    let dataArr = [];
                    let text = "";
                    let value = dataset.top;
                    while (value <= dataset.bottom) {
                        dataArr.push(value);
                        value += dataset.step;
                    }
                    async.eachOf(dataArr, function (num, index, next) {
                        text += index + " " + num + "\n";
                        next();
                    }, function () {
                        fs.writeFileSync(hashPath, text);
                        resolve(c);
                    });
                } else {
                    console.log("Cant created curve");
                    resolve();
                }
            }).catch(err => {
                console.log("Cant created curve ", err);
                resolve();
            })
        }
    });
};