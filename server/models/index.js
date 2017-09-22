"use strict";
var Sequelize = require('sequelize');
var config = require('config').Database;
var configCommon = require('config');

var wiImport = require('wi-import');
var hashDir = wiImport.hashDir;

var sequelizeCache = new Object();

function SequelizeCache() {
}

SequelizeCache.prototype.put = function (dbName, dbInstance) {
    this[dbName] = dbInstance;
}

SequelizeCache.prototype.get = function (dbName) {
    return this[dbName];
}

SequelizeCache.prototype.remove = function (dbName) {
    delete this[dbName];
}

var __CACHE = new SequelizeCache();
//console.log('start batch job', __CACHE);
setInterval(function () {
    //watchDog
    Object.keys(__CACHE).forEach(function (cache) {
        let dbConnect = __CACHE.get(cache);
        if (Date.now() - dbConnect.timestamp > 1000 * 15 * 60) {
            //delete cache and close sequelize connection if not working for 5 mins
            __CACHE.remove(cache);
            console.log("CLOSED CONNECTION TO : " + cache);
            try {
                dbConnect.instance.sequelize.close();
            } catch (err) {
                console.log("ERR WHILE CLOSE INSTANCE");
            }
        }
    });
}, 1000 * 60);

module.exports = function (dbName, callback) {
    var cacheItem = __CACHE.get(dbName);
    if (cacheItem) {
        cacheItem.timestamp = Date.now();
        return cacheItem.instance;
    } else {
        // No existing dbInstance in the __CACHE ! Create a new one
        cacheItem = {
            instance: null,
            timestamp: Date.now()
        }
        cacheItem.instance = newDbInstance(dbName, callback);
        __CACHE.put(dbName, cacheItem);
        return cacheItem.instance;
    }
}

