// Sunumlardaki etkileşimli araçların ortak kütüphanesi.
//
// Düz JavaScript (modül değil) ve SVG. İnternet gerektirmez, HTML dosyası çift
// tıklanarak açıldığında da çalışır. Bütün adlar tek bir IST nesnesinin içindedir.
//
// İstatistik fonksiyonlarının tanımları kitaptakilerle aynıdır ve R ile sınanmıştır:
// kantil R'daki type = 6, varyans n - 1 ile, çarpıklık kitaptaki formülle (m3 / s^3).

(function (global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // İstatistik
  // ---------------------------------------------------------------------------

  // Tohumlu rastgele sayı üreteci (mulberry32): aynı tohum her açılışta aynı veriyi verir
  function rng(tohum) {
    var a = tohum >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normal(n, tohum) {
    var u = rng(tohum), x = [];
    while (x.length < n) {
      var u1 = u() || 1e-12, u2 = u(), r = Math.sqrt(-2 * Math.log(u1));
      x.push(r * Math.cos(2 * Math.PI * u2));
      if (x.length < n) x.push(r * Math.sin(2 * Math.PI * u2));
    }
    return x;
  }

  function tekduze(n, tohum) {
    var u = rng(tohum), x = [];
    for (var i = 0; i < n; i++) x.push(u());
    return x;
  }

  function ustel(n, tohum) {
    var u = rng(tohum), x = [];
    for (var i = 0; i < n; i++) x.push(-Math.log(1 - u()));
    return x;
  }

  function sirala(x) { return x.slice().sort(function (a, b) { return a - b; }); }

  function toplam(x) { var t = 0; for (var i = 0; i < x.length; i++) t += x[i]; return t; }

  function ortalama(x) { return toplam(x) / x.length; }

  function medyan(x) {
    var s = sirala(x), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  // R quantile(x, p, type = 6): (n + 1)p. sıradaki değer, arada doğrusal interpolasyon
  function kantil(x, p) {
    var s = sirala(x), n = s.length, h = (n + 1) * p;
    if (h <= 1) return s[0];
    if (h >= n) return s[n - 1];
    var j = Math.floor(h);
    return s[j - 1] + (h - j) * (s[j] - s[j - 1]);
  }

  function varyans(x) {
    var m = ortalama(x), t = 0;
    for (var i = 0; i < x.length; i++) t += (x[i] - m) * (x[i] - m);
    return t / (x.length - 1);
  }

  function ss(x) { return Math.sqrt(varyans(x)); }

  // Kitaptaki örneklem çarpıklık katsayısı: (1/n) Σ (x - x̄)^3 / s^3
  function carpiklik(x) {
    var m = ortalama(x), t = 0;
    for (var i = 0; i < x.length; i++) t += Math.pow(x[i] - m, 3);
    return (t / x.length) / Math.pow(varyans(x), 1.5);
  }

  function minimum(x) { return Math.min.apply(null, x); }
  function maksimum(x) { return Math.max.apply(null, x); }

  // Aynı değerleri üst üste dizmek için: her gözleme bir yığın sırası
  function yigin(x) {
    var say = {};
    return x.map(function (v) {
      say[v] = (say[v] || 0) + 1;
      return { deger: v, sira: say[v] };
    });
  }

  function histogram(x, alt, ust, genislik) {
    var k = Math.ceil((ust - alt) / genislik - 1e-9), say = [];
    for (var i = 0; i < k; i++) say.push(0);
    for (var j = 0; j < x.length; j++) {
      var v = x[j];
      if (v < alt || v >= ust) continue;
      say[Math.min(k - 1, Math.floor((v - alt) / genislik))]++;
    }
    return say.map(function (c, i) {
      return { x0: alt + i * genislik, x1: alt + (i + 1) * genislik, sayi: c };
    });
  }

  function yaz(v, d) {
    if (d === undefined) d = 1;
    return isFinite(v) ? v.toFixed(d) : "–";
  }

  // ---------------------------------------------------------------------------
  // SVG çizim
  // ---------------------------------------------------------------------------

  var NS = "http://www.w3.org/2000/svg";

  function el(ad, oz, ebeveyn) {
    var e = document.createElementNS(NS, ad);
    for (var k in oz) if (oz[k] !== undefined && oz[k] !== null) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }

  function olcek(d0, d1, r0, r1) {
    return function (v) { return r0 + (v - d0) * (r1 - r0) / (d1 - d0); };
  }

  // Okunaklı tik değerleri (1, 2, 5 × 10^k adımları)
  function tikler(a, b, adet) {
    var adim0 = (b - a) / adet, us = Math.pow(10, Math.floor(Math.log10(adim0)));
    var o = adim0 / us;
    var adim = (o >= 7.5 ? 10 : o >= 3.5 ? 5 : o >= 1.5 ? 2 : 1) * us;
    var t = [], basla = Math.ceil(a / adim - 1e-9) * adim;
    for (var v = basla; v <= b + adim * 1e-9; v += adim) t.push(+v.toFixed(10));
    return { degerler: t, ondalik: Math.max(0, -Math.floor(Math.log10(adim) + 1e-9)) };
  }

  // Bir grafik alanı kurar. Her yeniden çizimde kap temizlenip baştan çizilir;
  // veriler küçük olduğu için bu yeterince hızlıdır ve kodu sade tutar.
  //
  //   ay = {gen, yuk, x: [a, b], y: [a, b], kenar: {sol, sag, ust, alt},
  //         xEtiket, yEtiket, xTik: [..] ya da adet, yEksen: true/false}
  function grafik(kap, ay) {
    kap.innerHTML = "";
    var W = ay.gen, H = ay.yuk;
    var m = { sol: 60, sag: 20, ust: 16, alt: 58 };
    if (ay.kenar) for (var k in ay.kenar) m[k] = ay.kenar[k];
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "ist-grafik",
                          preserveAspectRatio: "xMidYMid meet" }, kap);
    var x = olcek(ay.x[0], ay.x[1], m.sol, W - m.sag);
    var y = olcek(ay.y[0], ay.y[1], H - m.alt, m.ust);
    var eksen = el("g", { class: "ist-eksen" }, svg);
    var cizim = el("g", {}, svg);
    var ust = el("g", {}, svg);

    if (ay.xEksen !== false) {
      el("line", { x1: m.sol, x2: W - m.sag, y1: H - m.alt, y2: H - m.alt }, eksen);
      var tx = Array.isArray(ay.xTik) ? { degerler: ay.xTik, ondalik: ay.xOndalik || 0 }
                                      : tikler(ay.x[0], ay.x[1], ay.xTik || 8);
      tx.degerler.forEach(function (v) {
        var px = x(v);
        el("line", { x1: px, x2: px, y1: H - m.alt, y2: H - m.alt + 7 }, eksen);
        var t = el("text", { x: px, y: H - m.alt + 30, "text-anchor": "middle" }, eksen);
        t.textContent = ay.xBicim ? ay.xBicim(v) : v.toFixed(tx.ondalik);
      });
      if (ay.xEtiket) {
        var te = el("text", { x: W - m.sag, y: H - 6, "text-anchor": "end", class: "ist-etiket" }, eksen);
        te.textContent = ay.xEtiket;
      }
    }

    if (ay.yEksen) {
      var ty = Array.isArray(ay.yTik) ? { degerler: ay.yTik, ondalik: ay.yOndalik || 0 }
                                      : tikler(ay.y[0], ay.y[1], ay.yTik || 5);
      ty.degerler.forEach(function (v) {
        var py = y(v);
        el("line", { x1: m.sol, x2: W - m.sag, y1: py, y2: py, class: "ist-izgara" }, eksen);
        var t = el("text", { x: m.sol - 10, y: py + 7, "text-anchor": "end" }, eksen);
        t.textContent = ay.yBicim ? ay.yBicim(v) : v.toFixed(ty.ondalik);
      });
      if (ay.yEtiket) {
        var tye = el("text", { x: 4, y: m.ust - 2, "text-anchor": "start", class: "ist-etiket" }, eksen);
        tye.textContent = ay.yEtiket;
      }
    }

    function stil(s) {
      s = s || {};
      return { fill: s.dolgu || "none", stroke: s.cizgi || "none",
               "stroke-width": s.kalinlik || 0, "stroke-dasharray": s.kesik || null,
               opacity: s.opaklik };
    }

    return {
      svg: svg, x: x, y: y, W: W, H: H, m: m,
      nokta: function (xv, yv, r, renk) {
        return el("circle", { cx: x(xv), cy: y(yv), r: r, fill: renk }, cizim);
      },
      dikey: function (xv, s) {   // tam yükseklikte ya da s.y0-s.y1 arasında dikey çizgi
        s = s || {};
        var a = el("line", stil({ cizgi: s.renk || "#333", kalinlik: s.kalinlik || 2, kesik: s.kesik }), s.ust ? ust : cizim);
        a.setAttribute("x1", x(xv)); a.setAttribute("x2", x(xv));
        a.setAttribute("y1", s.y0 !== undefined ? y(s.y0) : H - m.alt);
        a.setAttribute("y2", s.y1 !== undefined ? y(s.y1) : m.ust);
        return a;
      },
      yatay: function (yv, s) {
        s = s || {};
        var a = el("line", stil({ cizgi: s.renk || "#333", kalinlik: s.kalinlik || 2, kesik: s.kesik }), cizim);
        a.setAttribute("y1", y(yv)); a.setAttribute("y2", y(yv));
        a.setAttribute("x1", s.x0 !== undefined ? x(s.x0) : m.sol);
        a.setAttribute("x2", s.x1 !== undefined ? x(s.x1) : W - m.sag);
        return a;
      },
      dikdortgen: function (x0, x1, y0, y1, s) {
        var st = stil(s);
        st.x = Math.min(x(x0), x(x1)); st.y = Math.min(y(y0), y(y1));
        st.width = Math.abs(x(x1) - x(x0)); st.height = Math.abs(y(y1) - y(y0));
        return el("rect", st, cizim);
      },
      cizgi: function (xs, ys, s) {   // xs, ys dizileriyle kırık çizgi
        s = s || {};
        var noktalar = xs.map(function (v, i) { return x(v).toFixed(1) + "," + y(ys[i]).toFixed(1); }).join(" ");
        return el("polyline", { points: noktalar, fill: "none", stroke: s.renk || "#333",
                                "stroke-width": s.kalinlik || 2, "stroke-dasharray": s.kesik || null },
                  s.ust ? ust : cizim);
      },
      metin: function (xv, yv, s, oz) {
        oz = oz || {};
        var t = el("text", { x: x(xv), y: y(yv), "text-anchor": oz.hiza || "middle",
                             fill: oz.renk || "#222", "font-size": oz.boyut || null,
                             "font-weight": oz.kalin ? 600 : null }, ust);
        t.textContent = s;
        return t;
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Kontroller ve sayı kartları
  // ---------------------------------------------------------------------------

  // Kaydırıcı: <input type="range"> ve yanında değeri. Reveal, odak bir input
  // üzerindeyken ok tuşlarını slayt değiştirmek için kullanmaz.
  function kaydirici(kap, ay) {
    var lab = document.createElement("label");
    lab.className = "ist-kaydirici";
    var ad = document.createElement("span");
    ad.className = "ist-kaydirici-ad";
    ad.textContent = ay.etiket;
    var gir = document.createElement("input");
    gir.type = "range";
    gir.min = ay.min; gir.max = ay.max; gir.step = ay.adim || 1; gir.value = ay.deger;
    var cik = document.createElement("output");
    var bicim = ay.bicim || function (v) { return v; };
    cik.textContent = bicim(+gir.value);
    gir.addEventListener("input", function () {
      cik.textContent = bicim(+gir.value);
      ay.degisince(+gir.value);
    });
    lab.appendChild(ad); lab.appendChild(gir); lab.appendChild(cik);
    kap.appendChild(lab);
    return gir;
  }

  function kartlar(kap, liste) {
    kap.innerHTML = liste.map(function (k) {
      return '<div class="kart ' + (k.sinif || "") + '">' + k.etiket + "<b>" + k.deger + "</b></div>";
    }).join("");
  }

  function bul(id) {
    var kok = document.getElementById(id);
    if (!kok) throw new Error("IST: araç kutusu bulunamadı: " + id);
    return {
      kok: kok,
      kontrol: kok.querySelector(".ist-kontroller"),
      cizim: kok.querySelector(".ist-cizim"),
      sayilar: kok.querySelector(".sayilar")
    };
  }

  // ---------------------------------------------------------------------------
  // Menü etiketleri: Quarto'nun menü eklentisi (sol alttaki düğme) etiketleri
  // İngilizce yazar ve bunlar için dil ayarı yoktur. Menü kurulunca Türkçeleştirilir.
  // ---------------------------------------------------------------------------

  var MENU_TR = {
    "Slides": "Slaytlar", "Tools": "Araçlar", "Close": "Kapat",
    "Fullscreen": "Tam ekran", "Speaker View": "Konuşmacı görünümü",
    "Slide Overview": "Slaytlara genel bakış", "PDF Export Mode": "PDF görünümü",
    "Scroll View Mode": "Kaydırmalı görünüm", "Toggle Chalkboard": "Tahta",
    "Toggle Notes Canvas": "Slayta yaz", "Download Drawings": "Çizimleri indir",
    "Keyboard Help": "Klavye kısayolları"
  };

  function menuDuzelt() {
    var kok = document.querySelector(".slide-menu-wrapper");
    if (!kok) return;
    var w = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var t = n.nodeValue.trim();
      if (MENU_TR[t]) n.nodeValue = n.nodeValue.replace(t, MENU_TR[t]);
    }
    // Başlığında formül olan slaytlar: menü başlığı textContent'ten alır ve MathML'in
    // içindeki LaTeX kaynağını da yazar ("ℙ(A∣B)\mathbb{P}(A \mid B)"). Kaynağı atıp başlığı yeniden kur.
    var ogeler = kok.querySelectorAll("li[data-slide-h]");
    for (var i = 0; i < ogeler.length; i++) {
      var li = ogeler[i];
      var slayt = global.Reveal.getSlide(+li.getAttribute("data-slide-h"), +(li.getAttribute("data-slide-v") || 0));
      var bas = slayt && slayt.querySelector("h1, h2");
      var yazi = li.querySelector(".slide-menu-item-title");
      if (!bas || !yazi || !bas.querySelector("math")) continue;
      var kopya = bas.cloneNode(true);
      var ek = kopya.querySelectorAll("annotation, annotation-xml");
      for (var j = 0; j < ek.length; j++) ek[j].parentNode.removeChild(ek[j]);
      yazi.innerHTML = kopya.innerHTML.replace(/\s+/g, " ").trim();   // formül MathML olarak kalır, üsler doğru görünür
    }
  }

  // Bu dosya <head> içinde, Reveal'dan önce yüklenir. Sayfa yüklendiğinde Reveal
  // hazırsa hemen, değilse "ready" olayında çalıştır.
  document.addEventListener("DOMContentLoaded", function () {
    var R = global.Reveal;
    if (!R) return;
    if (R.isReady && R.isReady()) setTimeout(menuDuzelt, 0);
    else if (R.on) R.on("ready", function () { setTimeout(menuDuzelt, 0); });
  });

  global.IST = {
    rng: rng, normal: normal, tekduze: tekduze, ustel: ustel,
    ortalama: ortalama, medyan: medyan, kantil: kantil, varyans: varyans, ss: ss,
    carpiklik: carpiklik, minimum: minimum, maksimum: maksimum,
    yigin: yigin, histogram: histogram, yaz: yaz,
    grafik: grafik, tikler: tikler, kaydirici: kaydirici, kartlar: kartlar, bul: bul
  };
})(window);
