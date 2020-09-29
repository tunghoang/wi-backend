let ErrorCodes = require('../../error-codes').CODES;
const ResponseJSON = require('../response');
let asyncLoop = require('async/each');
let asyncSeries = require('async/parallel');
let request = require('request');
let config = require('config');
let models = require('../models');
let openProject = require('../authenticate/opening-project');
let dbMaster = require('../models-master');
let async = require('async');
let mqtt = require('mqtt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid/v4');
const wiLog = require('@revotechuet/wi-logger');
const logger = new wiLog('./logs');

function createDefaultZoneSetTemplate(zoneSetTemplates, idProject, dbConnection) {
    return new Promise(resolve => {
        async.each(zoneSetTemplates, (zoneSetTemplate, nextZst) => {
            dbConnection.ZoneSetTemplate.create({
                name: zoneSetTemplate.name,
                idProject: idProject
            }).then(zst => {
                async.each(zoneSetTemplate.zone_templates, (zoneTemplate, nextZt) => {
                    dbConnection.ZoneTemplate.create({
                        idZoneSetTemplate: zst.idZoneSetTemplate,
                        name: zoneTemplate.name,
                        background: zoneTemplate.background,
                        foreground: zoneTemplate.foreground,
                        pattern: zoneTemplate.pattern,
                        orderNum: zoneTemplate.orderNum
                    }).then(() => {
                        nextZt();
                    }).catch(err => {
                        console.log(err);
                        nextZt();
                    })
                }, () => {
                    nextZst();
                })
            })
        }, function () {
            resolve();
        })
    });
}

function createDefaultMarkerSetTemplate(markerSetTemplates, idProject, dbConnection) {
    return new Promise(resolve => {
        async.each(markerSetTemplates, (markerSetTemplate, nextZst) => {
            dbConnection.MarkerSetTemplate.create({
                name: markerSetTemplate.name,
                idProject: idProject
            }).then(zst => {
                async.each(markerSetTemplate.marker_templates, (markerTemplate, nextZt) => {
                    dbConnection.MarkerTemplate.create({
                        idMarkerSetTemplate: zst.idMarkerSetTemplate,
                        name: markerTemplate.name,
                        color: markerTemplate.color,
                        lineStyle: markerTemplate.lineStyle,
                        lineWidth: markerTemplate.lineWidth,
                        orderNum: markerTemplate.orderNum,
                        description: markerTemplate.description
                    }).then(() => {
                        nextZt();
                    }).catch(err => {
                        console.log(err);
                        nextZt();
                    })
                }, () => {
                    nextZst();
                })
            })
        }, function () {
            resolve();
        })
    });
}

function validationFlow(idFlow, dbConnection) {
    return new Promise((resolve => {
        dbConnection.Flow.findByPk(idFlow, { include: { model: dbConnection.Task } }).then(flow => {
            let content = flow.content;
            async.each(flow.tasks, (task, next) => {
                let name = task.name;
                let newId = task.idTask;
                let regex = new RegExp(`(name="${name}".+?idTask=")\\d+?(")`);
                content = content.replace(regex, '$1' + newId + '$2');
                next();
            }, () => {
                flow.content = content;
                flow.save().then((a) => {
                    resolve();
                }).catch(err => {
                    resolve();
                });
            });
        });
    }))
}

function createNewFlowTemplate(flows, idProject, dbConnection, createdBy) {
    return new Promise(resolve => {
        async.each(flows, (flow, nextFlow) => {
            dbConnection.Flow.create({
                name: flow.name,
                idProject: idProject,
                content: flow.content,
                description: "Create from system",
                isTemplate: true,
                createdBy: createdBy,
                updatedBy: createdBy
            }).then(fl => {
                async.each(flow.tasks, (task, nextTask) => {
                    dbConnection.Task.create({
                        idProject: idProject,
                        idFlow: fl.idFlow,
                        name: task.name,
                        content: task.content,
                        description: "Create from system",
                        createdBy: createdBy,
                        updatedBy: createdBy,
                        idTaskSpec: task.idTaskSpec
                    }).then(() => {
                        nextTask()
                    }).catch(err => {
                        console.log(err);
                        nextTask()
                    })
                }, () => {
                    validationFlow(fl.idFlow, dbConnection).then(() => {
                        nextFlow()
                    });
                })
            }).catch(err => {
                console.log(err);
                nextFlow();
            });
        }, function () {
            resolve();
        });
    });
}

