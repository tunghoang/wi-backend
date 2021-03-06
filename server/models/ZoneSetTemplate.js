module.exports = function (sequelize, DataTypes) {
    return sequelize.define('zone_set_template', {
        idZoneSetTemplate: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(200),
            allowNull: false,
            unique: "name-idProject"
        },
        createdBy: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: 'system-init'
        },
        updatedBy: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: 'system-init'
        }
    });
};
