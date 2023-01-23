"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Option extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
    static getOptions(queid) {
      return this.findAll({
        where: {
          queid,
        },
        order: [["id", "ASC"]],
      });
    }

    static addOption({ optionName, queid }) {
      console.log("id : ", queid);
      return this.create({
        optionName: optionName,
        queid: queid,
      });
    }

    updating(optionName) {
      console.log("value = ", optionName);
      return this.update({ optionName: optionName });
    }

    // static updateOption({ id, optionName }) {
    //   return this.update(
    //     { optionName },
    //     {
    //       where: {
    //         id,
    //       },
    //     }
    //   );
    // }

    static remove(id) {
      this.destroy({
        where: {
          id,
        },
      });
    }
  }
  Option.init(
    {
      optionName: DataTypes.STRING,
      queid: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Option",
    }
  );
  return Option;
};