function createDefaultPramSet(idProject, dbConnection, user) {
    return new Promise((resolve => {
        dbMaster.ParameterSet.findAll().then(pss => {
            async.each(pss, (ps, next) => {
                dbConnection.ParameterSet.create({
                    name: ps.name,
                    content: ps.content,
                    type: ps.type,
                    note: ps.note,
                    createdBy: user,
                    updatedBy: user,
                    idProject: idProject
                }).then(() => {
                    next();
                }).catch(() => {
                    next();
                });
            }, () => {
                resolve();
            });
        });
    }));
}

function createNewProject(projectInfo, done, dbConnection, username, company) {
    let Project = dbConnection.Project;
    projectInfo.alias = projectInfo.alias || projectInfo.name;
    Project.sync()
        .then(function () {
            return Project.create(projectInfo);
        })
        .then(async function (project) {
            let zsts = await dbConnection.ZoneSetTemplate.findAll({
                where: { idProject: null },
                include: { model: dbConnection.ZoneTemplate }
            });
            let msks = await dbConnection.MarkerSetTemplate.findAll({
                where: { idProject: null },
                include: { model: dbConnection.MarkerTemplate }
            });
            await createDefaultZoneSetTemplate(zsts, project.idProject, dbConnection);
            await createDefaultMarkerSetTemplate(msks, project.idProject, dbConnection);
            await createStorageIfNotExsited({ idProject: project.idProject, storage_location: projectInfo.storage_location }, dbConnection, username, company);
            await createDefaultPramSet(project.idProject, dbConnection, username);
            done(ResponseJSON(ErrorCodes.SUCCESS, "Create new project success", project));
        })
        .catch(function (err) {
            if (err.name === "SequelizeUniqueConstraintError") {
                done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Project's name already exists"));
            } else {
                done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, err.message, err.message));
            }
        });
};

function editProject(projectInfo, done, dbConnection) {
    delete projectInfo.createdBy;
    let Project = dbConnection.Project;
    Project.findByPk(projectInfo.idProject)
        .then(function (project) {
            project.name = projectInfo.name;
            project.company = projectInfo.company;
            project.department = projectInfo.department;
            project.description = projectInfo.description;
            project.updatedBy = projectInfo.updatedBy;
            project.alias = projectInfo.alias;
            project.save()
                .then(function () {
                    logger.info({username: projectInfo.updatedBy, project: projectInfo.idProject, message: "Updated project " + projectInfo.name});
                    done(ResponseJSON(ErrorCodes.SUCCESS, "Edit Project success", projectInfo));
                })
                .catch(function (err) {
                    logger.info({username: projectInfo.updatedBy, project: projectInfo.idProject, message: err});
                    if (err.name === "SequelizeUniqueConstraintError") {
                        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Project's name already exists"));
                    } else {
                        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, err.message, err.message));
                    }
                })
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Project not found for edit"));
        })
}

function getProjectInfo(project, done, dbConnection) {
    let Project = dbConnection.Project;
    Project.findByPk(project.idProject)
        .then(function (project) {
            if (!project) throw "not exits";
            done(ResponseJSON(ErrorCodes.SUCCESS, "Get info Project success", project));
        })
        .catch(function () {
            done(ResponseJSON(ErrorCodes.ERROR_ENTITY_NOT_EXISTS, "Project not found for getInfo"));
        });
}

