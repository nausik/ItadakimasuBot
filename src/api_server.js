(function() {
    const Express = require('express'),
        _ = require('underscore'),
        Keys = require('./keys'),
        BodyParser = require('body-parser'),
        Sequelize = require("sequelize"),
        Moment = require('moment'),
        Path = require('path'),
        Ejs = require('ejs-locals');

    const sequelize_client = new Sequelize(Keys.SEQUELIZE_URL),
        app = Express(),
        port = process.env.PORT || "5000",
        urlencodedParser = BodyParser.urlencoded({
            extended: false,
            limit: 1024 * 1024 * 20
        });

    const DB = {
        User: require('./Models/User')(sequelize_client),
        Log: require('./Models/Log')(sequelize_client),
        Key: require('./Models/Key')(sequelize_client)
    };

    sequelize_client.sync({
        force: false
    });

    app.engine('ejs', Ejs);
    app.set('views', Path.join(__dirname, '../views'));
    app.use(Express.static(Path.join(__dirname, '../public')));
    app.set('view engine', 'ejs');

    app.get('/stats/:uniq_key', function(req, res) {
        res.render('index', {
            key: req.params.uniq_key
        });
    });

    app.post('/get_stats', urlencodedParser, (req, res) => {
        //Get telegram_id by key
        DB.Key.findOne({
            where: {
                stats_key: req.body.user_key
            }
        }).then((data) => {
            //Get Logs and User Info by telegram_id and return them (simultaneously)
            let day_data_promise = DB.Log.all({
                    where: {
                        telegram_id: data.telegram_id,
                        log_date: req.body.log_date
                    },
                    attributes: [
                        'log_date', 'calories', 'protein', 'fats', 'carbs', 'food_name', 'portions'
                    ],
                }),

                month_data_promise = DB.Log.all({
                    where: {
                        telegram_id: data.telegram_id,
                        log_date: {
                            $gte: Moment(req.body.log_date).add(-30, 'days').format('YYYY-MM-DD'),
                            $lte: req.body.log_date
                        },
                    },
                    group: ['log_date'],
                    attributes: [
                        'log_date', [Sequelize.fn('SUM', Sequelize.col('calories')), 'calories'],
                        [Sequelize.fn('SUM', Sequelize.col('protein')), 'protein'],
                        [Sequelize.fn('SUM', Sequelize.col('fats')), 'fats'],
                        [Sequelize.fn('SUM', Sequelize.col('carbs')), 'carbs']
                    ],
                }),

                user_data_promise = DB.User.findOne({
                    where: {
                        telegram_id: data.telegram_id
                    }
                });

            //Wait for all promises to finish
            return Promise.all([day_data_promise, month_data_promise, user_data_promise]);

        }).then((data) => {
            let day_data = data[0],
                month_data = data[1],
                user_data = data[2],
                formatted_day = formatDates(day_data, 'log_date', 'L'),
                formatted_month = formatDates(month_data, 'log_date', 'L'),
                number_of_days = 30;

            res.json({
                day: formatted_day,
                month: createMonthDataObject(req.body.log_date, formatted_month, number_of_days),
                user: user_data,
                crap: formatted_month,
                crap_2: month_data
            });
        });
    });

    function formatDates(obj, date_param, format) {
        return obj.map(function(el) {
            el[date_param] = Moment(el[date_param]).format(format);

            return el;
        });
    }

    function createMonthDataObject(log_date, source, target_days) {
        let result_object = {},
            days_obj = arrayToObject(source, "log_date");

        for (let i = 0; i < target_days; i++) {
            //Generate array of dates (i.e. 30 days) and fill them with monthly info or 0-object if it's empty
            let i_date = Moment(log_date).add(-i, 'days').format('L');

            result_object[i_date] = days_obj[i_date];

            if (typeof days_obj[i_date] === 'undefined') {
                result_object[i_date] = {
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fats: 0
                };
            }
        }

        return result_object;
    }

    function arrayToObject(arr, key) {
        const keys = _.pluck(arr, key);

        return (_.object(keys, arr));
    }

    app.listen(port, () => {});
})();