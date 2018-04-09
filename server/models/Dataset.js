module.exports = function (sequelize, DataTypes) {
    return sequelize.define('dataset', {
        idDataset: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: "name-idWell"
        },
        datasetKey: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        datasetLabel: {
            type: DataTypes.STRING(250),
            allowNull: true
        },
        duplicated: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        createdBy: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        updatedBy: {
            type: DataTypes.STRING(50),
            allowNull: false
        }
    }, {
        paranoid: true
    });
};