function getSharedProject(token, username) {
    return new Promise(function (resolve, reject) {
        let options = {
            method: 'POST',
            url: (process.env.BACKEND_AUTH_SERVICE || config.Service.authenticate) + '/shared-project/list',
            headers: {
                'Cache-Control': 'no-cache',
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: { username: username },
            json: true,
            strictSSL: false
        };
        request(options, function (error, response, body) {
            if (error) {
                console.log(error);
                resolve([]);
            } else {
                resolve(body.content);
            }
        });
    });
}

async function getDatabases() {
    const modelMaster = require('../models-master');
    const sequelize = require('sequelize');
    let result = [];
    let dbs = await modelMaster.sequelize.query("SHOW DATABASES LIKE '" + (process.env.BACKEND_DBPREFIX || config.Database.prefix) + "%'", { type: sequelize.QueryTypes.SELECT });
    dbs.forEach(db => {
        result.push(db[Object.keys(db)]);
    });
    return result;
}

function getRandomHash() {
    const current_date = (new Date()).valueOf().toString();
    const random = Math.random().toString();
    return (crypto.createHash('sha1').update(current_date + random).digest('hex'));
}

function createStorageIfNotExsited(project, dbConnection, username, company) {
    let idProject = project.idProject;
    return new Promise(resolve => {
        dbConnection.StorageDatabase.findAll({ where: { idProject: idProject } }).then(sd => {
            if (!sd || sd.length === 0) {
                dbConnection.StorageDatabase.create({
                    idProject: idProject,
                    name: company + "-" + username,
                    company: company,
                    input_directory: project.storage_location || getRandomHash(),
                    createdBy: username,
                    updatedBy: username
                }).then(() => {
                    resolve();
                }).catch(err => {
                    console.log(err);
                    resolve();
                })
            } else {
                resolve();
            }
        })
    });
}

async function getProjectList(payload, done, dbConnection, username, realUser, token, company, role) {
    if (payload.username && (role <= 1 || role === 3)) {
        dbConnection = models((process.env.BACKEND_DBPREFIX || config.Database.prefix) + payload.username, (err) => {
            done(ResponseJSON(ErrorCodes.SUCCESS, "Err", err));
        });
        dbConnection.Project.findAll({
            include: { model: dbConnection.StorageDatabase },
            order: ['alias']
        }).then(projects => {
            done(ResponseJSON(ErrorCodes.SUCCESS, "Done", projects));
        });
    } else {
        let databasesList = await getDatabases();
        dbConnection = models((process.env.BACKEND_DBPREFIX || config.Database.prefix) + realUser);
        let response = [];
        let projectList = await getSharedProject(token, realUser);
        let Project = dbConnection.Project;
        Project.findAll({
            order: ['alias']
        }).then(function (projects) {
            asyncLoop(projects, function (project, next) {
                project = project.toJSON();
                project.displayName = project.alias || project.name;
                response.push(project);
                createStorageIfNotExsited({ idProject: project.idProject }, dbConnection, username, company).then(() => {
                    next();
                });
            }, function () {
                if (projectList.length > 0) {
                    asyncLoop(projectList, function (prj, next) {
                        let dbName = (process.env.BACKEND_DBPREFIX || config.Database.prefix) + prj.owner;
                        if (databasesList.indexOf(dbName) !== -1) {
                            let shareDbConnection = models(dbName);
                            shareDbConnection.Project.findOne({ where: { name: prj.name } }).then(p => {
                                if (!p) {
                                    next();
                                } else {
                                    p = p.toJSON();
                                    let name = p.alias || p.name;
                                    p.displayName = name + '   || ' + prj.owner + ' || ' + prj.group;
                                    p.shared = true;
                                    p.owner = prj.owner;
                                    response.push(p);
                                    next();
                                }
                            });
                        } else {
                            next();
                        }
                    }, function () {
                        done(ResponseJSON(ErrorCodes.SUCCESS, "Get List Project success", response));
                    });
                } else {
                    done(ResponseJSON(ErrorCodes.SUCCESS, "Get List Project success", response));
                }
            });

        }).catch(err => {
            console.log(err);
            done(ResponseJSON(ErrorCodes.INTERNAL_SERVER_ERROR, "NO_DATABASE"));
        });
    }
}

function deleteProject(projectInfo, done, dbConnection) {
    const sequelize = require('sequelize');
    let dbName = (process.env.BACKEND_DBPREFIX || config.Database.prefix) + projectInfo.owner;
    let query = "DELETE FROM " + dbName + ".project WHERE idProject = " + projectInfo.idProject;
    dbConnection.sequelize.query(query, { type: sequelize.QueryTypes.UPDATE }).then(rs => {
        logger.info({username: projectInfo.idProject, project: projectInfo.idProject, message: "Project deleted"})
        done(ResponseJSON(ErrorCodes.SUCCESS, "Done", rs));
    }).catch(err => {
        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Error", err));
    });
}

function updatePermission(req, done) {
    let userPermission = require('../utils/permission/user-permission');
    userPermission.loadUserPermission(req.token, req.body.project_name, req.body.username).then(() => {
        done(ResponseJSON(ErrorCodes.SUCCESS, "Successful " + req.body.username));
    });
}

async function getProjectFullInfo(payload, done, req) {
    let userPermission = require('../utils/permission/user-permission');
    if (payload.shared && payload.shared.toString() === 'true') {
        // console.log("LOAD SHARED PROJECT");
        await userPermission.loadUserPermission(req.token, payload.name, req.decoded.realUser);
        await openProject.removeRow({ username: req.decoded.realUser, client: req.get("WHOAMI") });
        await openProject.addRow({ username: req.decoded.realUser, project: payload.name, owner: payload.owner, client: req.get("WHOAMI") });
        req.dbConnection = models((process.env.BACKEND_DBPREFIX || config.Database.prefix) + payload.owner.toLowerCase());
    } else {
        // console.log("LOAD USER PROJECT");
        await userPermission.loadUserPermission(req.token, payload.name, req.decoded.realUser, true);
        await openProject.removeRow({ username: req.decoded.realUser, client: req.get("WHOAMI") });
        req.dbConnection = models((process.env.BACKEND_DBPREFIX || config.Database.prefix) + req.decoded.realUser);
    }
    let dbConnection = req.dbConnection;
    let project = await dbConnection.Project.findByPk(payload.idProject);
    if (!project) return done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "Project not found"));

    let response = project.toJSON();
    response.owner = payload.owner ? payload.owner : null;
    response.shared = payload.shared ? payload.shared : null;
    let wells = await dbConnection.Well.findAll({ where: { idProject: project.idProject } });
    let groups = await dbConnection.Groups.findAll({ where: { idProject: project.idProject } });
    let plots = await dbConnection.Plot.findAll({ where: { idProject: project.idProject } });
    let crossplots = await dbConnection.CrossPlot.findAll({ where: { idProject: project.idProject } });
    let histograms = await dbConnection.Histogram.findAll({ where: { idProject: project.idProject } });
    let combined_boxes = await dbConnection.CombinedBox.findAll({ where: { idProject: project.idProject } });
    let storage_databases = await dbConnection.StorageDatabase.findAll({ where: { idProject: project.idProject } });
    response.wells = [];
    response.groups = groups;
    response.plots = plots;
    response.crossplots = crossplots;
    response.histograms = histograms;
    response.combined_boxes = combined_boxes;
    response.storage_databases = storage_databases;
    if (wells.length === 0) {
        return done(ResponseJSON(ErrorCodes.SUCCESS, "Get full info Project success", response));
    }
    asyncLoop(wells, function (well, nextWell) {
        let wellObj = well.toJSON();
        asyncSeries([
            function (cb) {
                dbConnection.Dataset.findAll({ where: { idWell: well.idWell } }).then(datasets => {
                    let datasetArr = [];
                    asyncLoop(datasets, function (dataset, nextDataset) {
                        let datasetObj = dataset.toJSON();
                        dbConnection.Curve.findAll({
                            where: { idDataset: dataset.idDataset },
                            include: {
                                model: dbConnection.Family,
                                as: "LineProperty",
                                include: {
                                    model: dbConnection.FamilySpec,
                                    as: "family_spec",
                                    // where: {
                                    //     isDefault: true
                                    // }
                                }
                            }
                        }).then(curves => {
                            let curveArr = [];
                            asyncLoop(curves, function (curve, nextCurve) {
                                let curveObj = curve.toJSON();
                                if (curveObj.LineProperty) {
                                    Object.assign(curveObj.LineProperty, curveObj.LineProperty.family_spec[0]);
                                    delete curveObj.LineProperty.family_spec;
                                }
                                curveArr.push(curveObj);
                                nextCurve();
                            }, function () {
                                datasetObj.curves = curveArr;
                                datasetArr.push(datasetObj);
                                nextDataset();
                            });
                        });
                    }, function () {
                        cb(null, datasetArr);
                    });
                });
            },
            function (cb) {
                dbConnection.ZoneSet.findAll({
                    where: { idWell: well.idWell },
                    include: [{
                        model: dbConnection.Zone,
                        include: { model: dbConnection.ZoneTemplate }
                    }, { model: dbConnection.ZoneSetTemplate }]
                }).then(zonesets => {
                    cb(null, zonesets);
                });
            },
            function (cb) {
                dbConnection.WellHeader.findAll({ where: { idWell: well.idWell } }).then(headers => {
                    cb(null, headers);
                });
            },
            function (cb) {
                dbConnection.MarkerSet.findAll({
                    where: { idWell: well.idWell },
                    include: [{
                        model: dbConnection.Marker,
                        include: { model: dbConnection.MarkerTemplate }
                    }, { model: dbConnection.MarkerSetTemplate }]
                }).then(markersets => {
                    cb(null, markersets);
                });
            },
            function (cb) {
                dbConnection.ImageSet.findAll({
                    where: { idWell: well.idWell },
                    include: { model: dbConnection.Image }
                }).then(imagesets => {
                    cb(null, imagesets);
                });
            }
        ], function (err, result) {
            wellObj.datasets = result[0];
            wellObj.zonesets = result[1];
            wellObj.wellheaders = result[2];
            wellObj.markersets = result[3];
            wellObj.imagesets = result[4];
            response.wells.push(wellObj);
            nextWell();
        });
    }, function () {
        done(ResponseJSON(ErrorCodes.SUCCESS, "Get full info Project success", response));
    });
}

