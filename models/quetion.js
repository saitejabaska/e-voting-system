"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Quetion extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }

    static getQuetions(electionID) {
      return this.findAll({
        where: {
          electionID,
        },
        order: [["id", "ASC"]],
      });
    }

    static addQuetion({ title, description, electionID }) {
      return this.create({
        title: title,
        description: description,
        electionID: electionID,
      });
    }

    static updateQuetion({ id, title, description }) {
      return this.update(
        { title, description },
        {
          where: {
            id,
          },
        }
      );
    }

    static remove(id) {
      this.destroy({
        where: {
          id,
        },
      });
    }
  }
  Quetion.init(
    {
      title: DataTypes.STRING,
      description: DataTypes.STRING,
      electionID: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Quetion",
    }
  );
  return Quetion;
};
