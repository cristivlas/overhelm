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
        let msg = xmlHttp.responseText;
        if (msg.length===0) {
          msg = 'No response.';
          if (!navigator.onLine) {
            msg += ' Looks like you are offline.';
          }
        }
        let err = new Error(msg);
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


const getTimeString = function(t, tzOffset) {
  const date = new Date(t);
  date.setTime(date.getTime() + date.getTimezoneOffset() * 60000 - tzOffset);
  return date.toLocaleString();
}


function formatForecast(res, lon, lat, tzOffset) {
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
    html += '(' + getTimeString(period.startTime, tzOffset)
         +' - ' + getTimeString(period.endTime, tzOffset) + '): ';
    html += period.detailedForecast + '</td>';
    html += '</tr>'
  })
  html += '</table></div>';
  return html;
}