function genLocationOfNewProject() {
    return "";
}

function closeProject(req, done, dbConnection, username) {
    // await openProject.removeRow({ username: req.decoded.realUser, client: req.get("WHOAMI") });
    let openingProject = require('../authenticate/opening-project');
    openingProject.removeRow({ username: username, client: req.get("WHOAMI") }).then(() => {
        done(ResponseJSON(ErrorCodes.SUCCESS, "Successful", req.body));
    });
}

function getAllSharedProject(token) {
    return new Promise(function (resolve, reject) {
        let options = {
            method: 'POST',
            url: (process.env.BACKEND_AUTH_SERVICE || config.Service.authenticate) + '/shared-project/all',
            headers: {
                'Cache-Control': 'no-cache',
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: {},
            json: true,
            strictSSL: false
        };
        request(options, function (error, response, body) {
            if (error) {
                console.log(error);
                resolve([]);
            } else {
                resolve(body.content);
            }
        });
    });
}

async function listProjectOffAllUser(payload, done, dbConnection, token) {
    let sharedProjectList = await getAllSharedProject(token);
    let dbs = payload.users ? payload.users = payload.users.map(u => (process.env.BACKEND_DBPREFIX || config.Database.prefix) + u) : [];
    const sequelize = require('sequelize');
    getDatabases().then(databaseList => {
        let response = [];
        asyncLoop(databaseList, (db, next) => {
            if (dbs.indexOf(db) !== -1) {
                let query = "SELECT * FROM `" + db + "`.project";
                dbConnection.sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(projects => {
                    projects.forEach(project => {
                        if (!response.find(p => p.name === project.name && p.createdBy === project.createdBy)) {
                            let shared = sharedProjectList.find(s => s.project_name === project.name && s.user.username === project.createdBy);
                            if (shared) {
                                project.groups = shared.groups;
                                project.shareKey = shared.shareKey;
                            }
                            response.push(project);
                        }
                    });
                    next();
                }).catch(err => {
                    console.log("LOI : ", query);
                });
            } else {
                next();
            }
        }, function () {
            done(ResponseJSON(ErrorCodes.SUCCESS, "Done", response));
        });
    });
}

function deleteProjectOwner(payload, done, dbConnection) {
    dbConnection.Project.findByPk(payload.idProject).then(p => {
        if (p) {
            p.destroy().then(() => {
                done(ResponseJSON(ErrorCodes.SUCCESS, "Done", p));
            }).catch(err => {
                done(ResponseJSON(ErrorCodes.SUCCESS, "Error while delete project", err));
            });
        } else {
            done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, "No project found by id"));
        }
    })
}

