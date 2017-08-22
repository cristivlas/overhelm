function forecast(lon, lat, callback) {
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState===4) {
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


function formatForecast(res) {
  let html = '<div class="forecast" id="forecast">';
  html += '<table>';
  res.properties.periods.forEach(function(period) {
    html += '<tr>';
    html += '<td><img src="' + period.icon + '"></td>';
    html += '<td><b>' + period.name + '</b> ';
    html += period.detailedForecast + '</td>';
    html += '</tr>'
  })
  html += '</table></div>';
  return html;
}

