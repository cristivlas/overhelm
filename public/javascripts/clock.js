var clock = {
  canvas: null,
  ctx: null,
  radius: null,
}

function startClock() {
  clock.canvas = document.getElementById('clock');
  clock.ctx = clock.canvas.getContext('2d');
  clock.radius = clock.canvas.height / 2;
  clock.ctx.translate(clock.radius, clock.radius);
  clock.radius *= 0.90
  setInterval(drawClock.bind(this, clock.ctx, clock.radius), 1000);
}

function drawClock(ctx, radius) {
  drawFace(ctx, radius);
  const heading = -geolocation.rotation;
  ctx.rotate(heading);
  [w, h] = [clock.canvas.width, clock.canvas.height]
  drawDegrees(ctx, radius);
  ctx.rotate(-heading);
  drawMinutes(ctx, radius);
  drawNumbers(ctx, radius);
  drawTime(ctx, radius);
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
  
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'red';
  ctx.beginPath();
  ctx.moveTo(0,-radius * .55);
  ctx.lineTo(0,radius * .35);
  ctx.stroke();
}

function drawNumbers(ctx, radius) {
  ctx.fillStyle = 'white';
  ctx.font = radius*0.15 + "px arial";
  ctx.textBaseline="middle";
  ctx.textAlign="center";
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
  ctx.strokeStyle = 'white';
  ctx.textBaseline="middle";
  ctx.textAlign="center";
  for(let num = 0; num < 12; ++num){
    const ang = num * Math.PI / 6;
    ctx.rotate(ang);
    ctx.translate(0, -radius*0.625);
    ctx.rotate(-ang);
    ctx.font = radius*0.08 + "px arial";
    ctx.fillStyle = 'white';
    ctx.fillText((num * 30).toString(), 0, 0);
    if (num===0) {
      ctx.font = radius*0.2 + "px arial";
      ctx.fillStyle = 'red';
      ctx.translate(0, radius*.3);
      ctx.fillText('N', 0, 0);
      ctx.translate(0, -radius*.3);
    }
    ctx.rotate(ang);
    ctx.translate(0, radius*0.625);
    ctx.rotate(-ang);
  }
  const length = 0.45 * radius;
  ctx.lineWidth = 1;
  for(let num = 0; num < 360; num += 6){
    const ang = num * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.rotate(ang);
    ctx.moveTo(0, 0.55 * radius);
    ctx.lineTo(0, length);
    ctx.stroke();
    ctx.rotate(-ang);
  }
}