function listProjectByUser(payload, done, dbConnection) {
    const sequelize = require('sequelize');
    let query = "SELECT * FROM `" + (process.env.BACKEND_DBPREFIX || config.Database.prefix) + payload.username + "`.project";
    dbConnection.sequelize.query(query, { type: sequelize.QueryTypes.SELECT }).then(projects => {
        done(ResponseJSON(ErrorCodes.SUCCESS, "Done", projects));
    }).catch(err => {
        console.log("LOI : ", query);
        done(ResponseJSON(ErrorCodes.SUCCESS, "Error", []));
    });
}


function exportProject(payload, done, dbConnection, username) {
    // const id = uuidv4();
    const id = "mmmmm";
    if (!fs.existsSync(path.join(config.exportPath, '__Project'))) fs.mkdirSync(path.join(config.exportPath, '__Project'));
    const projectExportePath = path.join(config.exportPath, '__Project', id);
    fs.mkdirSync(projectExportePath);
    let projectObj = {};
    async.waterfall([
        function (callback) {
            dbConnection.Project.findById(dbConnection.idProject).then(project => {
                projectObj = project.toJSON();
                callback(null, project);
            });
        },
        function (project, callback) {
            // do well
            callback(null, project)
        },
        function (project, callback) {
            // do logplots
            callback(null, project)
        },
        function (project, callback) {
            // do histogram
            callback(null, project)
        },
        function (project, callback) {
            // do cross plots
            callback(null, project)
        },
        function (project, callback) {
            // do zone set template
            callback()
        }
    ], () => {

    });

    done(ResponseJSON(ErrorCodes.SUCCESS, "Done", id));
    // let mqttClient = require('../utils/mqtt');
    // if (mqttClient) {
    // 	mqttClient.publish("hello", dbConnection.Project.toString());
    // } else {
    // 	console.log("No mqtt");
    // }
}

