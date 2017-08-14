var clock = {
  canvas: null,
  ctx: null,
  radius: 0,
  interval: null,
}

function startClock() {
  clock.canvas = document.getElementById('clock');
  if (!clock.ctx) {
    clock.ctx = clock.canvas.getContext('2d');
  }
  if (clock.interval) {
    clearInterval(clock.interval);
    clock.interval = null;
  }
  clock.radius = Math.min(clock.canvas.height, clock.canvas.width) / 2;
  clock.ctx.translate(clock.radius, clock.radius);
  clock.radius *= 0.90;
  clock.interval = setInterval(drawClock.bind(this, clock.ctx, clock.radius), 1000);
}

function drawClock(ctx, radius) {
  drawFace(ctx, radius);
  drawMinutes(ctx, radius);
  drawNumbers(ctx, radius);
  drawTime(ctx, radius);
  drawCompass(ctx, radius);
  drawSpeed(ctx, radius);
}

function drawFace(ctx, radius) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2*Math.PI);
  ctx.fillStyle = 'black';
  ctx.fill();
  const grad = ctx.createRadialGradient(0,0,radius*0.95, 0,0,radius*1.05);
  grad.addColorStop(0, 'gray');
  grad.addColorStop(0.5, 'white');
  grad.addColorStop(1, 'lightblue');
  ctx.strokeStyle = grad;
  ctx.lineWidth = radius*0.15;
  ctx.stroke();
  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'lightblue';
  ctx.arc(0, 0, radius * 0.725, 0, 2*Math.PI);
  ctx.stroke(); 

  //compass reference lines 
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'red';
  ctx.beginPath();
  ctx.moveTo(0,-radius * 1.1);
  ctx.lineTo(0,radius * .35);
  ctx.stroke();
  ctx.moveTo(-radius * 0.75, 0);
  ctx.lineTo(radius * 0.75, 0);
  ctx.stroke();
}

function drawNumbers(ctx, radius) {
  ctx.fillStyle = 'white';
  ctx.font = radius*0.15 + 'px arial';
  ctx.textBaseline='middle';
  ctx.textAlign='center';
  for(let num = 1; num < 13; num++){
    const ang = num * Math.PI / 6;
    ctx.rotate(ang);
    ctx.translate(0, -radius*0.8);
    ctx.rotate(-ang);
    ctx.fillText(num.toString(), 0, 0);
    ctx.rotate(ang);
    ctx.translate(0, radius*0.8);
    ctx.rotate(-ang);
  }
}

function drawMinutes(ctx, radius) {
  const length = 0.9 * radius;
  ctx.strokeStyle = 'white';
  ctx.lineCap = 'butt';
  function drawMark(num) {
    const ang = num * Math.PI / 30;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.rotate(ang);
    ctx.moveTo(0, radius);
    ctx.lineTo(0, length);
    ctx.stroke();
    ctx.rotate(-ang);
  }
  ctx.lineWidth = 7;
  for(let num = 0; num < 60; num += 5) {
    drawMark(num);
  }
  ctx.lineWidth = 2;
  for(let num = 0; num < 60; ++num){
    drawMark(num);
  }
}

function drawTime(ctx, radius){
    var now = new Date();
    now.setTime(now.getTime() + now.getTimezoneOffset() * 60000 - app.tzOffset);
    var hour = now.getHours();
    var minute = now.getMinutes();
    var second = now.getSeconds();
    //hour
    hour=hour%12;
    hour=(hour*Math.PI/6)+
    (minute*Math.PI/(6*60))+
    (second*Math.PI/(360*60));
    ctx.strokeStyle = 'white';
    drawHand(ctx, hour, radius*0.5, radius*0.085);
    //minute
    minute=(minute*Math.PI/30)+(second*Math.PI/(30*60));
    ctx.strokeStyle = 'white';
    drawHand(ctx, minute, radius*0.75, radius*0.07);
    // second
    second=(second*Math.PI/30);
    ctx.strokeStyle = 'red'
    drawHand(ctx, second, radius*0.9, radius*0.04);
}

