"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Election extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Election.hasMany(models.Voter, {
        foreignKey: "electionId",
      });

      Election.belongsTo(models.Admin, {
        foreignKey: "adminId",
      });
    }

    launchElection() {
      return this.update({ launch: true, end: false });
    }

    endElection() {
      return this.update({ launch: false, end: true });
    }

    static getElection(id) {
      return this.findAll({
        where: {
          adminId: id,
        },
        order: [["id", "ASC"]],
      });
    }

    static findElectionByUrl(url) {
      return this.findOne({
        where: {
          url: url,
        },
        order: [["id", "ASC"]],
      });
    }

    static addElection({ title, url, adminId }) {
      return this.create({
        title: title,
        url: url,
        adminId,
        launch: false,
        end: false,
      });
    }

    static updateElection({ id, title, url, adminId }) {
      return this.update(
        { title, url },
        {
          where: {
            id,
            adminId,
          },
        }
      );
    }

    static remove(id, adminId) {
      this.destroy({
        where: {
          id,
          adminId,
        },
      });
    }
  }
  Election.init(
    {
      title: DataTypes.STRING,
      url: DataTypes.STRING,
      launch: DataTypes.BOOLEAN,
      end: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Election",
    }
  );
  return Election;
};
