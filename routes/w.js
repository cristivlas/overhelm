const w = require('./w.json');
const date = require('date-and-time')

let series = {}
let datasets = {}
console.assert(w.dwml);
console.assert(w.dwml.data);
console.assert(w.dwml.data[0]);

const data = w.dwml.data[0];
processLayouts(data);
//processParam(data, 'cloud-amount');
//processParam(data, 'direction');
processParam(data, 'temperature');
processParam(data, 'wind-speed');
//processWeather(data);

//TODO:
//processParam(data, 'water-state');


function processLayouts(data) {
  for (let i = 0; i != data['time-layout'].length; ++i) {
    const layout = data['time-layout'][i];
    const key = layout['layout-key'][0];

    let t = []
    let start = layout['start-valid-time']
    let end = layout['end-valid-time']
    if (start) {
      for (let i = 0; i != start.length; ++i) {
        if (!t[i]) {
          t[i] = {}
        }
        t[i].start = new Date(start[i]);
      }
    }
    if (end) {
      for (let i = 0; i != end.length; ++i) {
        if (!t[i]) {
          t[i] = {}
        }
        t[i].end = new Date(end[i]);
      }
    }
    series[key] = t;
  }
}


function processParam(data, name) {
  console.assert(data.parameters);
  const param = data.parameters[0][name];
  if (param) {
    for (let i = 0; i != param.length; ++i) {
      const p = param[i];
      const type = p.type[0];
      const key = p['time-layout'][0];
      const idx = name + '.' + type;

      for (let j = 0; j != p.value.length; ++j) {
        const v = p.value[j];
        series[key][j][idx] = parseFloat(v);
        datasets[idx] = []
      }
    }
  }
}


function processWeather(data) {
  console.assert(data.parameters);
  const weather = data.parameters[0].weather;
  if (weather) {
    for (let i = 0; i != weather.length; ++i) {
      const w = weather[i];
      const key = w['time-layout'][0];
      const cond = w['weather-conditions'];
      console.assert(cond);

      for (let j = 0; j != cond.length; ++j) {
        if (!cond[j].value) {
          continue;
        }
        let e = series[key][j].weather = series[key][j].weather || {}
        e.coverage = cond[j].value[0].coverage[0];
        e.intensity = cond[j].value[0].intensity[0];
        e.type = cond[j].value[0]['weather-type'][0];
      }
    }
  }
}


function consolidate() {
  let report = {}

  for (let prop in series) {
    let entries = series[prop];
    for (let j = 0; j != entries.length; ++j) {
      const timestamp = entries[j].start;
      if (!report[timestamp]) {
        report[timestamp] = {}
      }
      let e = report[timestamp]
      for (const k in entries[j]) {
        e[k] = entries[j][k];
      }
    }
  }
  let weather = []
  for (const prop in report) {
    weather.push(report[prop]);
  }
  weather.sort(function(a, b) {
   return a.start.getTime() - b.start.getTime();
  })

  return weather;
}

//console.log(JSON.stringify(series, null, 4));
//console.log(datasets);


let chart = {
  labels: [],
  datasets: [],
  options: {
    scales: {
      yAxes: [{
        id: 'temperature'
      }, {
        id: 'wind-speed'
      }]
    }
  }
}


let end = null;
let prev = { };

consolidate().forEach(function(elem) {
  if (elem.end) {
    end = elem.end;
  }
  chart.labels.push(date.format(elem.start, 'YYYY-MM-DD HH:mm'));

  for (let param in datasets) {
    let val = elem[param];
    if (val) {
      prev[param] = val;
    }
    else if (end && end.getTime() >= elem.start.getTime()) {
      val = prev[param];
    }
    datasets[param].push(val);
  }

});


for (let param in datasets) {
  chart.datasets.push({
    label: param,
    data: datasets[param],
    yAxisID: param.split('.')[0]
  })
}


console.log(JSON.stringify(chart, null, 2));


