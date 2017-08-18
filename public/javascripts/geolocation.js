
class Geolocation {
  constructor(opt_options) {
    var options = opt_options || {};
    this._timeout = options.timeout ? options.timeout : 3000;
    this._errorCallback = options.onError;
    this._successCallback = options.onSuccess;
    this._startCallback = options.onStart;
    this._stopCallback = options.onStop;
    this._compassCallback = options.onCompass;
    //this._ios = (navigator.platform === 'iPad' || navigator.platform === 'iPhone');
    this._mobile = navigator.userAgent.match(/mobile/i);
    this._iunit = 0;
    this._units = [ 'kts', 'mph', 'km/h', '\u00B0' ];
    this._speedConversion = [ 1.943844, 2.236936, 3.6 ];
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
          this._heading = Math.floor(e.webkitCompassHeading);
        }
        else {
          if (!e.absolute || e.alpha === null) {
            return;
          }
          const alpha = -Math.floor(e.alpha);
          if (this._heading === alpha) {
            return;
          }
          this._heading = alpha;
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
        enableHighAccuracy: true,
        timeout: this._timeout,
        maximumAge: 0
      });
  }

  _onSuccess(pos) {
    var coord = {
      lon: pos.coords.longitude,
      lat: pos.coords.latitude,
      //speed: pos.coords.speed * 1.943844, // meters per second -> knots
      speed: pos.coords.speed * this._speedConversion[this._iunit],
      heading: pos.coords.heading
    }
    this._update(coord);
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
    if (this._heading) {
      this.coord.heading = this._heading + window.orientation;
      this.rotation = this.coord.heading * (Math.PI / 180);
    }
  }

  _update(coord) {
    this.coord = coord;
    this.speed = coord.speed || 0;
    this._updateHeading();

    if (this._successCallback) {
      this._successCallback(coord);
    }
  }
}