function addShareSession(req, done, dbConnection, username) {
    openProject.addRow({
        username: req.decoded.realUser || req.body.username || username,
        client: req.body.client || req.get("WHOAMI"),
        project: req.body.name || req.body.project,
        owner: req.body.owner
    }).then(async r => {
        let userPermission = require('../utils/permission/user-permission');
        await userPermission.loadUserPermission(req.token, req.body.name || req.body.project, req.decoded.realUser);
        return done(ResponseJSON(ErrorCodes.SUCCESS, "Done", r));
    }).catch(e => {
        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, e.message, e))
    });
}

function removeShareSession(req, done, dbConnection, username) {
    openProject.removeRow({
        username: username,
        client: req.get("WHOAMI")
    }).then(async r => {
        let userPermission = require('../utils/permission/user-permission');
        await userPermission.loadUserPermission(req.token, req.body.name || req.body.project, req.decoded.realUser, true);
        return done(ResponseJSON(ErrorCodes.SUCCESS, "Done", r));
    }).catch(e => {
        done(ResponseJSON(ErrorCodes.ERROR_INVALID_PARAMS, e.message, e))
    })
}


module.exports = {
    createNewProject: createNewProject,
    editProject: editProject,
    getProjectInfo: getProjectInfo,
    getProjectList: getProjectList,
    deleteProject: deleteProject,
    getProjectFullInfo: getProjectFullInfo,
    closeProject: closeProject,
    updatePermission: updatePermission,
    listProjectOffAllUser: listProjectOffAllUser,
    deleteProjectOwner: deleteProjectOwner,
    validationFlow: validationFlow,
    listProjectByUser: listProjectByUser,
    exportProject: exportProject,
    addShareSession: addShareSession,
    removeShareSession: removeShareSession
};
