// visualizer.js - Psychedelic Three.js reactive visualizer

import * as THREE from 'three';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }       from 'three/addons/postprocessing/ShaderPass.js';

/* ═══════════════════════ SHADERS ═══════════════════════ */

const KaleidoscopeShader = {
  uniforms: {
    tDiffuse: { value: null },
    sides:    { value: 6.0 },
    angle:    { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float sides, angle;
    varying vec2 vUv;
    #define PI 3.14159265359
    void main(){
      vec2 p = vUv - 0.5;
      float r = length(p);
      float a = atan(p.y, p.x) + angle;
      float seg = 2.0 * PI / sides;
      a = mod(a, seg);
      if(a > seg * 0.5) a = seg - a;
      gl_FragColor = texture2D(tDiffuse, vec2(cos(a), sin(a)) * r + 0.5);
    }
  `,
};

const ChromaAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount:   { value: 0.005 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5;
      float r = texture2D(tDiffuse, vUv + d * amount).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - d * amount).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

/* -- main geometry shaders -- */
const geoVert = /* glsl */ `
  uniform float uTime, uBass, uMid, uHigh;
  varying vec3 vNormal, vPos;
  varying float vDisp;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main(){
    vUv = uv;
    float d = sin(position.x*5.0 + uTime*2.0) * uBass * 0.45
            + sin(position.y*7.0 + uTime*1.5) * uMid  * 0.28
            + sin(position.z*9.0 + uTime)     * uHigh * 0.18
            + sin(length(position)*3.0 - uTime*3.0) * uBass * 0.32;
    vec3 np = position + normal * d;
    vNormal   = normalMatrix * normal;
    vPos      = (modelViewMatrix * vec4(np,1.0)).xyz;
    vWorldPos = np;
    vDisp     = d;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(np,1.0);
  }
`;
const geoFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uC1, uC2, uC3;
  uniform sampler2D uTex;
  uniform float uHasTex;
  varying vec3 vNormal, vPos, vWorldPos;
  varying float vDisp;
  varying vec2 vUv;

  #define PI 3.14159265359

  void main(){
    float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(-vPos))), 2.0);
    vec3 c = mix(uC1, uC2, f);
    c = mix(c, uC3, clamp(vDisp*2.0+0.5, 0.0, 1.0));
    c += 0.07 * sin(vPos*8.0 + uTime*2.0);

    if (uHasTex > 0.5) {
      // triplanar mapping - project texture from 3 axes for seamless coverage
      vec3 n = abs(normalize(vWorldPos));
      n = pow(n, vec3(4.0));
      n /= (n.x + n.y + n.z);

      vec2 uvX = vWorldPos.yz * 0.35 + uTime * 0.02;
      vec2 uvY = vWorldPos.xz * 0.35 + uTime * 0.015;
      vec2 uvZ = vWorldPos.xy * 0.35 + uTime * 0.025;

      vec3 texCol = texture2D(uTex, uvX).rgb * n.x
                  + texture2D(uTex, uvY).rgb * n.y
                  + texture2D(uTex, uvZ).rgb * n.z;
      c = mix(c, texCol, 0.55);
    }

    gl_FragColor = vec4(c, 0.92);
  }
`;

/* -- tunnel background shader -- */
const tunnelVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const tunnelFrag = /* glsl */ `
  uniform float uTime, uBass, uMid;
  uniform vec3 uC1, uC2;
  uniform sampler2D uTex;
  uniform float uHasTex;
  varying vec2 vUv;
  #define PI 3.14159265359
  void main(){
    vec2 p = vUv - 0.5;
    float r = length(p);
    float a = atan(p.y, p.x);
    float tx = a / PI;
    float ty = 1.0/(r+0.01) + uTime*1.5;
    float pat = sin(tx*6.0 + ty*3.0 + uTime)*0.5+0.5;
    pat *= sin(ty*2.0)*0.5+0.5;
    pat *= smoothstep(0.0,0.3,r) * smoothstep(1.5,0.2,r);
    pat *= 0.5 + uBass*0.5;
    vec3 c = mix(uC1, uC2, pat) * (0.3 + uMid*0.4);
    if(uHasTex > 0.5){
      vec2 tuv = vec2(tx*0.5+0.5, fract(ty*0.1));
      c = mix(c, texture2D(uTex, tuv).rgb, 0.4);
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

/* ═══════════════════════ PALETTES ═══════════════════════ */
const PALETTES = [
  { c1:[0.6,0.0,1.0], c2:[0.0,0.8,1.0], c3:[1.0,0.0,0.6] },   // purple / cyan / pink
  { c1:[0.0,1.0,0.4], c2:[1.0,1.0,0.0], c3:[0.0,0.5,1.0] },   // green / yellow / blue
  { c1:[1.0,0.1,0.2], c2:[1.0,0.5,0.0], c3:[1.0,0.0,1.0] },   // red / orange / magenta
  { c1:[0.0,0.2,1.0], c2:[0.5,0.0,1.0], c3:[0.0,1.0,0.8] },   // blue / indigo / teal
];

function lerpArr(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }

/* ═══════════════════════ VISUALIZER CLASS ═══════════════════════ */

export class PsychedelicVisualizer {
  constructor(container) {
    this.el   = container;
    this.time = 0;
    this.pIdx = 0;
    this.pT   = 0;
    this.textures = [];
    // camera orbit state (accumulated via drag)
    this.camAzimuth   = 0;
    this.camElevation = 0;
    this.camDist      = 5;
    this._btnDown     = { left: false, right: false };
    this._lastMouse   = { x: 0, y: 0 };
    this._init();
  }

  _init() {
    const W = window.innerWidth, H = window.innerHeight;

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.el.appendChild(this.renderer.domElement);

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 200);
    this.camera.position.z = 5;

    this.scene.add(new THREE.AmbientLight(0x222222));
    const pt = new THREE.PointLight(0xffffff, 1, 50);
    pt.position.set(0, 0, 5);
    this.scene.add(pt);

    this._tunnel();
    this._mainGeo();
    this._secondaryGeo();
    this._particles();
    this._postFX(W, H);

    window.addEventListener('resize', () => this.resize());

    /* ── mouse drag camera control ── */
    window.addEventListener('mousedown', e => {
      if (e.target.closest('#panel')) return;          // ignore UI clicks
      if (e.button === 0) this._btnDown.left  = true;
      if (e.button === 2) this._btnDown.right = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this._btnDown.left  = false;
      if (e.button === 2) this._btnDown.right = false;
    });
    window.addEventListener('mousemove', e => {
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._lastMouse = { x: e.clientX, y: e.clientY };

      if (this._btnDown.left) {                       // left-drag: orbit
        this.camAzimuth   += dx * 0.005;
        this.camElevation  = Math.max(-1.2, Math.min(1.2, this.camElevation - dy * 0.005));
      }
      if (this._btnDown.right) {                      // right-drag: dolly zoom
        this.camDist = Math.max(1.5, Math.min(18, this.camDist - dy * 0.03));
      }
    });
    // prevent context menu on canvas so right-drag works
    this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ── background tunnel ── */
  _tunnel() {
    this.tunMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:{ value:0 }, uBass:{ value:0 }, uMid:{ value:0 },
        uC1:{ value: new THREE.Vector3(...PALETTES[0].c1) },
        uC2:{ value: new THREE.Vector3(...PALETTES[0].c2) },
        uTex:{ value: null }, uHasTex:{ value:0 },
      },
      vertexShader: tunnelVert, fragmentShader: tunnelFrag,
      side: THREE.BackSide,
    });
    this.tunMesh = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 32), this.tunMat);
    this.scene.add(this.tunMesh);
  }

  /* ── central morphing icosahedron ── */
  _mainGeo() {
    const makeUni = () => ({
      uTime:{ value:0 }, uBass:{ value:0 }, uMid:{ value:0 }, uHigh:{ value:0 },
      uC1:{ value: new THREE.Vector3(...PALETTES[0].c1) },
      uC2:{ value: new THREE.Vector3(...PALETTES[0].c2) },
      uC3:{ value: new THREE.Vector3(...PALETTES[0].c3) },
      uTex:{ value: null }, uHasTex:{ value: 0 },
    });
    this.solidMat = new THREE.ShaderMaterial({
      uniforms: makeUni(), vertexShader: geoVert, fragmentShader: geoFrag,
      transparent: true,
    });
    this.wireMat = new THREE.ShaderMaterial({
      uniforms: makeUni(), vertexShader: geoVert, fragmentShader: geoFrag,
      transparent: true, wireframe: true,
    });
    this.solidMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 4), this.solidMat);
    this.wireMesh  = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 3), this.wireMat);
    this.scene.add(this.solidMesh, this.wireMesh);
  }

  /* ── orbiting toroids ── */
  _secondaryGeo() {
    this.toroids = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(...PALETTES[0].c2), metalness: 0.8, roughness: 0.2,
        emissive: new THREE.Color(...PALETTES[0].c1), emissiveIntensity: 0.3,
        wireframe: i % 2 === 0,
      });
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 16, 48), m);
      t.userData = {
        r: 2.8 + i * 0.6, speed: 0.25 + i * 0.12,
        phase: (i / 5) * Math.PI * 2,
        tiltX: Math.random() * Math.PI, tiltY: Math.random() * Math.PI,
      };
      this.scene.add(t);
      this.toroids.push(t);
    }
  }

  /* ── particles ── */
  _particles() {
    const N = 3000;
    const pos  = new Float32Array(N * 3);
    const col  = new Float32Array(N * 3);
    const band = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r  = 3 + Math.random() * 18;
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      pos[i*3+2] = r * Math.cos(ph);
      col[i*3]   = 0.5 + Math.random() * 0.5;
      col[i*3+1] = Math.random() * 0.5;
      col[i*3+2] = 0.5 + Math.random() * 0.5;
      band[i]    = Math.floor(Math.random() * 3);
    }

    this.pGeo = new THREE.BufferGeometry();
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pGeo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    this.pBands = band;
    this.pOrig  = new Float32Array(pos);

    this.particles = new THREE.Points(this.pGeo, new THREE.PointsMaterial({
      size: 0.06, vertexColors: true, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.scene.add(this.particles);
  }

  /* ── post-processing ── */
  _postFX(W, H) {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 1.5, 0.4, 0.85);
    this.composer.addPass(this.bloom);

    this.kaleido = new ShaderPass(KaleidoscopeShader);
    this.composer.addPass(this.kaleido);

    this.chroma = new ShaderPass(ChromaAberrationShader);
    this.composer.addPass(this.chroma);
  }

  /* ═══════════════════════ UPDATE (called per frame) ═══════════════════════ */
  update(ad) {
    const dt = 0.016;
    this.time += dt;
    this.pT   += dt;

    const bass   = ad?.bass   ?? 0;
    const mid    = ad?.mid    ?? 0;
    const high   = ad?.high   ?? 0;
    const kick   = ad?.kick   ?? false;
    const inten  = ad?.intensity ?? 0.5;
    const filt   = ad?.filterCutoff ?? 4000;

    /* palette interpolation */
    if (this.pT > 8) { this.pT = 0; this.pIdx = (this.pIdx + 1) % PALETTES.length; }
    const pA = PALETTES[this.pIdx], pB = PALETTES[(this.pIdx + 1) % PALETTES.length];
    const t  = this.pT / 8;
    const c1 = lerpArr(pA.c1, pB.c1, t);
    const c2 = lerpArr(pA.c2, pB.c2, t);
    const c3 = lerpArr(pA.c3, pB.c3, t);

    /* -- main geometry -- */
    const setU = (mat, extras = {}) => {
      const u = mat.uniforms;
      u.uTime.value = this.time;
      u.uBass.value = bass;  u.uMid.value = mid;  u.uHigh.value = high;
      if (u.uC1) u.uC1.value.set(...(extras.c1 || c1));
      if (u.uC2) u.uC2.value.set(...(extras.c2 || c2));
      if (u.uC3) u.uC3.value.set(...(extras.c3 || c3));
    };
    setU(this.solidMat);
    setU(this.wireMat, { c1: c3, c2: c1, c3: c2 });

    this.solidMesh.rotation.x += 0.003 + bass * 0.012;
    this.solidMesh.rotation.y += 0.005 + mid  * 0.009;
    this.wireMesh.rotation.x  -= 0.002 + bass * 0.009;
    this.wireMesh.rotation.y  -= 0.004 + high * 0.011;
    const s = 1 + bass * 0.35;
    this.solidMesh.scale.setScalar(s);
    this.wireMesh.scale.setScalar(s * 1.04);

    /* -- toroids -- */
    this.toroids.forEach((tor, i) => {
      const u = tor.userData;
      const ang = this.time * u.speed + u.phase;
      const rr  = u.r + mid * 0.5;
      tor.position.set(
        Math.cos(ang) * rr * Math.cos(u.tiltX),
        Math.sin(ang) * rr * Math.cos(u.tiltY),
        Math.sin(ang + u.tiltX) * rr * 0.5,
      );
      tor.rotation.x = this.time * (0.5 + i * 0.2);
      tor.rotation.z = this.time * (0.3 + i * 0.15);
      tor.scale.setScalar(0.8 + (i % 2 === 0 ? bass : high) * 0.55);
      tor.material.emissive.setRGB(...c1);
      tor.material.color.setRGB(...c2);
    });

    /* -- particles -- */
    const pp = this.pGeo.attributes.position.array;
    const cc = this.pGeo.attributes.color.array;
    const op = this.pOrig;
    for (let i = 0, n = pp.length / 3; i < n; i++) {
      const b  = this.pBands[i];
      const e  = b === 0 ? bass : b === 1 ? mid : high;
      const ix = i * 3;
      const ox = op[ix], oy = op[ix+1], oz = op[ix+2];
      const d  = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1;
      const disp = e * 2.2;
      pp[ix]   = ox + (ox/d) * disp + Math.sin(this.time + i * 0.1) * 0.22;
      pp[ix+1] = oy + (oy/d) * disp + Math.cos(this.time + i * 0.13) * 0.22;
      pp[ix+2] = oz + (oz/d) * disp;
      const cm = b === 0 ? c1 : b === 1 ? c2 : c3;
      cc[ix]   = cm[0] * (0.45 + e * 0.55);
      cc[ix+1] = cm[1] * (0.45 + e * 0.55);
      cc[ix+2] = cm[2] * (0.45 + e * 0.55);
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate    = true;
    this.particles.rotation.y += 0.001 + bass * 0.003;
    this.particles.rotation.x += 0.0005;

    /* -- tunnel -- */
    this.tunMat.uniforms.uTime.value = this.time;
    this.tunMat.uniforms.uBass.value = bass;
    this.tunMat.uniforms.uMid.value  = mid;
    this.tunMat.uniforms.uC1.value.set(...c1);
    this.tunMat.uniforms.uC2.value.set(...c2);
    this.tunMesh.rotation.z += 0.001 + bass * 0.005;

    /* -- post-processing -- */
    this.bloom.strength = 1.0 + bass * 1.8 + (filt / 20000) * 0.6;
    this.bloom.radius   = 0.3 + mid * 0.5;
    this.kaleido.uniforms.angle.value = this.time * 0.08;
    this.kaleido.uniforms.sides.value = Math.floor(4 + inten * 6);
    this.chroma.uniforms.amount.value = kick ? 0.018 : 0.003 + bass * 0.009;

    /* -- camera: drag-orbit + gentle auto-sway -- */
    const az  = this.camAzimuth   + Math.sin(this.time * 0.18) * 0.2;
    const el  = this.camElevation + Math.cos(this.time * 0.14) * 0.15;
    const dst = this.camDist;
    this.camera.position.x = Math.sin(az) * dst * Math.cos(el);
    this.camera.position.y = Math.sin(el) * dst * 0.5;
    this.camera.position.z = Math.cos(az) * dst * Math.cos(el);
    this.camera.lookAt(0, 0, 0);

    this.composer.render();
  }

  /* ═══════════════════════ TEXTURE MANAGEMENT ═══════════════════════ */
  applyTexture(dataUrl, mode = 'tunnel') {
    const loader = new THREE.TextureLoader();
    loader.load(dataUrl, tex => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

      if (mode === 'tunnel') {
        this.tunMat.uniforms.uTex.value    = tex;
        this.tunMat.uniforms.uHasTex.value = 1;
      } else {
        // apply to main icosahedron + wireframe via triplanar shader
        this.solidMat.uniforms.uTex.value    = tex;
        this.solidMat.uniforms.uHasTex.value = 1;
        this.wireMat.uniforms.uTex.value     = tex;
        this.wireMat.uniforms.uHasTex.value  = 1;
        // apply to orbiting toroids
        this.toroids.forEach(t => {
          t.material.map = tex;
          t.material.needsUpdate = true;
        });
      }
      this.textures.push({ tex, dataUrl, mode });
    });
  }

  clearTexture() {
    // tunnel
    this.tunMat.uniforms.uHasTex.value = 0;
    // geometry
    this.solidMat.uniforms.uHasTex.value = 0;
    this.wireMat.uniforms.uHasTex.value  = 0;
    this.toroids.forEach(t => {
      t.material.map = null;
      t.material.needsUpdate = true;
    });
  }

  setKaleidoscope(on) { this.kaleido.enabled = on; }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
    this.composer.setSize(W, H);
    this.bloom.resolution.set(W, H);
  }
}
