const qs = require('qs'),
    Fetch = require('node-fetch');

module.exports = function(NUTRIONIX_CREDENTIALS) {
    return {
        searchNutrionix: function(query) {
            let url = "https://api.nutritionix.com/v1_1/search/" + query,
                body = NUTRIONIX_CREDENTIALS;

            return Fetch(url + "?" + qs.stringify(body), {
                method: "GET"
            }).then((res) => {
                return res.json();
            });
        },

        getInfoNutrionix: function(query) {
            let url = "https://api.nutritionix.com/v1_1/item?id=" + query,
                body = NUTRIONIX_CREDENTIALS;

            return Fetch(url + "&" + qs.stringify(body), {
                method: "GET"
            }).then((res) => {
                return res.json();
            });
        }
    }
}