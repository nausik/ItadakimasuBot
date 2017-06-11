const Sequelize = require("sequelize");

module.exports = (sequelize_client) => {
    return sequelize_client.define('Log', {
        telegram_id: {
            type: Sequelize.BIGINT
        },
        food_name: {
            type: Sequelize.STRING
        },
        portions: {
            type: Sequelize.FLOAT
        },
        calories: {
            type: Sequelize.FLOAT
        },
        protein: {
            type: Sequelize.FLOAT
        },
        carbs: {
            type: Sequelize.FLOAT
        },
        fats: {
            type: Sequelize.FLOAT
        },
        log_date: {
            type: Sequelize.DATEONLY
        }
    });
}