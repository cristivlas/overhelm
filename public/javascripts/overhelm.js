const defaultZoom = 12;
const locationTimeout = 1000;

var popup = null;

var app = {
  setCourse() {
    this.setDestination(popup.getPosition());
  },
  cancelCourse() {
    this.setDestination(null);
  },
  hasDestination() {
    return this.map._destLocation;
  },
  isDestination(pos) {
    return this.hasDestination() && equalPoint(pos, this.map._destLocation._point);
  },

  hideSearch(e) {
    if (e.path) {
      for (let i = 0; i != e.path.length; ++i) {
        if (e.path[i].id==='search') {
          return;
        }
      }
    }
    else if (e.target.id==='search') {
      return;
    }
    var elem = document.getElementById('search-btns');
    if (elem.style.visibility === 'visible') {
      $(elem).animate({left: '-100px'}, {
        complete: function() {
          elem.style.visibility='hidden';
        }
      });
    }
  },

  map: null,
  tzOffset: (new Date()).getTimezoneOffset() * 60000,
  powerClick: 0,

  destination: {
    coord: null,
    place: null,
  },

  tide: {
    station: null,
    chart: {
      line: null,
      lastUpdated: new Date(),
      visible: true,
    },
    offset: 0
  },
  clock: {
    visible: true,
    positioned: 0,
    lastUpdated: new Date()
  }
}

// Raspberry or iPad?
// FIXME: armv7 for raspberry maybe not such a good idea
if (navigator.userAgent.match(/armv7/) || navigator.userAgent.match(/ipad/i)) {
  let elem = document.getElementById('map');
  elem.className += ' tablet large-icon';
}
else {
  let elem = document.getElementById('map');
  elem.className += ' large-icon';
}
//
// Utilities
//
function isFullScreen() {
  if (geolocation._mobile) {
    return false;
  }
  return window.innerHeight >= screen.height;
}

function equalPoint(p1, p2) {
  if (!p1) {
    return !p2;
  }
  if (!p2) {
    return !p1;
  }
  return p1[0]===p2[0] && p1[1]===p2[1];
}

function updateTracking(active) {
  let elem = document.getElementById('tracking');
  if (elem) {
    if (active) {
      elem.style.background = 'green';
    }
    else {
      elem.style.background = 'brown';
    }
  }
}

/**
 * Custom control for activating geolocation / gps tracking
 */
