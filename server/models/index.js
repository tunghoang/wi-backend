var Sequelize = require('sequelize');
var config=require('config').Database;


const sequelize = new Sequelize(config.dbName, config.user, config.password,{
    define: {
        freezeTableName: true
    },
    dialect: config.dialect,
    pool:{
        max:20,
        min:0,
        idle:200
    }
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
    'FamilyCondition'
];
models.forEach(function (model) {
    module.exports[model] = sequelize.import(__dirname + '/' + model);
});

(function (m) {
    m.Project_Well=m.Project.hasMany(m.Well,{foreignKey:"idProject",onDelete:'CASCADE'});
    m.Well_Dataset=m.Well.hasMany(m.Dataset, {foreignKey: "idWell", onDelete: 'CASCADE'});
    m.Well_Plot=m.Well.hasMany(m.Plot, {foreignKey: "idWell", onDelete: 'CASCADE'});

    m.Dataset_Curve=m.Dataset.hasMany(m.Curve, {foreignKey: "idDataset", onDelete: 'CASCADE'});
    m.Plot_Track=m.Plot.hasMany(m.Track, {foreignKey: "idPlot", onDelete: 'CASCADE'});
    m.Plot_DepthAxis=m.Plot.hasMany(m.DepthAxis, {foreignKey: "idPlot", onDelete: 'CASCADE'});

    m.Track.hasMany(m.Line,{foreignKey:"idTrack",onDelete:'CASCADE'});
    m.Line.belongsTo(m.Curve,{foreignKey:"idCurve",onDelete:'CASCADE'});

    m.FamilyCondition.belongsTo(m.Family, {foreignKey: 'idFamily'});
    m.Curve.belongsTo(m.Family, {as: 'LineProperty',foreignKey: 'idFamily'});
})(module.exports);
module.exports.sequelize = sequelize;