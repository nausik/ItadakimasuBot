module.exports = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    REDIS_URL: process.env.REDIS_URL,
    SEQUELIZE_URL: process.env.DATABASE_URL,
    CLARIFAI: {
    	'appId': process.env.CLARIFAI_APPID,
    	'appSecret': process.env.CLARIFAI_SECRET
    },
    NUTRIONIX_CREDENTIALS: {
        'appId': process.env.NUTRIONIX_APPID,
        'appKey': process.env.NUTRIONIX_APPKEY
    }
}