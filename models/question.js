"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class question extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      question.belongsTo(models.Election, {
        foreignKey: "electionID",
      });
      question.hasMany(models.Option, {
        foreignKey: "questionID",
      });
    }

    static async add(title, description, electionID) {
      const res = await question.create({
        title: title,
        description: description,
        electionID: electionID,
      });
      return res;
    }

    static async edit(title, desctiption, questionID) {
      const res = await question.update(
        {
          title: title,
          description: desctiption,
        },
        {
          where: {
            id: questionID,
          },
        }
      );
      return res;
    }
  }
  question.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
        },
      },
      description: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "question",
    }
  );
  return question;
};
