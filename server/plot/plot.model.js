var models = require('../models');
var Plot = models.Plot;
var ResponseJSON = require('../response');
var ErrorCodes = require('../../error-codes').CODES;


function createNewPlot(plotInfo, done) {
    Plot.sync()
        .then(
            function () {
                var plot = Plot.build({
                    idWell:plotInfo.idWell,
                    name: plotInfo.name,
                    option:plotInfo.option
                });
                plot.save()
                    .then(function (plot) {
                        done(ResponseJSON(ErrorCodes.SUCCESS,"Success",{idPlot:plot.idPlot}));
                    })
                    .catch(function (err) {
                        done(ResponseJSON(ErrorCodes.ERROR_INCORRECT_FORMAT, err.name));
                    })
            },
            function () {
                done(ResponseJSON(ErrorCodes.ERROR_SYNC_TABLE, "Connect to database fail or create table not success"));
            }
        )
}

function editPlot(plotInfo,done) {
    Plot.findById(plotInfo.idPlot)
        .then(function (plot) {
            plot.idWell = plotInfo.idWell;
            plot.name = plotInfo.name;
            plot.option = plotInfo.option;
            plot.save()
                .then(function () {
                    done(ResponseJSON(ErrorCodes.SUCCESS, "Success", plotInfo));
                })
                .catch(function (err) {
                    done(ResponseJSON(ErrorCodes.ERROR_INCORRECT_FORMAT, err.name));
                })
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS,"Plot not exist"));
        })
}
function deletePlot(plotInfo,done) {
    Plot.findById(plotInfo.idPlot)
        .then(function (plot) {
            plot.destroy()
                .then(function () {
                    done(ResponseJSON(ErrorCodes.SUCCESS, "Deleted", plot));
                })
                .catch(function (err) {
                    done(ResponseJSON(ErrorCodes.ERROR_DELETE_DENIED, err.errors[0].message));
                })
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Not Found"));
        })
}
function getPlotInfo(plot, done) {
    Plot.findById(plot.idPlot, {include: [{all:true}]})
        .then(function (plot) {
            if (!plot) throw "not exits";
            done(ResponseJSON(ErrorCodes.SUCCESS, "Success", plot));
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Not found"));
        })
}

module.exports = {
    createNewPlot:createNewPlot,
    editPlot:editPlot,
    deletePlot:deletePlot,
    getPlotInfo:getPlotInfo
};
