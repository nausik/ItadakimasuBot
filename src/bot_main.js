(function() {
    "use strict";

    const Bot = require('node-telegram-bot-api'),
        Moment = require('moment'),
        _ = require('underscore'),
        Sequelize = require("sequelize"),
        Sugar = require('sugar-date'),
        Keys = require('./keys'),
        Utils = require('./utils'),
        Session = require('./session'),
        Nutrionix = require('./nutrionix')(Keys.NUTRIONIX_CREDENTIALS),
        Config = require('./config'),
        Clarifai = require('clarifai');

    const session = new Session(),
        clarifai = new Clarifai.App(Keys.CLARIFAI.appId, Keys.CLARIFAI.appSecret),
        bot = new Bot(Keys.TELEGRAM_TOKEN, {
            polling: true
        }),
        sequelize_client = new Sequelize(Keys.SEQUELIZE_URL);

    const DB = {
        User: require('./Models/User')(sequelize_client),
        Log: require('./Models/Log')(sequelize_client),
        Key: require('./Models/Key')(sequelize_client)
    };

    sequelize_client.sync({
        force: false
    });

    bot.on('callback_query', processMessages);
    bot.onText(/^(?!\/).+/, processMessages);
    bot.onText(/\/start\b/, createNewUser);
    bot.onText(/\/stats\b/, giveStats);
    bot.onText(/\/help\b/, showHelp);
    bot.onText(/\/norms\b/, showNorms);
    bot.onText(/\/log (.+)/, logByName);

    function logByName(msg, match) {
        const chatId = msg.chat.id,
            food_name = match[1];

        findSpecificTypes(food_name, chatId);
    }

    function showNorms(msg) {
        const chatId = msg.chat.id;

        DB.User.findOne({
            where: {
                telegram_id: chatId
            }
        }).then((data) => {
            bot.sendMessage(chatId, `Your daily norms are: *${data.daily_calories}* calories, *${data.daily_protein}*g of protein and *${data.daily_carbs}*g of carbs. Do you want to change them?`, {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: 'Yes',
                            callback_data: 'yes'
                        }],
                        [{
                            text: 'No',
                            callback_data: 'no'
                        }]
                    ]
                }
            });

            session.setBotState(chatId, "change_norms");
        });
    }

    function changeNorms(chatId) {
        bot.sendMessage(chatId, `Do you want me to calculate your goals or do you want to set them manually?`, {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Calculate',
                        callback_data: 'calculate'
                    }],
                    [{
                        text: 'Manual',
                        callback_data: 'manual'
                    }]
                ]
            }
        });
    }

    function findSpecificTypes(food_name, chatId) {
        session.setTemporaryInfo(chatId, 'food_name', food_name).then(function(data) {
            return Nutrionix.searchNutrionix(food_name)
        }).then((data) => {
            return bot.sendMessage(chatId, `You ate a ${food_name}. Please, select specific type`, {
                reply_markup: {
                    inline_keyboard: generateNutrionixKeyboard(_.pluck(data.hits, 'fields'))
                }
            });

        }).then(function(data) {
            session.setBotState(chatId, "select_type");
        })
    }

    function showHelp(msg) {
        const chatId = msg.chat.id;

        bot.sendMessage(chatId, `My name is ${Config.BOT_NAME} and my job is to help you maintain your diet. \n What makes me special is that I actually can recognize the food you ate by the photo, so instead of sending me text messages, just try sending me a photo \n` +
            `\n *List of command:* \n \n */log :food name:* - Log food in text format \n \n */stats* - Show your daily and monthly statistics \n  \n */norms* - Check and change your daily norms`, {
                parse_mode: "Markdown"
            });
    }

    function giveStats(msg) {
        const chatId = msg.chat.id;

        generateKey(chatId).then((key) => {
            bot.sendMessage(chatId, `[Press here to open your stats](${Config.URL}/stats/${key})`, {
                parse_mode: "Markdown"
            });
        });
    }

    function createNewUser(msg) {
        const chatId = msg.chat.id,
            answer = msg.text;

        bot.sendMessage(chatId, `Hello, my name is *${Config.BOT_NAME}*! Let's get you started`, {
            parse_mode: "Markdown"
        });

        changeNorms(chatId);
        session.setBotState(chatId, "calculate_goals");
    }


    function processMessages(msg) {
        let chatId, answer;

        //Since inline keyboard requires callback_query, we have to check
        if (typeof msg.message === 'undefined') {
            chatId = msg.chat.id;
            answer = msg.text;
        } else {
            chatId = msg.message.chat.id;
            answer = msg.data;
        }

        answer = Utils.prepareAnswer(answer);

        session.getBotState(chatId).then((redis_value) => {
            switch (redis_value) {
                case "select_meal":
                    if (answer === "other") {
                        bot.sendMessage(chatId, "Please, enter the name of the food you ate");
                    } else {
                        findSpecificTypes(answer, chatId);
                    }
                    break;

                case 'change_norms':
                    if (answer === 'yes') {
                        changeNorms(chatId);
                    } else if (answer === 'no') {
                        session.setBotState(chatId, "start");
                    }
                    break;

                case "select_type":
                    Nutrionix.getInfoNutrionix(answer).then((data) => {

                        //change all NULL values to 0
                        data = validateNutritions(data);

                        session.setTemporaryInfo(chatId, {
                            protein: data.nf_protein,
                            fats: data.nf_total_fat,
                            calories: data.nf_calories,
                            carbs: data.nf_total_carbohydrate
                        });

                        bot.sendMessage(chatId, `*${data.item_name}* contains *${data.nf_calories}* calories, *${data.nf_total_fat}*g of fat, *${data.nf_protein}*g of protein and *${data.nf_total_carbohydrate}*g of carbohydrate. Is that right?`, {
                            parse_mode: "Markdown",
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: 'Yes',
                                        callback_data: 'yes'
                                    }],
                                    [{
                                        text: 'No',
                                        callback_data: 'no'
                                    }]
                                ]
                            }
                        });
                    });

                    session.setBotState(chatId, "nutrition_verify");

                    break;

                case "nutrition_verify":
                    if (answer === 'yes') {
                        bot.sendMessage(chatId, 'When did you eat it?');
                        session.setBotState(chatId, "set_portion");
                    } else if (answer === 'no') {
                        bot.sendMessage(chatId, "How many calories your meal contains?");
                        session.setBotState(chatId, "set_protein");
                    }

                    break;

                case "set_protein":
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'calories', answer);

                        bot.sendMessage(chatId, "How much protein (g) your meal contains?");
                        session.setBotState(chatId, "set_carbs");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;

                case "set_carbs":
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'protein', answer);

                        bot.sendMessage(chatId, "How much carbs (g) your meal contains?");
                        session.setBotState(chatId, "set_fats");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;

                case "set_fats":
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'carbs', answer);

                        bot.sendMessage(chatId, "How much fats (g) your meal contains?");
                        session.setBotState(chatId, "set_date");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;

                case 'set_date':
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'fats', answer);

                        bot.sendMessage(chatId, 'When did you eat it?');
                        session.setBotState(chatId, "set_portion");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;

                case 'set_portion':
                    let sugar_date = Sugar.Date.create(answer);

                    if (Utils.isValidDate(sugar_date)) {
                        session.setTemporaryInfo(chatId, 'date', Sugar.Date.format(sugar_date, '%Y-%m-%d'));
                        bot.sendMessage(chatId, 'How many portions did you eat?');
                        session.setBotState(chatId, "validate");
                    } else {
                        bot.sendMessage(chatId, "Sorry, I couldn't understand your date");
                    }

                    break;

                case 'validate':
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'portions', answer);

                        session.getAllTemporaryInfo(chatId).then((data) => {
                            bot.sendMessage(chatId, `You ate *${data.portions}* *${data.food_name}* on *${data.date}* It contains *${data.calories}* calories, *${data.fats}*g of fats and *${data.protein}*g of protein and *${data.carbs}*g of carbohydrate. Is that right?`, {
                                parse_mode: "Markdown",
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'Yes',
                                            callback_data: 'yes'
                                        }],
                                        [{
                                            text: 'No',
                                            callback_data: 'no'
                                        }]
                                    ]
                                }
                            });

                            session.setBotState(chatId, "finish");
                        });

                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;

                case "finish":
                    if (answer === 'yes') {
                        session.getAllTemporaryInfo(chatId).then((food_obj) => {

                            return DB.Log.create({
                                food_name: food_obj.food_name,
                                portions: food_obj.portions,
                                calories: food_obj.calories,
                                protein: food_obj.protein,
                                carbs: food_obj.carbs,
                                fats: food_obj.fats,
                                log_date: food_obj.date,
                                telegram_id: chatId
                            });

                        }).then(() => {
                            session.clearFields(chatId, ['calories', 'portions', 'protein', 'carbs', 'fats', 'log_date', 'food_name']);

                            bot.sendMessage(chatId, 'Thanks! I just logged your food');
                            session.setBotState(chatId, "start");
                        });
                    } else if (answer === 'no') {
                        bot.sendMessage(chatId, "How many calories your meal contains?");
                        session.setBotState(chatId, "set_protein");
                    }

                    break;

                case 'calculate_goals':
                    if (answer === 'calculate') {
                        bot.sendMessage(chatId, 'Are you *male* or *female*?', {
                            parse_mode: "Markdown",
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: 'Female',
                                        callback_data: 'female'
                                    }],
                                    [{
                                        text: 'Male',
                                        callback_data: 'male'
                                    }]
                                ]
                            }
                        });

                        session.setBotState(chatId, "set_sex");
                    } else if (answer === 'manual') {
                        bot.sendMessage(chatId, "Please, send me your daily goal of calories");
                        session.setBotState(chatId, "set_daily_calories");
                    }

                    break;

                case 'set_sex':
                    if (Utils.inArray(answer, ['male', 'female'])) {
                        session.setTemporaryInfo(chatId, 'sex', answer);
                        bot.sendMessage(chatId, "What's your *weight* (*kg*)?", {
                            parse_mode: "Markdown"
                        });
                        session.setBotState(chatId, "set_weight");
                    } else {
                        endMessage(chatId, "Sorry, I could not understand your answer");
                    }
                    break;

                case 'set_weight':
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'weight', answer);

                        bot.sendMessage(chatId, "What's your *height* (*cm*)?", {
                            parse_mode: "Markdown"
                        });
                        session.setBotState(chatId, "set_height");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }
                    break;

                case 'set_height':
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'height', answer);

                        bot.sendMessage(chatId, 'Please, send me your *age* (*full years*)', {
                            parse_mode: "Markdown"
                        });
                        session.setBotState(chatId, "set_age");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }
                    break;

                case 'set_age':
                    //age is > 0
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'age', answer);

                        bot.sendMessage(chatId, 'How active are you?', {
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: 'Low',
                                        callback_data: '1.375'
                                    }],
                                    [{
                                        text: 'Moderate',
                                        callback_data: '1.55'
                                    }],
                                    [{
                                        text: 'High',
                                        callback_data: '1.725'
                                    }],
                                    [{
                                        text: 'Very High',
                                        callback_data: '1.9'
                                    }]
                                ]
                            }
                        });

                        session.setBotState(chatId, "calculate_norms");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }
                    break;

                case 'calculate_norms':
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'activity_level', answer).then((answer) => {
                            return session.getAllTemporaryInfo(chatId);
                        }, () => {
                            bot.sendMessage(chatId, "Sorry, I have some problems right now");
                        }).then((user_obj) => {
                            let calories_goal = Utils.calculateCaloriesNorm(user_obj),
                                protein_goal = Utils.calculateProteinNorm(user_obj),
                                carbs_goal = Utils.calculateCarbsNorm(user_obj);

                            bot.sendMessage(chatId, `Your daily norms are: *${calories_goal}* calories, *${protein_goal}*g of protein and *${carbs_goal}*g of carbs`, {
                                parse_mode: "Markdown"
                            });

                            return DB.User.upsert({
                                daily_calories: calories_goal,
                                daily_protein: protein_goal,
                                daily_carbs: carbs_goal,
                                telegram_id: parseInt(chatId)
                            })

                        }).then((data) => {
                            bot.sendMessage(chatId, `Okay, we're all set! To start using me, just send a photo of your meal`);
                            session.setBotState(chatId, 'start');
                        });

                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;

                case "set_daily_calories":
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'daily_calories', answer);

                        bot.sendMessage(chatId, 'Please, send me your daily goal of protein');
                        session.setBotState(chatId, "set_daily_protein");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;

                case "set_daily_protein":
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'daily_protein', answer);

                        bot.sendMessage(chatId, 'Please, send me your daily goal of carbs');
                        session.setBotState(chatId, "set_daily_carbs");
                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;

                case "set_daily_carbs":
                    if (Utils.isNumber(answer)) {
                        session.setTemporaryInfo(chatId, 'daily_carbs', answer).then((data) => {
                            return session.getAllTemporaryInfo(chatId);
                        }).then((user_obj) => {

                            bot.sendMessage(chatId, `Thanks. I just finished setting up your daily goals`);

                            user_obj.telegram_id = chatId;

                            DB.User.upsert(user_obj).then((data) => {
                                return bot.sendMessage(chatId, `Okay, we're all set! To start using me, just send a photo of your meal`);
                            }).then(function(data) {
                                session.clearFields(chatId, ['daily_calories', 'daily_protein', 'daily_carbs', 'weight', 'height', 'sex', 'activity_level']);
                            });
                        });


                    } else {
                        bot.sendMessage(chatId, "Sorry, but I need a numeric answer");
                    }

                    break;
                default:
                    bot.sendMessage(chatId, "Sorry, I could not understand that");
                    break;
            }
        });
    }

    bot.on('photo', (msg) => {
        var chatId = msg.chat.id;

        //set state to recieved photo
        session.setBotState(chatId, 'select_meal').then(() => {
            return bot.getFileLink(msg.photo[1].file_id);
        }).then((url) => {
            return clarifai.models.predict("bd367be194cf45149e75f01d59f77ba7", url);
        }).then((data) => {
            let keyboard = generateClarifaiKeyboard(data.outputs[0].data.concepts);

            if (keyboard.length > 1) {
                bot.sendMessage(chatId, 'Please, select food type: ', {
                    reply_markup: {
                        inline_keyboard: generateClarifaiKeyboard(data.outputs[0].data.concepts)
                    }
                });
            } else {
                bot.sendMessage(chatId, "Sorry, but I couldn't recognize your food. \n \n Please, enter the name of the food you ate");
            }

        }, (error) => {
            bot.sendMessage(chatId, "Sorry, but I couldn't recognize your food. \n \n Please, enter the name of the food you ate");
        });
    });

    function generateClarifaiKeyboard(obj) {
        let keyboard = [],
            prob_threshold = 0.9;

        obj.map(function(el) {
            if (el.value > prob_threshold) {
                keyboard.push([{
                    text: el.name,
                    callback_data: el.name
                }]);
            }

            return el;
        });

        keyboard.push([{
            text: 'Other',
            callback_data: 'other'
        }]);

        return keyboard;
    }

    function generateNutrionixKeyboard(data) {
        var keyboard = [];

        for (let i in data) {
            keyboard.push([{
                text: data[i].item_name + ", " + data[i].brand_name,
                callback_data: data[i].item_id
            }]);
        }

        return keyboard;
    }

    function validateNutritions(obj) {
        const keys = Object.keys(obj);

        for (let i of keys) {
            if (obj[keys] === null) {
                obj[keys] = 0;
            }
        }

        return obj;
    }

    function generateKey(user_id) {
        return DB.Key.findOne({
            where: {
                expiration_date: {
                    gte: new Date()
                },
                telegram_id: parseInt(user_id)
            }
        }).then((key) => {
            if (key === null) {

                //Key = user_id + current time in UnixStamp
                key = user_id.toString() + Moment().unix().toString().toString();

                DB.Key.create({
                    telegram_id: user_id,
                    stats_key: key,
                    expiration_date: Moment().add(1, 'd').format()
                });
            } else {
                key = key.stats_key;
            }

            return new Promise((resolve, reject) => {
                resolve(key);
            });
        });
    };
})();