function newDbInstance(dbName, callback) {
    var object = new Object();
    const sequelize = new Sequelize(dbName, config.user, config.password, {
        define: {
            freezeTableName: true
        },
        dialect: config.dialect,
        port: config.port,
        logging: config.logging,
        pool: {
            max: 2,
            min: 0,
            idle: 200
        },
        storage: config.storage
    });
    sequelize.sync()
        .catch(function (err) {
            console.log(err);
        });
    var models = [
        'Curve',
        'CurveData',
        'DepthAxis',
        'Plot',
        'Project',
        'Property',
        'Track',
        'Well',
        'WellData',
        'Dataset',
        'Line',
        'Family',
        'FamilyCondition',
        'Shading',
        'ZoneSet',
        'Zone',
        'ZoneTrack',
        'CrossPlot',
        'Polygon',
        'PointSet',
        'Discrim',
        'Image',
        'Histogram',
        'Marker',
        'UserDefineLine'
    ];
    models.forEach(function (model) {
        object[model] = sequelize.import(__dirname + '/' + model);
    });

    (function (m) {
        m.Project_Well = m.Project.hasMany(m.Well, {
            foreignKey: {
                name: "idProject",
                allowNull: false,
                unique: "name-idProject"
            }, onDelete: 'CASCADE'
        });
        m.Well_Dataset = m.Well.hasMany(m.Dataset, {
            foreignKey: {
                name: "idWell",
                allowNull: false,
                unique: "name-idWell"
            }, onDelete: 'CASCADE', hooks: true
        });
        m.Well_Plot = m.Well.hasMany(m.Plot, {
            foreignKey: {name: "idWell", allowNull: false, unique: "name-idWell"},
            onDelete: 'CASCADE'
        });
        m.Well.hasMany(m.ZoneSet, {foreignKey: {name: "idWell", allowNull: false}, onDelete: 'CASCADE'});
        m.Well.hasMany(m.CrossPlot, {
            foreignKey: {name: "idWell", allowNull: false, unique: "name-idWell"},
            onDelete: 'CASCADE'
        });
        m.Well.hasMany(m.Histogram, {foreignKey: {name: "idWell", allowNull: false}, onDelete: 'CASCADE'});

        m.Dataset_Curve = m.Dataset.hasMany(m.Curve, {
            foreignKey: {
                name: "idDataset",
                allowNull: false,
                unique: "name-idDataset"
            }, onDelete: 'CASCADE', hooks: true
        });
        m.Plot_Track = m.Plot.hasMany(m.Track, {foreignKey: {name: "idPlot", allowNull: false}, onDelete: 'CASCADE'});
        m.Plot_DepthAxis = m.Plot.hasMany(m.DepthAxis, {
            foreignKey: {name: "idPlot", allowNull: false},
            onDelete: 'CASCADE'
        });
        m.Plot.hasMany(m.ZoneTrack, {foreignKey: {name: "idPlot", allowNull: false}, onDelete: 'CASCADE'});
        m.ZoneTrack.belongsTo(m.ZoneSet, {foreignKey: {name: "idZoneSet", allowNull: true}});//TODO allowNull??
        m.ZoneSet.hasMany(m.Zone, {foreignKey: {name: "idZoneSet", allowNull: false}, onDelete: 'CASCADE'});
        m.Plot.belongsTo(m.Curve, {foreignKey: 'referenceCurve'});

        m.Track.hasMany(m.Line, {foreignKey: {name: "idTrack", allowNull: false}, onDelete: 'CASCADE'});
        m.Track.hasMany(m.Shading, {foreignKey: {name: "idTrack", allowNull: false}, onDelete: 'CASCADE'});
        m.Track.hasMany(m.Image, {foreignKey: {name: "idTrack", allowNull: false}, onDelete: 'CASCADE'});
        m.Line.belongsTo(m.Curve, {foreignKey: {name: "idCurve", allowNull: false}, onDelete: 'CASCADE'});

        m.FamilyCondition.belongsTo(m.Family, {foreignKey: 'idFamily'});
        m.Curve.belongsTo(m.Family, {as: 'LineProperty', foreignKey: 'idFamily'});

        m.Shading.belongsTo(m.Line, {foreignKey: 'idLeftLine', onDelete: 'CASCADE'});
        m.Shading.belongsTo(m.Line, {foreignKey: 'idRightLine', onDelete: 'CASCADE'});
        //m.Shading.belongsTo(m.Line, {foreignKey: {name: 'idRightLine', allowNull: false}, onDelete: 'CASCADE'});
        m.Shading.belongsTo(m.Curve, {foreignKey: 'idControlCurve'});

        m.CrossPlot.hasMany(m.Polygon, {foreignKey: {name: 'idCrossPlot', allowNull: false}, onDelete: 'CASCADE'});
        m.CrossPlot.hasMany(m.PointSet, {foreignKey: {name: 'idCrossPlot', allowNull: false}, onDelete: 'CASCADE'});
        m.CrossPlot.hasMany(m.Discrim, {foreignKey: {name: 'idCrossPlot', allowNull: false}, onDelete: 'CASCADE'});
        m.CrossPlot.hasMany(m.UserDefineLine, {
            foreignKey: {
                name: 'idCrossPlot',
                allowNull: false,
                onDelete: 'CASCADE'
            }
        });
        //m.CrossPlot.hasMany(m.Discrim, {foreignKey: {name: 'idCrossPlot', allowNull: true}});

        m.PointSet.belongsTo(m.Curve, {foreignKey: 'idCurveX'});
        m.PointSet.belongsTo(m.Curve, {foreignKey: 'idCurveY'});
        m.PointSet.belongsTo(m.Curve, {foreignKey: 'idCurveZ'});
        m.PointSet.belongsTo(m.Well, {foreignKey: {name: 'idWell', allowNull: false}, onDelete: 'CASCADE'});
        m.PointSet.belongsTo(m.ZoneSet, {foreignKey: {name : 'idZoneSet', allowNull: true}});

        m.Histogram.belongsTo(m.Curve, {foreignKey: 'idCurve'});
        m.Histogram.belongsTo(m.ZoneSet, {foreignKey: {name: 'idZoneSet', allowNull: true}});
        //m.Histogram.belongsTo(m.Well, {foreignKey: {name:'idWell',allowNull:false},onDelete:'CASCADE'});
        m.Histogram.hasMany(m.Discrim, {foreignKey: {name: 'idHistogram', allowNull: true, onDelete: 'CASCADE'}});

        m.Marker.belongsTo(m.Track, {foreignKey: {name: 'idTrack', allowNull: false, onDelete: 'CASCADE'}});
        m.Track.hasMany(m.Marker, {foreignKey: {name: 'idTrack', allowNull: false}, onDelete: 'CASCADE'});

        m.Discrim.belongsTo(m.Curve, {foreignKey: {name: 'idCurveLeft', allowNull: false}});
        m.Discrim.belongsTo(m.Curve, {foreignKey: {name: 'idCurveRight', allowNull: true}});

    })(object);

    object.sequelize = sequelize;

    var familyUpdate = require('../family/FamilyUpdater');
    var familyConditionUpdate = require('../family/FamilyConditionUpdater');

    // familyUpdate(object,function() {
    //     familyConditionUpdate(object,function(){
    //         // main();
    //     });
    // });//TODO
    //Register hook
    var Curve = object.Curve;
    var FamilyCondition = object.FamilyCondition;
    var Family = object.Family;
    var Dataset = object.Dataset;
    var Well = object.Well;
    var Project = object.Project;
    Curve.hook('afterCreate', function (curve, options) {
        ((curveName, unit) => {
            FamilyCondition.findAll()
                .then(conditions => {
                    var result = conditions.find(function (aCondition) {
                        return new RegExp("^" + aCondition.curveName + "$").test(curveName) && new RegExp("^" + aCondition.unit + "$").test(unit);
                    });
                    if (!result) {
                        return;
                    }
                    result.getFamily()
                        .then(aFamily => {
                            curve.setLineProperty(aFamily);
                        })
                })
        })(curve.name, curve.unit);
    });
    let username = dbName.substring(dbName.indexOf("_") + 1);
    Curve.hook('beforeDestroy', function (curve, options) {
        Dataset.findById(curve.idDataset).then(dataset => {
            Well.findById(dataset.idWell).then(well => {
                Project.findById(well.idProject).then(project => {
                    hashDir.deleteFolder(configCommon.curveBasePath, username + project.name + well.name + dataset.name + curve.name);
                });
            });

        }).catch(err => {
            console.log("ERR WHILE DELETE CURVE : " + err);
        });
    });
    //End register hook
    return object;
};
