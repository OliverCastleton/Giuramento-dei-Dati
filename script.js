/* Il giuramento dei dati — scrollytelling
   Lo scroll non fa "saltare" il quadro da un punto all'altro: ogni sezione
   definisce una inquadratura (telecamera) e tra due sezioni la telecamera
   scivola in modo continuo, legata alla posizione dello scroll e ammorbidita. */
(function () {
  var NEW = { w: 1448, h: 1086 };   // Il giuramento dei dati
  var ORIG = { w: 2000, h: 1551 };  // David, Il giuramento degli Orazi

  var steps = [].slice.call(document.querySelectorAll('.step'));
  var artNew = document.getElementById('art-new');
  var artOrig = document.getElementById('art-orig');
  var vignette = document.querySelector('.vignette');
  var pointer = document.querySelector('.pointer');
  var curve = pointer.querySelector('.curve');
  var head = pointer.querySelector('.head');
  var tag = pointer.querySelector('.tag');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cams = [], centers = [], pointerStep = -1;
  var smoothY = window.scrollY, running = false, last = 0;

  function nums(s) { return s.split(',').map(Number); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------- inquadratura di ogni sezione ----------
  function cameraFor(st) {
    var vw = window.innerWidth, vh = window.innerHeight, m = vw <= 820;
    var mode = st.dataset.mode;
    var f = [NEW.w / 2, NEW.h / 2, NEW.w / 2, NEW.h / 2], box, p;

    if (mode === 'focus') {
      f = nums(st.dataset.focus);
      box = m ? [vw * .84, vh * .34] : [vw * .42, vh * .58];
      p = m ? [vw * .5, vh * .33] : [vw * .66, vh * .5];
    } else if (mode === 'hero') {
      box = m ? [vw * .96, vh * .6] : [vw * .9, vh * .84];
      p = m ? [vw * .5, vh * .36] : [vw * .5, vh * .47];
    } else {
      box = m ? [vw * .96, vh * .46] : [vw * .6, vh * .86];
      p = m ? [vw * .5, vh * .3] : [vw * .655, vh * .5];
    }
    var s = Math.min(box[0] / (2 * f[2]), box[1] / (2 * f[3]));
    s = Math.min(s, m ? 2.6 : 2.3);

    var focus = mode === 'focus';
    return {
      x: f[0], y: f[1], ls: Math.log(s), px: p[0], py: p[1],
      // vignettatura: raggio (in pixel del quadro) e intensità
      vrx: focus ? f[2] * 2 : NEW.w * .85,
      vry: focus ? f[3] * 2 : NEW.h * .85,
      va: focus ? .86 : .5,
      mix: st.dataset.img === 'orig' ? 0 : 1
    };
  }

  function measure() {
    var vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    cams = steps.map(cameraFor);
    var m = window.innerWidth <= 820;
    centers = steps.map(function (st) {
      // telefono: l'inquadratura è "ferma" quando la scheda entra dal basso e il soggetto è libero in alto
      var y = m && !st.classList.contains('center') ? st.offsetTop : st.offsetTop + st.offsetHeight / 2 - vh / 2;
      return clamp(y, 0, max);
    });
    pointerStep = -1;
  }

  // ---------- stato della telecamera per una posizione di scroll ----------
  function stateAt(y) {
    var n = steps.length;
    if (y <= centers[0]) return { cam: cams[0], near: 0, d: 0 };
    if (y >= centers[n - 1]) return { cam: cams[n - 1], near: n - 1, d: 0 };
    var i = 0;
    while (i < n - 2 && y >= centers[i + 1]) i++;
    var t = (y - centers[i]) / Math.max(1, centers[i + 1] - centers[i]);
    // la telecamera resta ferma mentre leggi, poi scivola alla sezione dopo
    var e = smooth((t - .2) / .6);
    var a = cams[i], b = cams[i + 1], c = {};
    for (var k in a) c[k] = lerp(a[k], b[k], e);
    return { cam: c, near: t < .5 ? i : i + 1, d: t < .5 ? t : 1 - t };
  }

  // ---------- disegno ----------
  function render(y) {
    var st = stateAt(y), c = st.cam;
    var s = Math.exp(c.ls);
    var tx = c.px - c.x * s, ty = c.py - c.y * s;

    artNew.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + s + ')';
    artNew.style.opacity = c.mix;

    // l'originale ha la stessa altezza ed è centrato sullo stesso punto: la dissolvenza combacia
    var so = s * NEW.h / ORIG.h;
    var ox = tx + NEW.w * s / 2 - ORIG.w * so / 2, oy = ty + NEW.h * s / 2 - ORIG.h * so / 2;
    artOrig.style.transform = 'translate3d(' + ox + 'px,' + oy + 'px,0) scale(' + so + ')';
    artOrig.style.visibility = c.mix > .995 ? 'hidden' : 'visible';

    // vignettatura morbida centrata sul soggetto
    var rx = c.vrx * s, ry = c.vry * s, a = c.va;
    vignette.style.background = 'radial-gradient(' + rx + 'px ' + ry + 'px at ' + c.px + 'px ' + c.py + 'px,' +
      'rgba(13,10,8,0) 0%, rgba(13,10,8,0) 40%, rgba(13,10,8,' + (a * .55) + ') 68%, rgba(13,10,8,' + a + ') 100%)';

    // freccia: appare quando la sezione è al centro, segue il quadro mentre si muove
    var sec = steps[st.near];
    var w = sec.dataset.mode === 'focus' ? 1 - smooth((st.d - .1) / .2) : 0;
    if (w > 0.001) {
      if (pointerStep !== st.near) setPointer(st.near);
      var an = nums(sec.dataset.anchor);
      pointer.style.transform = 'translate3d(' + (tx + an[0] * s) + 'px,' + (ty + an[1] * s) + 'px,0)';
      pointer.style.visibility = 'visible';
    } else {
      pointer.style.visibility = 'hidden';
    }
    curve.style.strokeDashoffset = 150 * (1 - w);
    head.style.opacity = smooth((w - .75) / .25);
    tag.style.opacity = smooth((w - .35) / .65);
    tag.style.transform = 'translateY(' + (1 - w) * 10 + 'px)';
  }

  // testo dell'etichetta e lato da cui spunta (senza uscire dallo schermo)
  function setPointer(i) {
    pointerStep = i;
    var sec = steps[i], c = cams[i];
    tag.querySelector('b').textContent = sec.dataset.name;
    tag.querySelector('i').textContent = sec.dataset.sub || '';
    var an = nums(sec.dataset.anchor), s = Math.exp(c.ls);
    var sx = c.px + (an[0] - c.x) * s, sy = c.py + (an[1] - c.y) * s;
    var vw = window.innerWidth, off = vw <= 820 ? 80 : 98;
    pointer.className = 'pointer';
    var tw = tag.offsetWidth + off + 12, th = tag.offsetHeight + 70;
    var right = sec.dataset.dir !== 'nw';
    if (right && sx + tw > vw) right = false;
    else if (!right && sx - tw < 0) right = true;
    var up = sy - th > 8;
    pointer.className = 'pointer ' + (up ? (right ? 'ne' : 'nw') : (right ? 'se' : 'sw'));
    // schermi stretti: se l'etichetta non sta da nessun lato, la faccio rientrare
    tag.style.marginLeft = tag.style.marginRight = '';
    if (right) { var o1 = sx + tw - vw; if (o1 > 0) tag.style.marginLeft = -o1 + 'px'; }
    else { var o2 = tw - sx; if (o2 > 0) tag.style.marginRight = -o2 + 'px'; }
  }

  // ---------- ciclo di animazione ----------
  function frame(now) {
    var dt = Math.min(64, now - (last || now)); last = now;
    var target = window.scrollY;
    smoothY = reduce ? target : smoothY + (target - smoothY) * (1 - Math.exp(-dt / 140));
    if (Math.abs(target - smoothY) < .3) smoothY = target;
    render(smoothY);
    if (smoothY !== target) requestAnimationFrame(frame);
    else { running = false; last = 0; }
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  // sezione attiva (per far comparire le schede di testo)
  function updateActive() {
    var line = window.innerHeight * (window.innerWidth <= 820 ? .7 : .55), best = steps[0];
    for (var i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top <= line) best = steps[i];
    steps.forEach(function (s) { s.classList.toggle('is-active', s === best); });
  }

  window.addEventListener('scroll', function () { updateActive(); kick(); }, { passive: true });
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { measure(); render(smoothY); updateActive(); }, 100);
  });

  // si parte sempre dal quadro originale
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function init() {
    if (!location.hash) window.scrollTo(0, 0);
    measure();
    smoothY = window.scrollY;
    render(smoothY);
    updateActive();
  }
  init();
  window.addEventListener('load', init);
})();
