function forecast(lon, lat, callback) {
  if (app._forecastPending) {
    return;
  }
  app._forecastPending = true;
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState===4) {
      app._forecastPending = false;
      if (xmlHttp.status===200) {
        const res = JSON.parse(xmlHttp.responseText);
        callback(null, res);
      }
      else {
        let err = new Error(xmlHttp.responseText);
        err.status = xmlHttp.status;
        return callback(err);
      }
    }
  }
  const url = 'https://api.weather.gov/points/' + lat + ',' + lon + '/forecast';
  console.log(url)
  xmlHttp.open('GET', url);
  xmlHttp.send();
}


function formatForecast(res, lon, lat) {
  let html = '<div class="forecast" id="forecast">';
  html += '<table>';
  let first = true;
  res.properties.periods.forEach(function(period) {
    if (first) {
      first = false;
      if (period.name.match(/night/i)) {
        html += '<tr></tr>';
        console.log(period.name);
      }
    }
    html += '<tr>';
    html += '<td><img src="' + period.icon + '"></td>';
    html += '<td><b>' + period.name + '</b> ';
    html += '(' + new Date(period.startTime).toLocaleString()
         +' - ' + new Date(period.endTime).toLocaleString() + '): ';
    html += period.detailedForecast + '</td>';
    html += '</tr>'
  })
  html += '</table></div>';
  return html;
}