const trackingControl = function(opt_options) {
  const options = opt_options || {};

  const button = document.createElement('button');
  const iconLoc = document.createElement('img');
  iconLoc.src = 'images/location-arrow.png';
  iconLoc.className = 'ctrl-img';

  button.appendChild(iconLoc);

  button.title = 'Track current location';
  button.className = 'ctrl-btn';

  const iconNav = document.createElement('img');
  iconNav.src = 'images/navigation-arrow.png';
  iconNav.className = 'ctrl-img';

  var handler = function() {
    if (app.map.animation) {
      return;
    }
    app.map.animation = true;
    if (geolocation.isTracking()) {
      app.map.toggleRotation();
    }
    else {
      geolocation.start();
    }
    if (app.map._rotateView) {
      if (iconLoc.parentElement===button) {
        button.removeChild(iconLoc);
      }
      button.appendChild(iconNav);
    }
    else {
      if (iconNav.parentElement===button) {
        button.removeChild(iconNav);
      }
      button.appendChild(iconLoc);
    }
    let rot = 0;
    const rotateView = app.map._rotateView;

    if (app.map._rotateView) {
      app.map._rotateView = false;
      app.map._view.setRotation(0);
      rot = 2 * Math.PI - geolocation.rotation;
    }
    app.map._view.animate({
      center: app.map._currentLocation._point,
      zoom: defaultZoom,
      duration: 2000,
      rotation: rot
    },
    function() {
      updateWaterLevel(app.map.showCurrentLocation(true)._coord);
      if (rotateView) {
        app.map.toggleRotation();
      }
      app.map.animation = false;
    })
  }
  button.addEventListener('click', handler, false);

  var element = document.createElement('div');
  element.id = 'tracking';
  element.className = 'tracking ol-custom ol-unselectable ol-control';
  element.appendChild(button);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(trackingControl, ol.control.Control);

let isSearching = false;

/**
 * Custom control for searching for a specific location on the charts
 */
const searchControl = function(opt_options) {
  //
  // Virtual keyboard layout
  //
  const kbdLayout = {
    "name" : "ms-US English (Latin)",
    "lang" : ["en"],
    "normal" : [
      "` 1 2 3 4 5 6 7 8 9 0 - = {bksp}",
      "q w e r t y u i o p [ ] \u005c",
      "a s d f g h j k l ; '",
      "{shift} \u005c z x c v b n m , . / {shift}",
      "{space}"
    ],
    "shift" : [
      "~ ! @ # $ % ^ & * ( ) _ + {bksp}",
      "Q W E R T Y U I O P { } |",
      "A S D F G H J K L : \u0022",
      "{shift} | Z X C V B N M < > / {shift}",
      "{space}"
    ]
  };

  var showSearchBtns = function() {
    const btns = document.getElementById('search-btns');
    if (btns.style.visibility === 'hidden') {
      const srch = document.getElementById('search');
      const rect = srch.parentElement.getBoundingClientRect();
      btns.style.top = Math.floor(rect.top) + 'px';
      btns.style.left = '-100px';
      btns.style.height = Math.floor(rect.height) + 'px';
      btns.style.visibility = 'visible';
      $(btns).animate({
        left: Math.ceil(rect.right) + 'px'
      },{
        complete: function() {
          app.map._map.updateSize();
        }
      });
    }
  }

  var locationHandler = function(e) {
    if (isSearching) {
      return;
    }
    alertify.prompt('', function(valid, value) {
      if (valid) {
        value = value.trim();
        if (value) {
          searchLocation(value, app.map._location._coord);
        }
      }
    });

    let form = document.getElementById('alertify-form');

    if (location.search === '?touch') {
      $('#alertify-text').keyboard({
        autoAccept: true,
        layout: 'custom',
        customLayout: kbdLayout,
        usePreview: false,
        visible: function(e, keyboard, el) {
          const kbdElem = document.getElementById('alertify-text_keyboard');
          form.appendChild(kbdElem);
        }
      });
    }
  }
  const options = opt_options || {};

  // Create a div for all search buttons (locations, and possibly other things
  // such as navigation aids, anchorages, etc.)
  const btns = document.createElement('div');
  btns.className = btns.id = 'search-btns';
  btns.style.visibility = 'hidden';
  document.body.appendChild(btns);

  const locBtn = document.createElement('button');
  locBtn.className = 'btn btn-primary custom-btn';
  locBtn.innerHTML = 'Locations';
  locBtn.id = 'search';
  locBtn.title = 'Search U.S. and Canada coastal locations';
  locBtn.addEventListener('click', locationHandler);
  btns.appendChild(locBtn);

  // create the main search button
  const button = document.createElement('button');
  const icon = document.createElement('img');
  icon.src = 'images/magnifier.png';
  icon.className = 'ctrl-img';

  button.appendChild(icon);
  button.title = 'Search';
  button.className = 'ctrl-btn';
  button.id = 'search';

  button.addEventListener('click', showSearchBtns, false);

  var element = document.createElement('div');
  element.className = 'search ol-custom ol-unselectable ol-control';
  element.appendChild(button);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(searchControl, ol.control.Control);

/**
 * Custom control to show the current destination
 */
const destControl = function(opt_options) {
  const options = opt_options || {};

  const button = document.createElement('button');
  const icon = document.createElement('img');
  icon.src = 'images/circular-target.png';
  icon.className = 'ctrl-img';
  button.appendChild(icon);
  button.title = 'Zoom on location';
  button.className = 'ctrl-btn';
  var handler = function() {
    if (popup.visible) {
      $(popup.getElement()).popover('destroy');
    }
    popup.visible = popup.show = false;
    if (app.hasDestination()) {
      geolocation.stop();
      const loc = app.map.showDestination();
      updatePopup(loc._point, app.destination.place, loc._coord);
    }
    else {
      if (app.map.animation) {
        return;
      }
      app.map.animation = true;
      let rot = 0;
      const rotateView = app.map._rotateView;

      if (app.map._rotateView) {
        app.map._rotateView = false;
        app.map._view.setRotation(0);
        rot = 2 * Math.PI - geolocation.rotation;
      }
      app.map._view.animate({
        center: app.map._location._point,
        zoom: 16,
        duration: 2000,
        rotation: rot
      }, function() {
        const loc = app.map._location;
        if (popup.place && equalPoint(popup.coord, loc._coord)) {
          updatePopup(loc._point, popup.place, loc._coord);
        }
        if (rotateView) {
          app.map.toggleRotation();
        }
        app.map.animation = false;
      })
    }
  }
  button.addEventListener('click', handler, false);
  button.addEventListener('touchstart', handler, false);

  var element = document.createElement('div');
  element.id = 'dest';
  element.className = 'dest ol-custom ol-unselectable ol-control';
  element.appendChild(button);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(destControl, ol.control.Control);


/**
 * Shutdown button
 */
const shutdownControl = function(opt_options) {
  const options = opt_options || {};

  const button = document.createElement('button');
  const icon = document.createElement('img');
  icon.src = 'images/shutdown.png';
  icon.className = 'ctrl-img';
  button.appendChild(icon);
  button.title = 'Shutdown system';
  button.className = 'ctrl-btn';

  const shutdown = function() {
    alertify.confirm('Do you really want to <b>shutdown</b> the system?',
      function(accept) {
        if (accept) {
          const xmlHttp = new XMLHttpRequest();
          xmlHttp.open('GET', '/shutdown/now');
          xmlHttp.send();
        }
      }
    );
  }
  const reboot = function() {
    alertify.confirm('Do you really want to <b>reboot</b> the system?',
      function(accept) {
        if (accept) {
          const xmlHttp = new XMLHttpRequest();
          xmlHttp.open('GET', '/shutdown/reboot');
          xmlHttp.send();
        }
      }
    );
  }
  button.addEventListener('click', function() {
    if (app.powerClick===0) {
      setTimeout(function() {
        if (app.powerClick > 1) {
          reboot();
        }
        else {
          shutdown();
        }
        app.powerClick = 0;
      }, 250);
    }
    ++app.powerClick;
  }, false);

  var element = document.createElement('div');
  element.className = 'shutdown ol-custom ol-unselectable ol-control';
  element.appendChild(button);
  element.id = 'shutdown';

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(shutdownControl, ol.control.Control);

/**
 * Custom control for drawing water levels
 */
const tideChartControl = function(opt_options) {
  const options = opt_options || {};

  const canvas = document.createElement('canvas');
  canvas.id = 'tideChart';
  var element = document.createElement('div');
  element.className = 'tide-chart ol-unselectable ol-control';
  element.appendChild(canvas);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(tideChartControl, ol.control.Control);


function newOpenCloseWidget(titleOpen, titleClosed, elemName, elemClass, flag) {
  const button = document.createElement('button');
  const iconClose = document.createElement('img');
  const iconOpen = document.createElement('img');
  iconClose.src = 'images/right-arrow.png';
  iconOpen.src = 'images/left-arrow.png';
  button.appendChild(iconClose);
  button.title = titleOpen;
  button.id = elemClass;

  var handler = function() {
    var elem = document.getElementById(elemName).parentElement;
    if (!flag) {
      elem.style.visibility = 'visible';
      button.title = titleOpen;
      button.appendChild(iconClose);
      if (iconOpen.parentElement===button) {
        button.removeChild(iconOpen);
      }
    }
    else {
      elem.style.visibility = 'hidden';
      button.title = titleClosed;
      button.appendChild(iconOpen);
      if (iconClose.parentElement===button) {
        button.removeChild(iconClose);
      }
    }
    flag ^= true;
  }
  button.addEventListener('click', handler, false);

  //this results in the button being way too trigger-happy
  //button.addEventListener('touchstart', handler, false);

  var element = document.createElement('div');
  element.className = elemClass + ' ol-custom ol-unselectable ol-control';
  element.appendChild(button);

  app['hide_' + elemName] = function() {
    flag = true;
    handler();
  }
  return element;
}


/**
 * Button for showing / hiding water levels (tide charts)
 */
const showTideControl = function(opt_options) {
  const options = opt_options || {};
  const element = newOpenCloseWidget(
    'Hide tide info', 'Show tide info', 'tideChart', 'show-tide', app.tide.chart.visible);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(showTideControl, ol.control.Control);


/**
 * Custom control for clock / compass
 */
const clockControl = function(opt_options) {
  const options = opt_options || {};

  const canvas = document.createElement('canvas');
  canvas.id = 'clock';
  canvas.width = canvas.height = 268; // best for iPhone
  // hack for the Raspberry PI
  // if (navigator.userAgent.match(/armv7/)) {
  //  canvas.width = canvas.height = 277;
  //}
  let element = document.createElement('div');
  element.className = 'clock ol-unselectable ol-control';
  element.appendChild(canvas);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(clockControl, ol.control.Control);

const showClockControl = function(opt_options) {
  const options = opt_options || {};
  const element = newOpenCloseWidget('Hide clock', 'Show clock', 'clock', 'show-clock', app.clock.visible);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(showClockControl, ol.control.Control);


/**
 * Custom control for displaying current location
 */
const locationControl = function(opt_options) {
  const options = opt_options || {};
  var element = document.createElement('div');
  element.className = 'location ol-unselectable ol-control';
  element.id = 'location';
  element.title = 'Current location (tap to see forecast)';
  element.innerHTML = convertDMS(options.coords);
  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(locationControl, ol.control.Control);

function enableShutdown() {
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
      if (JSON.parse(xmlHttp.responseText)) {
        let elem = document.getElementById('shutdown');
          elem.style.visibility = 'visible';
      }
    }
  }
  xmlHttp.open('GET', 'shutdown/supported');
  xmlHttp.send();
}

const getDeviceOrientation = function() {
  if (!navigator.userAgent.match(/mobile/i)
   || navigator.platform.match(/ipad/i)) {
    return 'default';
  }
  let elem = document.getElementById('tideChart');
  if (!elem) {
    return 'default';
  }
  elem = elem.parentElement;
  switch (window.orientation) {
  case 90:
  case -90:
    elem.style.width = '60%';
    return 'landscape';
  default:
    elem.style.width = '80%';
    return 'portrait';
  }
};

const handleDeviceOrientation = function() {
  app.clock.positioned = 0;
  repositionWidgets();
};

function repositionWidgets() {
  if (app.clock.reposition) {
    clearInterval(app.clock.reposition);
  }
  app.clock.reposition = setInterval(positionClock, 200);
}

/**
 * Position the clock/compass widget relative to tide graph
 */
function positionClock() {
  // give it a few frames to stabilize
  if (++app.clock.positioned >= 10) {
    if (app.clock.reposition) {
      clearInterval(app.clock.reposition);
      app.clock.reposition = null;
    }
    return;
  }
  const orientation = getDeviceOrientation();
  let elem = document.getElementById('tideChart').parentElement;
  const rect = elem.getBoundingClientRect();
  const canvas = document.getElementById('clock');
  elem = canvas.parentElement;
  let top = 0;
  let right = '.5em';

  switch (orientation) {
  case 'landscape':
    canvas.width = canvas.height = rect.height;
    elem.style.top = rect.top + 'px';
    elem.style.left = (rect.left - rect.height - 1) + 'px';
    right = window.innerWidth - rect.left + 1;
    top = rect.top;
    break;

  case 'portrait':
    right = 0;
  default:
    canvas.width = canvas.height = rect.width;
    elem.style.top = (rect.bottom + 4) + 'px';
    elem.style.left = rect.left + 'px';
    top = rect.bottom + 4;
    break;
  }
  elem.style.width = elem.style.height = canvas.height + 'px';

  elem = document.getElementById('show-clock').parentElement;
  elem.style.top = top + 'px';
  elem.style.right = right + 'px';

  startClock();
  positionLocation();
}


function positionLocation() {
  let elem = document.getElementById('tideChart').parentElement;
  const rect = elem.getBoundingClientRect();
  elem = document.getElementById('location');
  elem.style.left = rect.left + 'px';
  elem.style.width = rect.width + 'px';
}


function dateHelper(val) {
  return Math.floor(val / 10).toString() + (val % 10);
}

/**
 * Helper for formatting begin_date and end_date for water level requests
 */
function formatDateTimeUTC(date) {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes()
  return date.getUTCFullYear().toString() + Math.floor(month / 10) + month % 10 +
    + Math.floor(day / 10) + day % 10 + ' ' + Math.floor(hour / 10)
    + Math.floor(hour % 10) + ':' + Math.floor(minute / 10) + minute % 10;
}


function formatRequestRange(now, id) {
  now.setTime(now.getTime() - 12 * 3600 * 1000);
  const begin = formatDateTimeUTC(now);
  now.setTime(now.getTime() + 24 * 3600 * 1000);
  const end = formatDateTimeUTC(now);
  return '&begin_date=' + begin + '&end_date=' + end
    + '&time_zone=GMT&station=' + id + '&units=english&format=json';
}


/**
 * Update tide chart:
 * 1) ask the backend for the closest water level station to current location
 * 2) in response to the async request, processWaterLevelStation sends a
 *    request to the NOAA web service, using a time interval centered around
 *    the current time.
 */
function updateWaterLevel(coord) {

  const getWaterLevel = function(station) {
    const now = new Date();

    if (app.tide.station && station.Id === app.tide.station.Id) {
      //
      // same station? update every 5 minutes
      //
      if (now.getTime() < app.tide.chart.lastUpdated.getTime() + 5 * 60 * 1000) {
        return;
      }
    }
    app.tide.station = station;
    app.tide.chart.lastUpdated = now;
    app.tzOffset = -station.tzOffset;

    now.setTime(now.getTime() + app.tide.offset * 24 * 3600 * 1000);
    const stationInfo = 'Station: ' + station.Id + ' ' + station.Name + ' ' + station.State;
    const currentTime = now.toISOString();

    const useNOAAData = location.search == '?noaa';
    var url;
    if (useNOAAData) {
      url = 'https://tidesandcurrents.noaa.gov/api/datagetter?product=predictions&datum=MLLW'
      + formatRequestRange(now, app.tide.station.Id);
    }
    else {
      url = 'tides/' + app.tide.station.Id + '/' + currentTime;
    }
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = processWaterLevelRequest.bind(null, stationInfo);
    xmlHttp.open('GET', url);
    xmlHttp.send();
  }

  /**
   * Process response from backend.
   */
  const processWaterLevelStation = function(event) {
    const xmlHttp = event.currentTarget;

    if (xmlHttp.readyState === 4) {
      if (xmlHttp.status === 200) {
        getWaterLevel(JSON.parse(xmlHttp.responseText));
      }
      else {
        console.log(xmlHttp.response.text);
      }
    }
  }

  /**
   * Process response from NOAA
   */
  function processWaterLevelRequest(stationInfo, event) {

    function tickDate(t) {
      const arr = t.split(/[- :]/);
      const date = new Date(arr[0], arr[1]-1, arr[2], arr[3], arr[4]);
      // Convert to local time
      date.setTime(date.getTime() - app.tzOffset);

      const a = date.toString().split(' ');
      const timeString = (date.getMonth() + 1)
        + '/' + date.getDate()
        + ' ' + dateHelper(date.getHours())
        + ':' + dateHelper(date.getMinutes());

      return [date, timeString];
    }

    const xmlHttp = event.currentTarget;

    if (xmlHttp.readyState===4 && xmlHttp.status===200) {
      const predictions = JSON.parse(xmlHttp.responseText).predictions;

      let labels = []
      const datasets = [ {
        data: [],
        borderColor: 'blue',
        borderWidth: 2,
        backgroundColor: 'rgba(0,65,135,.3)',
        pointBorderColor: 'black',
        pointBackgroundColor: 'orange',
        pointRadius: new Array(predictions.length).fill(0),
      } ]

      const data = datasets[0].data;
      const now = new Date();
      now.setTime(now.getTime() + now.getTimezoneOffset() * 60000
        - app.tzOffset + app.tide.offset * 24 * 3600 * 1000);

      let closest = 0;
      for (let i = 0; i < predictions.length; ++i) {
        labels.push(predictions[i].t);
        data[i] = predictions[i].v;
        const t = tickDate(predictions[i].t);
        if (closest===0 && t[0].getTime() >= now.getTime()) {
          closest = i;
        }
      }
      let valMin = 99999;
      let iMin = closest;
      for (let i = closest; i < predictions.length; ++i) {
        const val = parseFloat(predictions[i].v);
        if (val < valMin) {
          iMin = i;
          valMin = val;
        }
        if (val > valMin) {
          if (iMin===closest) {
            valMin = val;
          }
          else {
            break;
          }
        }
      }
      let iMax = closest;
      let valMax = -99999;
      for (let i = closest; i < predictions.length; ++i) {
        const val = parseFloat(predictions[i].v);
        if (val > valMax) {
          iMax = i;
          valMax = val;
        }
        if (val < valMax) {
          if (iMax===closest) {
            valMax = val;
          }
          else {
            break;
          }
        }
      }

      function rebuildTicks(c) {
        function label(ticks, i) {
          return tickDate(ticks[i])[1];
        }
        const ticks = c.ticks;
        c.ticks = [];
        c.ticks[0] = ['', label(ticks, 0)];
        c.ticks[closest] = ['', label(ticks, closest)];
        c.ticks[ticks.length-1] = ['', label(ticks, ticks.length-1)];
        c.ticks[iMin] = label(ticks, iMin).split(' ')[1];
        c.ticks[iMax] = label(ticks, iMax).split(' ')[1];
      }


      datasets[0].pointRadius[closest] = 6;

      const ctx = document.getElementById('tideChart');

      if (app.tide.chart.line) {
        app.tide.chart.line.destroy();
      }
      else {
        swipedetect(ctx, function(dir) {
          if (dir==='right') {
            --app.tide.offset;
          }
          else if (dir==='left') {
            ++app.tide.offset;
          }
          else {
            return;
          }
          app.tide.chart.lastUpdated.setTime(0);
          updateWaterLevel(app.map._location._coord);
        });
      }

      app.tide.chart.line = new Chart.Line(ctx, {

        data: {
          labels: labels,
          datasets: datasets
        },

        options: {

          animation: {
            duration: 0,

            onComplete: function() {
              const ctx = this.chart.ctx;
              const fillStyle = ctx.fillStyle;
              const font = ctx.font;
              ctx.fillStyle = 'navy';
              ctx.textBaseline='middle';
              ctx.textAlign='left';
              ctx.font = 'bold 18px calibri';
              const meta = this.getDatasetMeta(0);
              for (let i = 0; i != meta.data.length; ++i) {
                if (meta.data[i]._model.radius < 6) {
                  continue;
                }
                const data = this.data.datasets[0].data;
                const value = Math.ceil(10 * data[i]) / 10 + "'";
                ctx.fillText(value, 35, 25);
                break;
              }
              ctx.fillStyle = fillStyle;
              ctx.font = font;
            }
          },
          legend: {
            display: false
          },
          title: {
            display: true,
            fontSize: 12,
            padding: 0,
            position: 'bottom',
            text: stationInfo
          },
          tooltips: {
            callbacks: {
              title: function(items, data) {
                const val = tickDate(data.labels[items[0].index])[1];
                return val;
              }
            }
          },

          scales: {
            yAxes: [ {
                gridLines: {
                  color: 'lightblue',
                  borderDash: app.tide.offset ? [8, 4] : [0, 0]
                },
              }
            ],

            xAxes: [ {
                gridLines: {
                  color: 'blue',
                  borderDash: app.tide.offset ? [8, 4] : [0, 0]
                },

                ticks: {
                  fontSize: 12,
                  maxRotation: 0,
                  autoSkip: false,
                },

                afterBuildTicks: rebuildTicks
              },
            ]
          },
        },
      });
    }
  }
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = processWaterLevelStation;
  xmlHttp.open('GET', 'nearestWaterLevelStation/' + coord[1] + '/' + coord[0]);
  xmlHttp.send();
}


function updateCurrents(coord) {
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = processCurrentsStation;
  xmlHttp.open('GET', 'nearestCurrentsStation/' + coord[1] + '/' + coord[0]);
  xmlHttp.send();
}


function processCurrentsStation(event) {
  const xmlHttp = event.currentTarget;
  if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
    console.log(xmlHttp.responseText);
    const station = JSON.parse(xmlHttp.responseText);
    const now = new Date();

    const url =
        'https://tidesandcurrents.noaa.gov/api/datagetter?product=currents'
        + formatRequestRange(now, station.Id);
    xmlHttp.onreadystatechange = processCurrents;
    xmlHttp.open('GET', url);
    xmlHttp.send();
  }
}


function processCurrents(event) {
  const xmlHttp = event.currentTarget;
  if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
    console.log(xmlHttp.responseText);
  }
}


function showPopup() {
  if (popup.visible && !popup.shown) {
    popup.shown = true;
    const elem = popup.getElement();
    $(elem).popover('show');
    function closePopup() {
      $(elem).popover('destroy');
      popup.visible = popup.shown = false;
    }
    function setDestination(pos) {
      closePopup();
      if (pos) {
        app.destination.place = popup.place;
        app.map.setDestination();
      }
      else {
        app.map.removeDestination();
      }
      geolocation.start();
    }
    if (!app.setDestination) {
      app.setDestination = setDestination;
    }
    const closeBtn = document.getElementById('close-popup');
    closeBtn.onclick = closePopup;
    closeBtn.ontouchstart = closePopup;

    if (navigator.userAgent.match(/mobile/i)) { // small screen?
      app.hide_clock();
      app.hide_tideChart();
    }
  }
}

function makeSpinnerBackgroundElement(length) {
  const size = length * 6;
  const bg = document.createElement('div');
  bg.style.width = bg.style.height = size + 'px';
  bg.style.top = (window.innerHeight - size) / 2 + 'px';
  bg.style.left = (window.innerWidth - size) / 2 + 'px';
  bg.style.position = 'absolute';
  bg.style.backgroundColor = 'rgba(0,65,135, .7)';
  bg.style.zIndex = 100;
  bg.style.borderRadius = '20%';
  return bg;
}

function getForecast(lon, lat, tzOffset) {
  if (!tzOffset) {
    tzOffset = app.tzOffset;
  }
  if (navigator.userAgent.match(/mobile/i)) { // small screen?
    app.hide_clock();
  }
  const target = document.getElementById('map');
  const length = Math.min(window.innerWidth, window.innerHeight)/30;
  const bg = makeSpinnerBackgroundElement(length); 

  target.insertBefore(bg, target.firstChild);
  const spinner = new Spinner({
    length: length,
    width: length / 2.5,
    radius: length,
    zIndex: 101,
    color: 'lightblue',
    shadow: true,
  }).spin(bg);

  forecast(lon, lat, function(err, res) {
    spinner.stop();
    target.removeChild(bg);
    const msg = err ? err.message : formatForecast(res, lon, lat, tzOffset);
    alertify.alert(msg);
    if (!err && !isFullScreen()) {
      let elem = document.getElementById('alertify-ok');
      if (elem) {
        const url = 'http://marine.weather.gov/MapClick.php?lat=' + lat + '&lon=' + lon;
        let button = document.createElement('a');
        button.target = '_blank';
        button.href = url;
        button.innerHTML = 'Marine Weather';
        button.className = 'alertify-button alertify-button-ok';
        elem.parentElement.appendChild(button);
      }
    }
    let elem = document.getElementById('forecast');
    if (elem) {
      elem.style.height = window.innerHeight * .6 + 'px';
    }
  })
}

function updatePopup(pos, place, coord) {
  popup.place = place;
  popup.coord = coord;

  let html = '<b>' + place.name + '</b>';
  if (place.state) {
    html += ', ' + place.state;
  }

  html += '<br>' + convertDMS(coord);

  const d = getDistanceFromLonLat(coord, app.map._currentLocation._coord) * 3440;
  html += '<br>' + Math.floor(d * 100) / 100 + ' nautical miles from your current location';

  if (app.isDestination(pos)) {
    html += '<hr><a class="btn btn-primary btn-xs" onClick="app.cancelCourse()">Cancel Course</a>  ';
  }
  else {
    html += '<hr><a class="btn btn-primary btn-xs" onClick="app.setCourse()">Set Course</a>  ';
  }
  html += '<button class="btn btn-primary btn-xs" onClick="getForecast('
       + coord[0] + ',' + coord[1] + ')">NOAA Forecast</button>';

  const e = popup.getElement();

  $(e).popover({
    'animation': false,
    'html': true,
    'placement': 'top',
    'content': html,
    'title': '<a href="#" id="close-popup" class="close">&times;</a>'
  });
  popup.setPosition(pos);
  popup.shown = false;
  popup.visible = true; // popover on map postrender
}

function searchLocation(name, coord) {
  if (isSearching) {
    return;
  }
  isSearching = true;

  function buildSelection(matches) {
    let selectHtml = '<b>Nearest Matches</b><br>';
    selectHtml += '<select id="searchResults" class="search-results">';
    for (let i = 0; i < matches.length; ++i) {
      const m = matches[i];
      selectHtml += '<option value="[' + m.lon + ',' + m.lat + ']">';
      selectHtml += m.name;
      if (m.stateName) {
        selectHtml += ', ' + m.stateName;
      }
      if (m.state) {
        selectHtml += ' (' + m.state + ')';
      }
      selectHtml += '</option>';
    }
    selectHtml += '</select>';
    return selectHtml;
  }

  const url = 'search/' + name + '/' + coord[0] + '/' + coord[1];
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
      const matches = JSON.parse(xmlHttp.responseText);
      if (matches && matches.length) {
        const selectHtml = buildSelection(matches);

        alertify.confirm(selectHtml, function(accept) {
          isSearching = false;
          if (!accept) {
            return;
          }
          const elem = document.getElementById('searchResults');
          if (!elem) {
            return;
          }
          const srchCoord = JSON.parse(elem.options[elem.selectedIndex].value);
          if (geolocation.isTracking()) {
            geolocation.stop();
          }

          if (app.map.getView().getZoom() < defaultZoom) {
              app.map.getView().setZoom(defaultZoom);
          }

          if (popup.visible) {
            $(popup.getElement()).popover('destroy');
          }
          popup.visible = popup.show = false;
          const point = app.map.setInspectLocation(srchCoord)._point;
          app.map.animation = true;
          app.map._rotateView = false;
          app.map._view.animate({
            center: point,
            rotation: 2 * Math.PI,
            zoom: defaultZoom,
            duration: 2000
          }, function() {
            app.map.animation = false;
            app.map.showInspectLocation();
            updatePopup(
              point,
              matches[elem.selectedIndex],
              srchCoord);
          });
        });
      }
      else {
        isSearching = false;
        alertify.alert('<b>No matches</b>');
      }
    }
  }
  xmlHttp.onerror = function() {
    isSearching = false;
  }
  xmlHttp.open('GET', url);
  xmlHttp.send();
}


function convertDMS(coords) {
  return ol.coordinate.toStringHDMS(coords);
}


function updateDefault() {
  clearUpdateTimeout();
  if (!app.map._currentLocation) {
    const coord = [-122.4049, 47.6810] // Shilshole Bay
    app.map.setCurrentLocation(coord);
    app.map.showCurrentLocation();
    updateCoords()
  }
}


function initialize() {
  const controls = [
    new tideChartControl(),
    new showTideControl(),
    new clockControl(),
    new showClockControl(),
    new locationControl(),
    new trackingControl(),
    new searchControl(),
    new destControl(),
    new shutdownControl()
  ];

  app.map = new MarineMap({
    controls: controls,
    target: 'map',
    defaultZoom: defaultZoom,
    onLocationUpdate: function(coord) {
      updateWaterLevel(coord);
    },
    onUpdateView: function(view) {
    },
    getRotation: function() {
      return geolocation.rotation;
    }
  });
  enableShutdown();

  popup = new ol.Overlay({
    element: document.getElementById('popup')
  });
  app.map.addOverlay(popup);

  app.map.on('postrender', function() {
    showPopup();
    repositionWidgets();
  });
  app.map.on('change:size', function() {
    app.clock.positioned = 0;
  });
  document.getElementById('location').addEventListener('click', function () {
    const loc = app.map._currentLocation;
    if (loc) {
      const tzOffset = new Date().getTimezoneOffset() * 60000;
      getForecast(loc._coord[0], loc._coord[1], tzOffset);
    }
  })
  app.hide_clock();
}

function updateCoords() {
  elem = document.getElementById('location');
  if (elem) {
    elem.innerHTML = convertDMS(app.map._currentLocation._coord);
  }
}


let updateTimeout = null;

function clearUpdateTimeout() {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  }
}

var geolocation = new GeolocationWrapper({
  onSuccess: function(coord) {
    if (coord.lon && coord.lat) {
      clearUpdateTimeout();
      updateTracking(true);
      app.map.setCurrentLocation([ coord.lon, coord.lat ]);
      app.map.showCurrentLocation();
      app.map.updateFeatures();
      updateCoords();
    }
  },
  onError: function(err) {
    updateTracking(false);
    updateDefault();
  },
  onStop: function() {
    app.tide.station = null;
    updateTracking(false);
  },
  onCompass: function() {
    if (app.map && app.map._updating) {
      return;
    }
    const now = new Date();
    if (now.getTime() < app.clock.lastUpdated.getTime() + 100) {
      return;
    }
    app.clock.lastUpdated = now;
    if (app.clock.visible) {
      app.clock.positioned = 0;
      positionClock();
    }
    app.map.updateFeatures(true);
  },
  onNeedsCalibration: function() {
    alertify.alert('Compass needs calibration');
  },
  timeout: locationTimeout
});


window.onload = function() {
  initialize();
  updateTimeout = setTimeout(updateDefault, locationTimeout);
  startClock();

  swipedetect(clock.canvas, function(dir) {
    geolocation.changeSpeedUnit();
  }, true);

  geolocation.start();

  window.addEventListener('click', app.hideSearch, true);
  window.addEventListener('touchstart', app.hideSearch, true);
  window.addEventListener('orientationchange', handleDeviceOrientation);
}

