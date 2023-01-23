"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Voters", "role", {
      type: Sequelize.DataTypes.STRING,
      defaultValue: "voter",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Voters", "role");
  },
};
