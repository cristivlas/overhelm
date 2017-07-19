const https = require('https')
const parser = new require('xml2js').Parser({mergeAttrs: true})

function xmlWeather(opt) {
  const lon = opt.lon;
  const lat = opt.lat;
  console.assert(lon);
  console.assert(lat);


  let url = '/xml/SOAP_server/ndfdXMLclient.php?wx=wx&Unit=e'
    + '&product=time-series'
    + '&lat=' + opt.lat
    + '&lon=' + opt.lon

  if (opt.maxTemp) {
    url += '&maxt=maxt'
  }
  if (opt.minTemp) {
    url += '&mint=mint'
  }
  if (opt.windDirection) {
    url += '&wdir=wdir'
  }
  if (opt.windSpeed) {
    url += '&wspd=wspd'
  }
  if (opt.windGusts) {
    url += '&wgust=wgust'
  }
  if (opt.waveHeights) {
    url += '&waveh=waveh'
  }
  if (opt.skyCover) {
    url += '&sky=sky'
  }
  console.log(url);

  let xml = '';

  const request = https.get({
    host: 'graphical.weather.gov',
    path: url,
    headers: { 'User-Agent': 'Ragnar/v0.1 (cristi.vlasceanu@gmail.com)' }
    },
    function(response) {
      if (response.statusCode !== 200) {
        if (opt.callback) {
          opt.callback(response);
        }

        return;
      }

      response.on('data', function(chunk) {
        xml += chunk;
      })


      response.on('end', function() {
        if (opt.callback) {
          opt.callback(response, xml);
        }
      })
   })
 request.end();
}


//
// test
//
xmlWeather({
  lon: -122.4049,
  lat: 47.6810,
  windSpeed: true,
  windDirection: true,
  maxTemp: true,

  callback: function(resp, xml) {
    console.log([resp.statusCode, resp.statusMessage]);
    if (resp.statusCode===200) {

      parser.parseString(xml, function(err, json) {
        if (err) {
          throw new Error(err);
        }
        console.log(JSON.stringify(json, null, 2));
      })
    } 
  }
});


