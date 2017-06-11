$(document).ready(function() {
    $('#date_select').combodate({
        value: moment().format('DD-MM-YYYY'),
        maxYear: (new Date()).getFullYear()
    });

    updateData(moment().format('YYYY-MM-DD'));

    $('.combodate .day, .combodate .month, .combodate .year').on('change', function() {
        let date = $('#date_select').combodate('getValue', 'YYYY-MM-DD');
        updateData(date);
    })
});


function updateData(date) {
    var key = $('.user_key')[0].innerText;

    $.ajax({
        type: "POST",
        url: '/get_stats',
        data: {
            user_key: key,
            log_date: date
        },
        success: getData
    });
}

function calculateTotals(day) {
    return day_totals = day.reduce(function(acc, el) {
        acc.total_calories += el.calories * el.portions;
        acc.total_carbs += el.carbs * el.portions;
        acc.total_protein += el.protein * el.portions;
        acc.total_fats += el.fats * el.portions;
        return acc;
    }, {
        total_calories: 0,
        total_carbs: 0,
        total_protein: 0,
        total_fats: 0
    });
}

function applyFloor(arr) {
    return arr.map(function(el) {
        el.fats = Math.floor(el.fats);
        el.calories = Math.floor(el.calories);
        el.protein = Math.floor(el.protein);
        el.carbs = Math.floor(el.carbs);
        return el;
    });
}

function buildTable(day, day_totals) {
    let table_footer = $('.data_table_footer')[0],
        table_body = $('.data_table_body')[0];

    clearTable(table_body, table_footer);

    for (let row of day) {
        table_body.innerHTML += '<tr><td>' + row.food_name + '</td><td>' + row.log_date + '</td><td>' + row.portions + '</td><td>' + row.calories + '</td><td>' + row.protein + '</td><td>' + row.carbs + '</td><td>' + row.fats + '</td></tr>';
    }

    table_footer.innerHTML += `<tr><td class="bold">Totals:</td><td></td><td></td><td>${day_totals.total_calories}</td><td>${day_totals.total_protein}</td><td>${day_totals.total_carbs}</td><td>${day_totals.total_fats}</td></tr>`;

}

function getData(data) {
    let day_totals;

    data.day = applyFloor(data.day);
    day_totals = calculateTotals(data.day);
    buildTable(data.day, day_totals);

    buildCharts(data);
}

function buildCharts(data) {
    let chart_labels = Object.keys(data.month).reverse(),
        chart_calories = getChartData(data.month, chart_labels, 'calories'),
        chart_protein = getChartData(data.month, chart_labels, 'protein'),
        chart_carbs = getChartData(data.month, chart_labels, 'carbs'),
        chart_fats = getChartData(data.month, chart_labels, 'fats'),
        calories_chart = document.getElementById("calories_chart").getContext('2d'),
        protein_chart = document.getElementById("protein_chart").getContext('2d'),
        carbs_chart = document.getElementById("carbs_chart").getContext('2d'),
        fats_chart = document.getElementById("fats_chart").getContext('2d');

    buildChart({
        elem: calories_chart,
        labels: chart_labels,
        values: chart_calories,
        norm: data.user.daily_calories,
        border_color: 'rgba(255, 99, 132, 1)',
        background_color: 'rgba(255, 99, 132, 0.2)',
        dash_color: 'rgba(255, 99, 132, 0.5)',
        label: 'Calories'
    });

    buildChart({
        elem: protein_chart,
        labels: chart_labels,
        norm: data.user.daily_protein,
        values: chart_protein,
        border_color: 'rgba(54, 162, 235, 1)',
        background_color: 'rgba(54, 162, 235, 0.2)',
        dash_color: 'rgba(54, 162, 235, 0.5)',
        label: 'Protein'
    });

    buildChart({
        elem: carbs_chart,
        labels: chart_labels,
        norm: data.user.daily_carbs,
        values: chart_carbs,
        border_color: 'rgba(255, 206, 86, 1)',
        background_color: 'rgba(255, 206, 86, 0.2)',
        dash_color: 'rgba(255, 206, 86, 0.5)',
        label: 'Carbs'
    });

    buildChart({
        elem: fats_chart,
        labels: chart_labels,
        values: chart_fats,
        border_color: 'rgba(75, 192, 192, 1)',
        background_color: 'rgba(75, 192, 192, 0.2)',
        label: 'Fats'
    });
}

function clearTable(body, footer) {
    body.innerHTML = "";
    footer.innerHTML = "";
}

function getChartData(source, keys, nutrition) {
    let result = keys.reduce(function(acc, el) {
        acc.push(source[el][nutrition]);
        return acc;
    }, []);
    return result;
}

function buildChart(data) {
    var myChart = new Chart(data.elem, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: getDataSet()
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: `Monthly ${data.label} intake chart`
            },
            tooltips: {
                mode: 'index',
                intersect: false,
            },
            hover: {
                mode: 'nearest',
                intersect: true
            },
            scales: {
                xAxes: [{
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: 'Dates'
                    }
                }],
                yAxes: [{
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: `${data.label}`
                    }
                }]
            }
        }
    });

    function getDataSet() {
        let result_data = [{
            label: data.label,
            data: data.values,
            backgroundColor: data.background_color,
            borderColor: data.border_color,
            borderWidth: 1
        }];
        if (typeof data.norm !== 'undefined') {
            result_data.push({
                label: `${data.label} daily norm`,
                data: Array.from({
                    length: 30
                }, i => data.norm),
                borderColor: data.dash_color,
                backgroundColor: 'rgba(255,0,0,0)',
                borderDash: [20, 30]
            })
        }
        return result_data;
    }
}