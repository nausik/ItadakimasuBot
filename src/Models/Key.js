const Sequelize = require("sequelize");

module.exports = (sequelize_client) => {
    return sequelize_client.define('Key', {
        telegram_id: {
            type: Sequelize.BIGINT
        },
        stats_key: {
            type: Sequelize.STRING,
            unique: true
        },
        expiration_date: {
            type: Sequelize.DATE
        }
    });
}