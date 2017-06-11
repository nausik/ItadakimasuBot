module.exports = {
    isNumber: function(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    },

    isValidDate: function(d) {
        return (d != 'Invalid Date');
    },

    calculateCarbsNorm: function(obj) {
        let result;
        return Math.floor(parseFloat(obj.activity_level) * 3 * parseInt(obj.weight));
    },

    calculateProteinNorm: function(obj) {
        let result;
        return Math.floor(parseFloat(obj.activity_level) * parseInt(obj.weight));
    },

    calculateCaloriesNorm: function(obj) {
        let result;

        //BMR Formulas, so, magic number.
        if (obj.sex === 'male') {
            result = (88.36 + (13.4 * parseInt(obj.weight)) + (4.8 * parseInt(obj.height)) - (5.7 * parseInt(obj.age))) * parseFloat(obj.activity_level);
        } else if (obj.sex === 'female') {
            result = (447.6 + (9.2 * parseInt(obj.weight)) + (3.1 * parseInt(obj.height)) - (4.3 * parseInt(obj.age))) * parseFloat(obj.activity_level);
        }
        return Math.floor(result);
    },

    inArray: function(answer, validation_arr) {
        return (validation_arr.indexOf(answer) !== -1);
    },

    prepareAnswer: function(answer){
        return answer.toLowerCase();
    }
}