function drawHand(ctx, pos, length, width) {
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.moveTo(0,0);
  ctx.rotate(pos);
  ctx.lineTo(0, -length);
  ctx.stroke();
  ctx.rotate(-pos);

  if (width > 5) {
    ctx.beginPath();
    ctx.lineWidth = width - 5;
    ctx.strokeStyle = 'lightblue';
    ctx.moveTo(0,0);
    ctx.rotate(pos);
    ctx.lineTo(0, -length);
    ctx.stroke();
    ctx.rotate(-pos);
  }
}

function drawDegrees(ctx, radius) {
  const length = 0.4 * radius;
  for(let num = 0; num < 360 ; num += 6) {
    ctx.strokeStyle='white';
    ctx.lineWidth = 1;
    if (num===180) {
      ctx.strokeStyle='black';
      ctx.fillStyle='red';
      //triangle/arrow
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.moveTo(0, -radius*1.05);
      ctx.lineTo(-radius*.06, -radius*.875);
      ctx.lineTo( radius*.06, -radius*.875);
      ctx.lineTo(0, -radius*1.05);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle=ctx.fillStyle='red';
      ctx.beginPath();
      ctx.font = radius*0.2 + "px arial";
      ctx.translate(0, -radius*.3);
      ctx.lineWidth = 8;
      ctx.translate(0, radius*.3);
      ctx.stroke();
    }
    ctx.beginPath();
    const ang = num * Math.PI / 180;
    ctx.moveTo(0,0);
    ctx.rotate(ang);
    ctx.moveTo(0, 0.5 * radius);
    ctx.lineTo(0, length);
    ctx.stroke();
    ctx.rotate(-ang);
  }
}

function drawCompass(ctx, radius) {
  ctx.strokeStyle='white';
  ctx.textBaseline='middle';
  ctx.textAlign='center';
  if (!geolocation.isTracking()) {
    ctx.translate(0, -radius*0.15);
    ctx.fillStyle = 'white';
    ctx.font = radius*0.15 + "px arial";
    ctx.fillText('Geolocation paused', 0, 0);
    ctx.translate(0, radius*0.15);
    return;
  }
  const heading = 2 * Math.PI - geolocation.rotation;
  for(let num = 0; num < 12; ++num) {
    const ang = num * Math.PI / 6 + heading;
    ctx.rotate(ang);
    ctx.translate(0, -radius*0.6);
    ctx.rotate(-ang);
    ctx.font = radius*0.1 + "px arial";
    ctx.fillStyle = 'white';
    const deg = num * 30
    ctx.fillText(deg.toString(), 0, 0);
    ctx.rotate(ang);
    ctx.translate(0, radius*0.6);
    ctx.rotate(-ang);
  }
  ctx.rotate(heading);
  drawDegrees(ctx, radius);
  ctx.rotate(-heading);
}

function drawSpeed(ctx, radius) {
  ctx.translate(0, radius * .2);
  const x = -radius * 0.3;
  const y = -radius * 0.095;
  ctx.beginPath();
  ctx.fillStyle = 'lightblue';
  ctx.fillRect(x, y, -2*x, -2*y);
  ctx.fillStyle = 'black';
  ctx.strokeStyle = 'white';
  ctx.lineWidth=2;
  ctx.moveTo(-x,y+1);
  ctx.lineTo(-x,-y);
  ctx.moveTo(x+1,-y);
  ctx.lineTo(-x,-y);
  ctx.font = 'bold ' + radius*0.125 + 'px arial black';
  const units = geolocation.getSpeedUnit();
  ctx.fillText(Math.floor(geolocation.speed * 10) / 10 + ' ' + units, 0, 0);
  ctx.stroke();
  ctx.translate(0, -radius * .2);
}

