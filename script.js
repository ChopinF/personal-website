// script.js

class Snowflake {
  constructor() {
    this.reset(true);
    this.size = random(2, 5);
    this.color = color(random(0, 100), random(0, 100), random(0, 100));
  }

  reset(startAtTop = false) {
    this.radius = sqrt(random((width * 0.5) ** 2));
    this.initialAngle = random(0, 360);
    this.posY = startAtTop ? random(-height, 0) : -random(20, 100);
  }

  update(timeSeconds) {
    const angularSpeed = 35;
    const angle = this.initialAngle + angularSpeed * timeSeconds;

    this.posX = width / 2 + this.radius * sin(angle);

    const ySpeed = 8 / this.size;
    this.posY += ySpeed;

    if (this.posY > height + 10) this.reset(false);//when it reaches on the bottom we reset to the top
  }

  display() {
    push();
    noStroke();
    fill(this.color);
    ellipse(this.posX, this.posY, this.size, this.size);
    pop();
  }
}

let snowflakes = [];
let segments1 = [], segments2 = [],
  segments3 = [], segments4 = [], segments5 = [], segments6 = [];
const delayPerSegment = 0.5;


// canvas covers the whole page (content can be taller than the window)
const pageHeight = () => Math.max(windowHeight, document.getElementById('wrapper').offsetHeight);

function setup() {
  const cnv = createCanvas(windowWidth, pageHeight());
  cnv.parent('wrapper');
  pixelDensity(1);
  stroke(0);
  strokeWeight(1);
  noFill();

  buildTree(width * 0.425, 0.97 * height, 30, -PI / 2, 1); // second place
  buildTree(width * 0.58, 0.985 * height, 20, -PI / 2, 2); // thrid place

  [segments1, segments2, segments3, segments4, segments5, segments6].forEach(arr => {
    arr.forEach((s, i) => {
      setTimeout(() => { s.visible = true; }, i * delayPerSegment * 100 * Math.random());
    });
  });

  angleMode(DEGREES);

  for (let i = 0; i < 100; i++) snowflakes.push(new Snowflake());
  frameRate(60);
}

function draw() {
  //  background(255);
  clear();

  stroke(0);
  strokeWeight(1);
  noFill();

  for (const s of segments1) if (s.visible) line(s.x1, s.y1, s.x2, s.y2);
  for (const s of segments2) if (s.visible) line(s.x1, s.y1, s.x2, s.y2);
  for (const s of segments3) if (s.visible) line(s.x1, s.y1, s.x2, s.y2);
  for (const s of segments4) if (s.visible) line(s.x1, s.y1, s.x2, s.y2);
  for (const s of segments5) if (s.visible) line(s.x1, s.y1, s.x2, s.y2);
  for (const s of segments6) if (s.visible) line(s.x1, s.y1, s.x2, s.y2);

  const t = millis() * 0.001;

  for (const flake of snowflakes) {
    flake.update(t);
    flake.display();
  }

  drawEyes();
}

function drawEyes() {
  // left eye
  let leftX = windowWidth / 2 - 9;
  let leftY = height - 304.5;

  // right eye
  let rightX = windowWidth / 2 + 31.5;
  let rightY = height - 304.5;

  // angle between left eye and mouse
  let leftAngle = atan2(mouseY - leftY, mouseX - leftX);

  push();
  translate(leftX, leftY);
  ellipse(0, 1, 40, 40);// exterior circle
  rotate(leftAngle);
  fill(0);
  ellipse(12.5, 0, 25, 25);
  pop();

  // angle between right eye and mouse
  let rightAngle = atan2(mouseY - rightY, mouseX - rightX);

  push();
  translate(rightX, rightY);
  ellipse(0, 1, 40, 40);// exterior circle
  rotate(rightAngle);
  fill(0);
  ellipse(12.5, 0, 25, 25);
  pop();

}

function buildTree(x, y, len, theta, direction) {
  const x2 = x + cos(theta) * len;
  const y2 = y + sin(theta) * len;

  const seg = { x1: x, y1: y, x2, y2, visible: false };
  switch (direction) {
    case 1: segments1.push(seg); break;
    case 2: segments2.push(seg); break;
    case 3: segments3.push(seg); break;
    case 4: segments4.push(seg); break;
    case 5: segments5.push(seg); break;
    case 6: segments6.push(seg); break;
  }

  if (len > 8) {
    const angle = PI / 0.46;
    const multiplicator = 0.69;
    buildTree(x2, y2, len * multiplicator, theta - angle, direction);
    buildTree(x2, y2, len * multiplicator, theta + angle, direction);
  }
}


function windowResized() {
  resizeCanvas(windowWidth, pageHeight());
}
//
