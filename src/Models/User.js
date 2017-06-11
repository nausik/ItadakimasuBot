const Sequelize = require("sequelize");

module.exports = (sequelize_client) => {
    return sequelize_client.define('User', {
        telegram_id: {
            unique: true,
            type: Sequelize.BIGINT
        },
        daily_calories: {
            type: Sequelize.FLOAT
        },
        daily_protein: {
            type: Sequelize.FLOAT
        },
        daily_carbs: {
            type: Sequelize.FLOAT
        }
    });
}