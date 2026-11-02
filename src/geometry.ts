// Logo + squircle geometry, copied from the design's SVG generator.
// @ts-nocheck — kept verbatim from the design generator.
export function sqPath(cx: number, cy: number, r: number, n: number, steps: number): string {
  var pts = [];
  for (var i = 0; i < steps; i++) {
    var t = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    var c = Math.cos(t), s = Math.sin(t);
    pts.push((cx + r * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 2 / n)).toFixed(2) + ' ' + (cy + r * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 2 / n)).toFixed(2));
  }
  return 'M' + pts.join(' L') + ' Z';
}

export function makeLogo() {
  var C = 128;
  function f(v) { return v.toFixed(1); }
  function sqp(r) {
    var pts = [];
    for (var i = 0; i < 160; i++) {
      var t = -Math.PI / 2 + (i / 160) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      pts.push(f(C + r * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 0.4)) + ' ' + f(C + r * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.4)));
    }
    return 'M' + pts.join(' L') + ' Z';
  }
  function insq(x, y) { return Math.pow(Math.abs(x - C) / 106, 5) + Math.pow(Math.abs(y - C) / 106, 5) < 1; }
  var P = [22, 236], R0 = 74, R1 = 186, A0 = -80, A1 = 2;
  function pol(r, a) { a = a * Math.PI / 180; return [P[0] + r * Math.cos(a), P[1] + r * Math.sin(a)]; }
  function arc(r, a0, a1) { var s = pol(r, a0), e = pol(r, a1); return 'M' + f(s[0]) + ' ' + f(s[1]) + ' A' + r + ' ' + r + ' 0 0 1 ' + f(e[0]) + ' ' + f(e[1]); }
  function dots(ds) { return ds.map(function (d) { var r = d[2]; return 'M' + f(d[0] - r) + ' ' + f(d[1]) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0'; }).join(''); }
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function U(a, b) { return a + (b - a) * rnd(); }
  function inSector(x, y) { var dx = x - P[0], dy = y - P[1], r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx) * 180 / Math.PI; return r > R0 - 3 && r < R1 + 3 && a > A0 - 2.5 && a < A1 + 2; }
  var small = [], big = [], pile = [], n = 0;
  while (small.length + big.length < 230 && n < 20000) {
    n++;
    var x = U(18, 238), y = U(18, 238);
    if (!insq(x, y) || inSector(x, y)) continue;
    var r = U(0.9, 2.2);
    (r > 1.7 ? big : small).push([x, y, r]);
  }
  for (var i = 0; i < 70; i++) { var p = pol(U(R0 + 6, R1 - 4), A0 - U(3, 13)); if (insq(p[0], p[1])) pile.push([p[0], p[1], U(1.2, 2.8)]); }
  for (var j = 0; j < 120; j++) {
    var edge = rnd() < 0.5 ? R0 : R1, a2 = U(A0 + 2, A1), rr = edge === R1 ? edge + U(3, 9) : edge - U(3, 9), q = pol(rr, a2);
    if (insq(q[0], q[1])) pile.push([q[0], q[1], U(1.2, 2.8)]);
  }
  var o0 = pol(R1, A0), o1 = pol(R1, A1), i1 = pol(R0, A1), i0 = pol(R0, A0);
  var ua = A0 * Math.PI / 180, nx = -Math.sin(ua), ny = Math.cos(ua);
  function off(pt, k) { return [pt[0] + nx * k, pt[1] + ny * k]; }
  function seg(a, b) { return 'M' + f(a[0]) + ' ' + f(a[1]) + ' L' + f(b[0]) + ' ' + f(b[1]); }
  var BA = pol(R0 - 4, A0), BB = pol(R1 + 2, A0), g1 = off(BA, -10), g2 = off(BA, 10);
  return {
    sq: sqp(112), sqIn: sqp(110.5),
    sector: 'M' + f(o0[0]) + ' ' + f(o0[1]) + ' A' + R1 + ' ' + R1 + ' 0 0 1 ' + f(o1[0]) + ' ' + f(o1[1]) + ' L' + f(i1[0]) + ' ' + f(i1[1]) + ' A' + R0 + ' ' + R0 + ' 0 0 0 ' + f(i0[0]) + ' ' + f(i0[1]) + ' Z',
    streaks: arc(100, A0 + 4, A1) + ' ' + arc(130, A0 + 3, A1) + ' ' + arc(160, A0 + 3, A1),
    dotsS: dots(small), dotsB: dots(big), pile: dots(pile),
    blade: seg(BA, BB), rubber: seg(off(BA, 9), off(BB, 9)), spec: seg(off(pol(R0 + 8, A0), -5), off(pol(R1 - 8, A0), -5)),
    gx1: f(g1[0]), gy1: f(g1[1]), gx2: f(g2[0]), gy2: f(g2[1])
  };
}
