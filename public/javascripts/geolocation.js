
class Geolocation {
  constructor(opt_options) {
    var options = opt_options || {};
    this._timeout = options.timeout ? options.timeout : 3000;
    this._errorCallback = options.onError;
    this._successCallback = options.onSuccess;
    this._startCallback = options.onStart;
    this._stopCallback = options.onStop;
    this._compassCallback = options.onCompass;
    this._heading = 0;
    //this._ios = (navigator.platform === 'iPad' || navigator.platform === 'iPhone');
    this._mobile = navigator.userAgent.match(/mobile/i);
    this._iunit = 0;
    this._units = [ 'kts', 'mph', 'km/h', '\u00B0' ];
    this._speedConversion = [ 1.943844, 2.236936, 3.6, 0.0 ];
    this.speed = 0;
    this.rotation = 0;
  }

  changeSpeedUnit() {
    this._iunit = (this._iunit + 1) % this._units.length;
  }

  getSpeedUnit() {
    return this._units[this._iunit];
  }

  start() {
    if (!this.isTracking()) {
      if (this._mobile) {
        this._useHTML5Geolocation();
      }
      else {
        this._sendLocationRequest();
      }
      if (this._startCallback) {
        this._startCallback();
      } 
    }
  }

  stop() {
    this.speed = 0;

    if (this._watchId) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
      if (this._stopCallback) {
        this._stopCallback();
      }
    }
    else if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      if (this._stopCallback) {
        this._stopCallback();
      }
    }
  }

  isTracking() {
    return this._watchId || this._intervalId;
  }

  _sendLocationRequest() {
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = this._processLocationRequest.bind(this);
    xmlHttp.open('GET', '/location');
    xmlHttp.send();
  }

  _processLocationRequest(e) {
    var xmlHttp = e.currentTarget;
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
      var loc = JSON.parse(xmlHttp.responseText);
      if (loc) {
        if (!this._intervalId) {
          //
          // First successful call? Repeat at given interval/timeout
          //
          this._intervalId = 
            setInterval(this._sendLocationRequest.bind(this), this._timeout);
        }
        if (loc.time) {
          this._update(loc);
        }
        else {
          this.speed = 0;
        }
      }
      else {
        if (this._intervalId) {
          clearInterval(this._intervalId);
          this._intervalId = null;
        }
        this._useHTML5Geolocation();
      }
    }
  }


  _useHTML5Geolocation() {
    if (this._mobile && !this._once) {
      this._once = true;

      window.addEventListener('deviceorientation', function(e) {
        if (e.webkitCompassHeading) {
          this._heading = e.webkitCompassHeading;
        }
        else {
          if (!e.absolute || e.alpha === null) {
            return;
          }
          this._heading = -e.alpha;
        }
        this._updateHeading();
        if (this._compassCallback) {
          this._compassCallback(this);
        }
      }.bind(this));
    }

    this._watchId = navigator.geolocation.watchPosition(
      this._onSuccess.bind(this),
      this._onError.bind(this),
      {
        //enableHighAccuracy: true,
        enableHighAccuracy: false,
        timeout: this._timeout,
        maximumAge: 0
      });
  }

  _onSuccess(pos) {
    const k = this._speedConversion[this._iunit];
    var coord = {
      lon: pos.coords.longitude,
      lat: pos.coords.latitude,
      speed: pos.coords.speed * k,
      heading: pos.coords.heading
    }
    this._update(coord, pos.coords.speed===null);
  }

  _onError(err) {
    if (!this.isTracking()) {
      return;
    }
    this.stop();
    if (err.code === err.TIMEOUT) {
      this.start();
    }
    else if (err.code === err.PERMISSION_DENIED) {
      if (err.message.length === 0) {
        err.message = 'Unknown geolocation error'
      }
      alertify.alert(err.message);
      if (this._errorCallback) {
        this._errorCallback(err);
      }
    }
    else {
      alertify.confirm(err.message + ' Retry?', function(val) {
        if (val) {
          this.start();
        }
        else if (this._errorCallback) {
          this._errorCallback(err);
        }
      }.bind(this));
    }
  }

  _updateHeading() {
    this.coord.heading = this._heading + window.orientation;
    this.rotation = this.coord.heading * (Math.PI / 180);
    this._heading = Math.ceil(this._heading);
  }

  _update(coord, calcSpeed) {
    const t1 = this.timestamp;
    const t2 = new Date();
    if (calcSpeed && t1) {
      coord.speed = calculateSpeed(t1, this.coord.lat, this.coord.lon, t2, coord.lat, coord.lon);
    }
    this.timestamp = t2;
    this.coord = coord;
    this.speed = coord.speed || 0;
    this._updateHeading();

    if (this._successCallback) {
      this._successCallback(coord);
    }
  }
}

// https://stackoverflow.com/questions/31456273/calculate-my-speed-with-geolocation-api-javascript
function calculateSpeed(t1, lat1, lon1, t2, lat2, lon2) {
  /** Converts numeric degrees to radians */
  if (typeof(Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function() {
      return this * Math.PI / 180;
    }
  }
  var R = 6371000; // radius of Earth, in meters
  var dLat = (lat2-lat1).toRad();
  var dLon = (lon2-lon1).toRad();
  var lat1 = lat1.toRad();
  var lat2 = lat2.toRad();

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var distance = R * c;

  return distance / (t2 - t1);
}

