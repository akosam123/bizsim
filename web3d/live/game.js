// BizSim 3D: the game. Recovered from the published page (Oct 11 build) because this source was never
// committed. Variable names are the originals wherever the code matched src/game and web3d/src, and the
// short names that remain belong to code that only existed in the published build (tutorial, growth panel,
// sound, interiors...). Build with:  npm run build:live   (see web3d/live/README.md)
import * as THREE7 from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
import { Clock as on, HalfFloatType as an, NoBlending as sn, Vector2, WebGLRenderTarget as rn } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var CopyShader = {
  name: "CopyShader",
  uniforms: { tDiffuse: { value: null }, opacity: { value: 1 } },
  vertexShader: `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
  fragmentShader: `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`
};
import { ShaderMaterial, UniformsUtils as nn } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
import { BufferGeometry, Float32BufferAttribute, OrthographicCamera, Mesh } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var Pass = class {
  constructor() {
    this.isPass = true, this.enabled = true, this.needsSwap = true, this.clear = false, this.renderToScreen = false;
  }
  setSize() {
  }
  render() {
    console.error("THREE.Pass: .render() must be implemented in derived pass.");
  }
  dispose() {
  }
}, _camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1), FullscreenTriangleGeometry = class extends BufferGeometry {
  constructor() {
    super(), this.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)), this.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  }
}, _geometry = new FullscreenTriangleGeometry(), FullScreenQuad = class {
  constructor(material) {
    this._mesh = new Mesh(_geometry, material);
  }
  dispose() {
    this._mesh.geometry.dispose();
  }
  render(renderer2) {
    renderer2.render(this._mesh, _camera);
  }
  get material() {
    return this._mesh.material;
  }
  set material(value) {
    this._mesh.material = value;
  }
}, ShaderPass = class extends Pass {
  constructor(shader, textureID) {
    super(), this.textureID = textureID !== void 0 ? textureID : "tDiffuse", shader instanceof ShaderMaterial ? (this.uniforms = shader.uniforms, this.material = shader) : shader && (this.uniforms = nn.clone(shader.uniforms), this.material = new ShaderMaterial({
      name: shader.name !== void 0 ? shader.name : "unspecified",
      defines: Object.assign({}, shader.defines),
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    })), this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer2, writeBuffer, readBuffer) {
    this.uniforms[this.textureID] && (this.uniforms[this.textureID].value = readBuffer.texture), this.fsQuad.material = this.material, this.renderToScreen ? (renderer2.setRenderTarget(null), this.fsQuad.render(renderer2)) : (renderer2.setRenderTarget(writeBuffer), this.clear && renderer2.clear(renderer2.autoClearColor, renderer2.autoClearDepth, renderer2.autoClearStencil), this.fsQuad.render(renderer2));
  }
  dispose() {
    this.material.dispose(), this.fsQuad.dispose();
  }
}, MaskPass = class extends Pass {
  constructor(scene, camera2) {
    super(), this.scene = scene, this.camera = camera2, this.clear = true, this.needsSwap = false, this.inverse = false;
  }
  render(renderer2, writeBuffer, readBuffer) {
    let context = renderer2.getContext(), state2 = renderer2.state;
    state2.buffers.color.setMask(false), state2.buffers.depth.setMask(false), state2.buffers.color.setLocked(true), state2.buffers.depth.setLocked(true);
    let writeValue, clearValue;
    this.inverse ? (writeValue = 0, clearValue = 1) : (writeValue = 1, clearValue = 0), state2.buffers.stencil.setTest(true), state2.buffers.stencil.setOp(context.REPLACE, context.REPLACE, context.REPLACE), state2.buffers.stencil.setFunc(context.ALWAYS, writeValue, 4294967295), state2.buffers.stencil.setClear(clearValue), state2.buffers.stencil.setLocked(true), renderer2.setRenderTarget(readBuffer), this.clear && renderer2.clear(), renderer2.render(this.scene, this.camera), renderer2.setRenderTarget(writeBuffer), this.clear && renderer2.clear(), renderer2.render(this.scene, this.camera), state2.buffers.color.setLocked(false), state2.buffers.depth.setLocked(false), state2.buffers.color.setMask(true), state2.buffers.depth.setMask(true), state2.buffers.stencil.setLocked(false), state2.buffers.stencil.setFunc(context.EQUAL, 1, 4294967295), state2.buffers.stencil.setOp(context.KEEP, context.KEEP, context.KEEP), state2.buffers.stencil.setLocked(true);
  }
}, ClearMaskPass = class extends Pass {
  constructor() {
    super(), this.needsSwap = false;
  }
  render(renderer2) {
    renderer2.state.buffers.stencil.setLocked(false), renderer2.state.buffers.stencil.setTest(false);
  }
}, EffectComposer = class {
  constructor(renderer2, renderTarget) {
    if (this.renderer = renderer2, this._pixelRatio = renderer2.getPixelRatio(), renderTarget === void 0) {
      let size = renderer2.getSize(new Vector2());
      this._width = size.width, this._height = size.height, renderTarget = new rn(this._width * this._pixelRatio, this._height * this._pixelRatio, { type: an }), renderTarget.texture.name = "EffectComposer.rt1";
    } else this._width = renderTarget.width, this._height = renderTarget.height;
    this.renderTarget1 = renderTarget, this.renderTarget2 = renderTarget.clone(), this.renderTarget2.texture.name = "EffectComposer.rt2", this.writeBuffer = this.renderTarget1, this.readBuffer = this.renderTarget2, this.renderToScreen = true, this.passes = [], this.copyPass = new ShaderPass(CopyShader), this.copyPass.material.blending = sn, this.clock = new on();
  }
  swapBuffers() {
    let tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer, this.writeBuffer = tmp;
  }
  addPass(pass) {
    this.passes.push(pass), pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  insertPass(pass, index) {
    this.passes.splice(index, 0, pass), pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }
  removePass(pass) {
    let index = this.passes.indexOf(pass);
    index !== -1 && this.passes.splice(index, 1);
  }
  isLastEnabledPass(passIndex) {
    for (let i = passIndex + 1; i < this.passes.length; i++) if (this.passes[i].enabled) return false;
    return true;
  }
  render(deltaTime) {
    deltaTime === void 0 && (deltaTime = this.clock.getDelta());
    let currentRenderTarget = this.renderer.getRenderTarget(), maskActive = false;
    for (let i = 0, il = this.passes.length; i < il; i++) {
      let pass = this.passes[i];
      if (pass.enabled !== false) {
        if (pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass(i), pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive), pass.needsSwap) {
          if (maskActive) {
            let context = this.renderer.getContext(), stencil = this.renderer.state.buffers.stencil;
            stencil.setFunc(context.NOTEQUAL, 1, 4294967295), this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime), stencil.setFunc(context.EQUAL, 1, 4294967295);
          }
          this.swapBuffers();
        }
        MaskPass !== void 0 && (pass instanceof MaskPass ? maskActive = true : pass instanceof ClearMaskPass && (maskActive = false));
      }
    }
    this.renderer.setRenderTarget(currentRenderTarget);
  }
  reset(renderTarget) {
    if (renderTarget === void 0) {
      let size = this.renderer.getSize(new Vector2());
      this._pixelRatio = this.renderer.getPixelRatio(), this._width = size.width, this._height = size.height, renderTarget = this.renderTarget1.clone(), renderTarget.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
    }
    this.renderTarget1.dispose(), this.renderTarget2.dispose(), this.renderTarget1 = renderTarget, this.renderTarget2 = renderTarget.clone(), this.writeBuffer = this.renderTarget1, this.readBuffer = this.renderTarget2;
  }
  setSize(width, height) {
    this._width = width, this._height = height;
    let effectiveWidth = this._width * this._pixelRatio, effectiveHeight = this._height * this._pixelRatio;
    this.renderTarget1.setSize(effectiveWidth, effectiveHeight), this.renderTarget2.setSize(effectiveWidth, effectiveHeight);
    for (let i = 0; i < this.passes.length; i++) this.passes[i].setSize(effectiveWidth, effectiveHeight);
  }
  setPixelRatio(pixelRatio) {
    this._pixelRatio = pixelRatio, this.setSize(this._width, this._height);
  }
  dispose() {
    this.renderTarget1.dispose(), this.renderTarget2.dispose(), this.copyPass.dispose();
  }
};
import { Color as pn } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var RenderPass = class extends Pass {
  constructor(scene, camera2, overrideMaterial = null, clearColor = null, clearAlpha = null) {
    super(), this.scene = scene, this.camera = camera2, this.overrideMaterial = overrideMaterial, this.clearColor = clearColor, this.clearAlpha = clearAlpha, this.clear = true, this.clearDepth = false, this.needsSwap = false, this._oldClearColor = new pn();
  }
  render(renderer2, writeBuffer, readBuffer) {
    let oldAutoClear = renderer2.autoClear;
    renderer2.autoClear = false;
    let oldClearAlpha, oldOverrideMaterial;
    this.overrideMaterial !== null && (oldOverrideMaterial = this.scene.overrideMaterial, this.scene.overrideMaterial = this.overrideMaterial), this.clearColor !== null && (renderer2.getClearColor(this._oldClearColor), renderer2.setClearColor(this.clearColor)), this.clearAlpha !== null && (oldClearAlpha = renderer2.getClearAlpha(), renderer2.setClearAlpha(this.clearAlpha)), this.clearDepth == true && renderer2.clearDepth(), renderer2.setRenderTarget(this.renderToScreen ? null : readBuffer), this.clear === true && renderer2.clear(renderer2.autoClearColor, renderer2.autoClearDepth, renderer2.autoClearStencil), renderer2.render(this.scene, this.camera), this.clearColor !== null && renderer2.setClearColor(this._oldClearColor), this.clearAlpha !== null && renderer2.setClearAlpha(oldClearAlpha), this.overrideMaterial !== null && (this.scene.overrideMaterial = oldOverrideMaterial), renderer2.autoClear = oldAutoClear;
  }
};
import { ColorManagement as mn, RawShaderMaterial as Pn, UniformsUtils as Dn, LinearToneMapping as Cn, ReinhardToneMapping as Qn, CineonToneMapping as bn, AgXToneMapping as En, ACESFilmicToneMapping as Mn, SRGBTransfer as yn } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var OutputShader = {
  name: "OutputShader",
  uniforms: { tDiffuse: { value: null }, toneMappingExposure: { value: 1 } },
  vertexShader: `
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
  fragmentShader: `
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = OptimizedCineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`
}, OutputPass = class extends Pass {
  constructor() {
    super();
    let shader = OutputShader;
    this.uniforms = Dn.clone(shader.uniforms), this.material = new Pn({
      name: shader.name,
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    }), this.fsQuad = new FullScreenQuad(this.material), this._outputColorSpace = null, this._toneMapping = null;
  }
  render(renderer2, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture, this.uniforms.toneMappingExposure.value = renderer2.toneMappingExposure, (this._outputColorSpace !== renderer2.outputColorSpace || this._toneMapping !== renderer2.toneMapping) && (this._outputColorSpace = renderer2.outputColorSpace, this._toneMapping = renderer2.toneMapping, this.material.defines = {}, mn.getTransfer(this._outputColorSpace) === yn && (this.material.defines.SRGB_TRANSFER = ""), this._toneMapping === Cn ? this.material.defines.LINEAR_TONE_MAPPING = "" : this._toneMapping === Qn ? this.material.defines.REINHARD_TONE_MAPPING = "" : this._toneMapping === bn ? this.material.defines.CINEON_TONE_MAPPING = "" : this._toneMapping === Mn ? this.material.defines.ACES_FILMIC_TONE_MAPPING = "" : this._toneMapping === En && (this.material.defines.AGX_TONE_MAPPING = ""), this.material.needsUpdate = true), this.renderToScreen === true ? (renderer2.setRenderTarget(null), this.fsQuad.render(renderer2)) : (renderer2.setRenderTarget(writeBuffer), this.clear && renderer2.clear(renderer2.autoClearColor, renderer2.autoClearDepth, renderer2.autoClearStencil), this.fsQuad.render(renderer2));
  }
  dispose() {
    this.material.dispose(), this.fsQuad.dispose();
  }
};
import { AdditiveBlending, Color as Color3, HalfFloatType as HalfFloatType2, MeshBasicMaterial, ShaderMaterial as ShaderMaterial2, UniformsUtils as UniformsUtils3, Vector2 as Vector22, Vector3, WebGLRenderTarget as WebGLRenderTarget2 } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
import { Color as Hn } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var LuminosityHighPassShader = {
  name: "LuminosityHighPassShader",
  shaderID: "luminosityHighPass",
  uniforms: {
    tDiffuse: { value: null },
    luminosityThreshold: { value: 1 },
    smoothWidth: { value: 1 },
    defaultColor: { value: new Hn(0) },
    defaultOpacity: { value: 0 }
  },
  vertexShader: `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
  fragmentShader: `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
}, UnrealBloomPass = class _UnrealBloomPass extends Pass {
  constructor(resolution, strength, radius, threshold) {
    super(), this.strength = strength !== void 0 ? strength : 1, this.radius = radius, this.threshold = threshold, this.resolution = resolution !== void 0 ? new Vector22(resolution.x, resolution.y) : new Vector22(256, 256), this.clearColor = new Color3(0, 0, 0), this.renderTargetsHorizontal = [], this.renderTargetsVertical = [], this.nMips = 5;
    let resx = Math.round(this.resolution.x / 2), resy = Math.round(this.resolution.y / 2);
    this.renderTargetBright = new WebGLRenderTarget2(resx, resy, { type: HalfFloatType2 }), this.renderTargetBright.texture.name = "UnrealBloomPass.bright", this.renderTargetBright.texture.generateMipmaps = false;
    for (let f = 0; f < this.nMips; f++) {
      let renderTargetHorizonal = new WebGLRenderTarget2(resx, resy, { type: HalfFloatType2 });
      renderTargetHorizonal.texture.name = "UnrealBloomPass.h" + f, renderTargetHorizonal.texture.generateMipmaps = false, this.renderTargetsHorizontal.push(renderTargetHorizonal);
      let renderTargetVertical = new WebGLRenderTarget2(resx, resy, { type: HalfFloatType2 });
      renderTargetVertical.texture.name = "UnrealBloomPass.v" + f, renderTargetVertical.texture.generateMipmaps = false, this.renderTargetsVertical.push(renderTargetVertical), resx = Math.round(resx / 2), resy = Math.round(resy / 2);
    }
    let highPassShader = LuminosityHighPassShader;
    this.highPassUniforms = UniformsUtils3.clone(highPassShader.uniforms), this.highPassUniforms.luminosityThreshold.value = threshold, this.highPassUniforms.smoothWidth.value = 0.01, this.materialHighPassFilter = new ShaderMaterial2({
      uniforms: this.highPassUniforms,
      vertexShader: highPassShader.vertexShader,
      fragmentShader: highPassShader.fragmentShader
    }), this.separableBlurMaterials = [];
    let kernelSizeArray = [3, 5, 7, 9, 11];
    resx = Math.round(this.resolution.x / 2), resy = Math.round(this.resolution.y / 2);
    for (let i = 0; i < this.nMips; i++) this.separableBlurMaterials.push(this.getSeperableBlurMaterial(kernelSizeArray[i])), this.separableBlurMaterials[i].uniforms.invSize.value = new Vector22(1 / resx, 1 / resy), resx = Math.round(resx / 2), resy = Math.round(resy / 2);
    this.compositeMaterial = this.getCompositeMaterial(this.nMips), this.compositeMaterial.uniforms.blurTexture1.value = this.renderTargetsVertical[0].texture, this.compositeMaterial.uniforms.blurTexture2.value = this.renderTargetsVertical[1].texture, this.compositeMaterial.uniforms.blurTexture3.value = this.renderTargetsVertical[2].texture, this.compositeMaterial.uniforms.blurTexture4.value = this.renderTargetsVertical[3].texture, this.compositeMaterial.uniforms.blurTexture5.value = this.renderTargetsVertical[4].texture, this.compositeMaterial.uniforms.bloomStrength.value = strength, this.compositeMaterial.uniforms.bloomRadius.value = 0.1;
    let bloomFactors = [1, 0.8, 0.6, 0.4, 0.2];
    this.compositeMaterial.uniforms.bloomFactors.value = bloomFactors, this.bloomTintColors = [
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1),
      new Vector3(1, 1, 1)
    ], this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors;
    let copyShader = CopyShader;
    this.copyUniforms = UniformsUtils3.clone(copyShader.uniforms), this.blendMaterial = new ShaderMaterial2({
      uniforms: this.copyUniforms,
      vertexShader: copyShader.vertexShader,
      fragmentShader: copyShader.fragmentShader,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true
    }), this.enabled = true, this.needsSwap = false, this._oldClearColor = new Color3(), this.oldClearAlpha = 1, this.basic = new MeshBasicMaterial(), this.fsQuad = new FullScreenQuad(null);
  }
  dispose() {
    for (let i = 0; i < this.renderTargetsHorizontal.length; i++) this.renderTargetsHorizontal[i].dispose();
    for (let t = 0; t < this.renderTargetsVertical.length; t++) this.renderTargetsVertical[t].dispose();
    this.renderTargetBright.dispose();
    for (let t = 0; t < this.separableBlurMaterials.length; t++) this.separableBlurMaterials[t].dispose();
    this.compositeMaterial.dispose(), this.blendMaterial.dispose(), this.basic.dispose(), this.fsQuad.dispose();
  }
  setSize(width, height) {
    let resx = Math.round(width / 2), resy = Math.round(height / 2);
    this.renderTargetBright.setSize(resx, resy);
    for (let i = 0; i < this.nMips; i++) this.renderTargetsHorizontal[i].setSize(resx, resy), this.renderTargetsVertical[i].setSize(resx, resy), this.separableBlurMaterials[i].uniforms.invSize.value = new Vector22(1 / resx, 1 / resy), resx = Math.round(resx / 2), resy = Math.round(resy / 2);
  }
  render(renderer2, o, readBuffer, a, maskActive) {
    renderer2.getClearColor(this._oldClearColor), this.oldClearAlpha = renderer2.getClearAlpha();
    let oldAutoClear = renderer2.autoClear;
    renderer2.autoClear = false, renderer2.setClearColor(this.clearColor, 0), maskActive && renderer2.state.buffers.stencil.setTest(false), this.renderToScreen && (this.fsQuad.material = this.basic, this.basic.map = readBuffer.texture, renderer2.setRenderTarget(null), renderer2.clear(), this.fsQuad.render(renderer2)), this.highPassUniforms.tDiffuse.value = readBuffer.texture, this.highPassUniforms.luminosityThreshold.value = this.threshold, this.fsQuad.material = this.materialHighPassFilter, renderer2.setRenderTarget(this.renderTargetBright), renderer2.clear(), this.fsQuad.render(renderer2);
    let inputRenderTarget = this.renderTargetBright;
    for (let i = 0; i < this.nMips; i++) this.fsQuad.material = this.separableBlurMaterials[i], this.separableBlurMaterials[i].uniforms.colorTexture.value = inputRenderTarget.texture, this.separableBlurMaterials[i].uniforms.direction.value = _UnrealBloomPass.BlurDirectionX, renderer2.setRenderTarget(this.renderTargetsHorizontal[i]), renderer2.clear(), this.fsQuad.render(renderer2), this.separableBlurMaterials[i].uniforms.colorTexture.value = this.renderTargetsHorizontal[i].texture, this.separableBlurMaterials[i].uniforms.direction.value = _UnrealBloomPass.BlurDirectionY, renderer2.setRenderTarget(this.renderTargetsVertical[i]), renderer2.clear(), this.fsQuad.render(renderer2), inputRenderTarget = this.renderTargetsVertical[i];
    this.fsQuad.material = this.compositeMaterial, this.compositeMaterial.uniforms.bloomStrength.value = this.strength, this.compositeMaterial.uniforms.bloomRadius.value = this.radius, this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors, renderer2.setRenderTarget(this.renderTargetsHorizontal[0]), renderer2.clear(), this.fsQuad.render(renderer2), this.fsQuad.material = this.blendMaterial, this.copyUniforms.tDiffuse.value = this.renderTargetsHorizontal[0].texture, maskActive && renderer2.state.buffers.stencil.setTest(true), this.renderToScreen ? (renderer2.setRenderTarget(null), this.fsQuad.render(renderer2)) : (renderer2.setRenderTarget(readBuffer), this.fsQuad.render(renderer2)), renderer2.setClearColor(this._oldClearColor, this.oldClearAlpha), renderer2.autoClear = oldAutoClear;
  }
  getSeperableBlurMaterial(kernelRadius) {
    let coefficients = [];
    for (let i = 0; i < kernelRadius; i++) coefficients.push(0.39894 * Math.exp(-0.5 * i * i / (kernelRadius * kernelRadius)) / kernelRadius);
    return new ShaderMaterial2({
      defines: { KERNEL_RADIUS: kernelRadius },
      uniforms: {
        colorTexture: { value: null },
        invSize: { value: new Vector22(0.5, 0.5) },
        direction: { value: new Vector22(0.5, 0.5) },
        gaussianCoefficients: { value: coefficients }
      },
      vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
      fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`
    });
  }
  getCompositeMaterial(nMips) {
    return new ShaderMaterial2({
      defines: { NUM_MIPS: nMips },
      uniforms: {
        blurTexture1: { value: null },
        blurTexture2: { value: null },
        blurTexture3: { value: null },
        blurTexture4: { value: null },
        blurTexture5: { value: null },
        bloomStrength: { value: 1 },
        bloomFactors: { value: null },
        bloomTintColors: { value: null },
        bloomRadius: { value: 0 }
      },
      vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
      fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`
    });
  }
};
UnrealBloomPass.BlurDirectionX = new Vector22(1, 0), UnrealBloomPass.BlurDirectionY = new Vector22(0, 1);
import { AddEquation, Color as Ln, CustomBlending as Tn, DataTexture as Sn, DepthTexture as Gn, DepthStencilFormat as Rn, DstAlphaFactor, DstColorFactor, HalfFloatType as HalfFloatType3, MeshNormalMaterial as On, NearestFilter, NoBlending as NoBlending2, RepeatWrapping as RepeatWrapping2, RGBAFormat as Un, ShaderMaterial as ShaderMaterial3, UniformsUtils as UniformsUtils4, UnsignedByteType as Yn, UnsignedInt248Type as Xn, WebGLRenderTarget as WebGLRenderTarget3, ZeroFactor } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
import { DataTexture, Matrix4, RepeatWrapping, Vector2 as Vector23, Vector3 as Vector32 } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var GTAOShader = {
  name: "GTAOShader",
  defines: {
    PERSPECTIVE_CAMERA: 1,
    SAMPLES: 16,
    NORMAL_VECTOR_TYPE: 1,
    DEPTH_SWIZZLING: "x",
    SCREEN_SPACE_RADIUS: 0,
    SCREEN_SPACE_RADIUS_SCALE: 100,
    SCENE_CLIP_BOX: 0
  },
  uniforms: {
    tNormal: { value: null },
    tDepth: { value: null },
    tNoise: { value: null },
    resolution: { value: new Vector23() },
    cameraNear: { value: null },
    cameraFar: { value: null },
    cameraProjectionMatrix: { value: new Matrix4() },
    cameraProjectionMatrixInverse: { value: new Matrix4() },
    cameraWorldMatrix: { value: new Matrix4() },
    radius: { value: 0.25 },
    distanceExponent: { value: 1 },
    thickness: { value: 1 },
    distanceFallOff: { value: 1 },
    scale: { value: 1 },
    sceneBoxMin: { value: new Vector32(-1, -1, -1) },
    sceneBoxMax: { value: new Vector32(1, 1, 1) }
  },
  vertexShader: `

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
  fragmentShader: `
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;		
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif
		
		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition(const in vec2 screenPosition, const in float depth) {
			vec4 clipSpacePosition = vec4(vec3(screenPosition, depth) * 2.0 - 1.0, 1.0);
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {  
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {   
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}
		
		void main() {
			float depth = getDepth(vUv.xy);
			if (depth >= 1.0) {
				discard;
				return;
			}
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif
			
			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0, totalWeight = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {
				
				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w); 
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));
				
				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));
				
				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);	

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}		

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);		
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`
}, GTAODepthShader = {
		  name: "GTAODepthShader",
		  defines: { PERSPECTIVE_CAMERA: 1 },
		  uniforms: { tDepth: { value: null }, cameraNear: { value: null }, cameraFar: { value: null } },
		  vertexShader: `
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
		  fragmentShader: `
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`
		}, GTAOBlendShader = {
		  name: "GTAOBlendShader",
		  uniforms: { tDiffuse: { value: null }, intensity: { value: 1 } },
		  vertexShader: `
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
		  fragmentShader: `
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`
		};
function generateMagicSquareNoise(size = 5) {
  let noiseSize = Math.floor(size) % 2 === 0 ? Math.floor(size) + 1 : Math.floor(size), magicSquare = generateMagicSquare(noiseSize), noiseSquareSize = magicSquare.length, data = new Uint8Array(noiseSquareSize * 4);
  for (let inx = 0; inx < noiseSquareSize; ++inx) {
    let iAng = magicSquare[inx], angle = 2 * Math.PI * iAng / noiseSquareSize, randomVec = new Vector32(Math.cos(angle), Math.sin(angle), 0).normalize();
    data[inx * 4] = (randomVec.x * 0.5 + 0.5) * 255, data[inx * 4 + 1] = (randomVec.y * 0.5 + 0.5) * 255, data[inx * 4 + 2] = 127, data[inx * 4 + 3] = 255;
  }
  let noiseTexture = new DataTexture(data, noiseSize, noiseSize);
  return noiseTexture.wrapS = RepeatWrapping, noiseTexture.wrapT = RepeatWrapping, noiseTexture.needsUpdate = true, noiseTexture;
}
function generateMagicSquare(size) {
  let noiseSize = Math.floor(size) % 2 === 0 ? Math.floor(size) + 1 : Math.floor(size), noiseSquareSize = noiseSize * noiseSize, magicSquare = Array(noiseSquareSize).fill(0), i = Math.floor(noiseSize / 2), j2 = noiseSize - 1;
  for (let num = 1; num <= noiseSquareSize; ) {
    if (i === -1 && j2 === noiseSize ? (j2 = noiseSize - 2, i = 0) : (j2 === noiseSize && (j2 = 0), i < 0 && (i = noiseSize - 1)), magicSquare[i * noiseSize + j2] !== 0) {
      j2 -= 2, i++;
      continue;
    } else magicSquare[i * noiseSize + j2] = num++;
    j2++, i--;
  }
  return magicSquare;
}
import { Matrix4 as Matrix42, Vector2 as Vector24, Vector3 as Vector33 } from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var PoissonDenoiseShader = {
  name: "PoissonDenoiseShader",
  defines: {
    SAMPLES: 16,
    SAMPLE_VECTORS: generatePdSamplePointInitializer(16, 2, 1),
    NORMAL_VECTOR_TYPE: 1,
    DEPTH_VALUE_SOURCE: 0
  },
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    tNoise: { value: null },
    resolution: { value: new Vector24() },
    cameraProjectionMatrixInverse: { value: new Matrix42() },
    lumaPhi: { value: 5 },
    depthPhi: { value: 5 },
    normalPhi: { value: 5 },
    radius: { value: 4 },
    index: { value: 0 }
  },
  vertexShader: `

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
  fragmentShader: `

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;
		
		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition(const in vec2 screenPosition, const in float depth) {
			vec4 clipSpacePosition = vec4(vec3(screenPosition, depth) * 2.0 - 1.0, 1.0);
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}
		
		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1    
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1    
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);
			
			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;
		
			denoised += w * neighborColor;
			totalWeight += w;
		}
		
		void main() {
			float depth = getDepth(vUv.xy);	
			vec3 viewNormal = getViewNormal(vUv);	
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);
		
			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}
		
			if (totalWeight > 0.) { 
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`
};
function generatePdSamplePointInitializer(samples, rings, radiusExponent) {
  let poissonDisk = generateDenoiseSamples(samples, rings, radiusExponent), glslCode = "vec3[SAMPLES](";
  for (let i = 0; i < samples; i++) {
    let sample = poissonDisk[i];
    glslCode += `vec3(${sample.x}, ${sample.y}, ${sample.z})${i < samples - 1 ? "," : ")"}`;
  }
  return glslCode;
}
function generateDenoiseSamples(numSamples, numRings, radiusExponent) {
  let samples = [];
  for (let i = 0; i < numSamples; i++) {
    let angle = 2 * Math.PI * numRings * i / numSamples, radius = Math.pow(i / (numSamples - 1), radiusExponent);
    samples.push(new Vector33(Math.cos(angle), Math.sin(angle), radius));
  }
  return samples;
}
var SimplexNoise = class {
  constructor(r = Math) {
    this.grad3 = [
      [1, 1, 0],
      [-1, 1, 0],
      [1, -1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [-1, 0, 1],
      [1, 0, -1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, -1, 1],
      [0, 1, -1],
      [0, -1, -1]
    ], this.grad4 = [
      [0, 1, 1, 1],
      [0, 1, 1, -1],
      [0, 1, -1, 1],
      [0, 1, -1, -1],
      [0, -1, 1, 1],
      [0, -1, 1, -1],
      [0, -1, -1, 1],
      [0, -1, -1, -1],
      [1, 0, 1, 1],
      [1, 0, 1, -1],
      [1, 0, -1, 1],
      [1, 0, -1, -1],
      [-1, 0, 1, 1],
      [-1, 0, 1, -1],
      [-1, 0, -1, 1],
      [-1, 0, -1, -1],
      [1, 1, 0, 1],
      [1, 1, 0, -1],
      [1, -1, 0, 1],
      [1, -1, 0, -1],
      [-1, 1, 0, 1],
      [-1, 1, 0, -1],
      [-1, -1, 0, 1],
      [-1, -1, 0, -1],
      [1, 1, 1, 0],
      [1, 1, -1, 0],
      [1, -1, 1, 0],
      [1, -1, -1, 0],
      [-1, 1, 1, 0],
      [-1, 1, -1, 0],
      [-1, -1, 1, 0],
      [-1, -1, -1, 0]
    ], this.p = [];
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(r.random() * 256);
    this.perm = [];
    for (let t = 0; t < 512; t++) this.perm[t] = this.p[t & 255];
    this.simplex = [
      [0, 1, 2, 3],
      [0, 1, 3, 2],
      [0, 0, 0, 0],
      [0, 2, 3, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 3, 0],
      [0, 2, 1, 3],
      [0, 0, 0, 0],
      [0, 3, 1, 2],
      [0, 3, 2, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 3, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 0, 3],
      [0, 0, 0, 0],
      [1, 3, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 3, 0, 1],
      [2, 3, 1, 0],
      [1, 0, 2, 3],
      [1, 0, 3, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 3, 1],
      [0, 0, 0, 0],
      [2, 1, 3, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 1, 3],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [3, 0, 1, 2],
      [3, 0, 2, 1],
      [0, 0, 0, 0],
      [3, 1, 2, 0],
      [2, 1, 0, 3],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [3, 1, 0, 2],
      [0, 0, 0, 0],
      [3, 2, 0, 1],
      [3, 2, 1, 0]
    ];
  }
  dot(g, x, y) {
    return g[0] * x + g[1] * y;
  }
  dot3(g, x, y, z) {
    return g[0] * x + g[1] * y + g[2] * z;
  }
  dot4(g, x, y, z, w) {
    return g[0] * x + g[1] * y + g[2] * z + g[3] * w;
  }
  noise(xin, yin) {
    let n0, n1, n2, F2 = 0.5 * (Math.sqrt(3) - 1), s = (xin + yin) * F2, n = Math.floor(xin + s), j2 = Math.floor(yin + s), G2 = (3 - Math.sqrt(3)) / 6, t = (n + j2) * G2, X0 = n - t, Y0 = j2 - t, x0 = xin - X0, y0 = yin - Y0, i1, j1;
    x0 > y0 ? (i1 = 1, j1 = 0) : (i1 = 0, j1 = 1);
    let x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = n & 255, jj = j2 & 255, gi0 = this.perm[ii + this.perm[jj]] % 12, gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12, gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12, t0 = 0.5 - x0 * x0 - y0 * y0;
    t0 < 0 ? n0 = 0 : (t0 *= t0, n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0));
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    t1 < 0 ? n1 = 0 : (t1 *= t1, n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1));
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    return t2 < 0 ? n2 = 0 : (t2 *= t2, n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2)), 70 * (n0 + n1 + n2);
  }
  noise3d(xin, yin, zin) {
    let n0, n1, n2, n3, s = (xin + yin + zin) * 0.3333333333333333, i = Math.floor(xin + s), j2 = Math.floor(yin + s), u = Math.floor(zin + s), G3 = 1 / 6, t = (i + j2 + u) * G3, X0 = i - t, Y0 = j2 - t, Z0 = u - t, x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0, i1, j1, k1, i2, j22, k2;
    x0 >= y0 ? y0 >= z0 ? (i1 = 1, j1 = 0, k1 = 0, i2 = 1, j22 = 1, k2 = 0) : x0 >= z0 ? (i1 = 1, j1 = 0, k1 = 0, i2 = 1, j22 = 0, k2 = 1) : (i1 = 0, j1 = 0, k1 = 1, i2 = 1, j22 = 0, k2 = 1) : y0 < z0 ? (i1 = 0, j1 = 0, k1 = 1, i2 = 0, j22 = 1, k2 = 1) : x0 < z0 ? (i1 = 0, j1 = 1, k1 = 0, i2 = 0, j22 = 1, k2 = 1) : (i1 = 0, j1 = 1, k1 = 0, i2 = 1, j22 = 1, k2 = 0);
    let x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j22 + 2 * G3, z2 = z0 - k2 + 2 * G3, x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3, ii = i & 255, jj = j2 & 255, kk = u & 255, gi0 = this.perm[ii + this.perm[jj + this.perm[kk]]] % 12, gi1 = this.perm[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]] % 12, gi2 = this.perm[ii + i2 + this.perm[jj + j22 + this.perm[kk + k2]]] % 12, gi3 = this.perm[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] % 12, t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    t0 < 0 ? n0 = 0 : (t0 *= t0, n0 = t0 * t0 * this.dot3(this.grad3[gi0], x0, y0, z0));
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    t1 < 0 ? n1 = 0 : (t1 *= t1, n1 = t1 * t1 * this.dot3(this.grad3[gi1], x1, y1, z1));
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    t2 < 0 ? n2 = 0 : (t2 *= t2, n2 = t2 * t2 * this.dot3(this.grad3[gi2], x2, y2, z2));
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    return t3 < 0 ? n3 = 0 : (t3 *= t3, n3 = t3 * t3 * this.dot3(this.grad3[gi3], x3, y3, z3)), 32 * (n0 + n1 + n2 + n3);
  }
  noise4d(e, t, o, A) {
    let grad4 = this.grad4, simplex = this.simplex, perm = this.perm, F4 = (Math.sqrt(5) - 1) / 4, G4 = (5 - Math.sqrt(5)) / 20, n0, n1, n2, n3, n4, s = (e + t + o + A) * F4, i = Math.floor(e + s), j2 = Math.floor(t + s), h = Math.floor(o + s), l = Math.floor(A + s), B = (i + j2 + h + l) * G4, X0 = i - B, Y0 = j2 - B, Z0 = h - B, W0 = l - B, x0 = e - X0, y0 = t - Y0, z0 = o - Z0, w0 = A - W0, c1 = x0 > y0 ? 32 : 0, c2 = x0 > z0 ? 16 : 0, c3 = y0 > z0 ? 8 : 0, c4 = x0 > w0 ? 4 : 0, c5 = y0 > w0 ? 2 : 0, c6 = z0 > w0 ? 1 : 0, c7 = c1 + c2 + c3 + c4 + c5 + c6, i1 = simplex[c7][0] >= 3 ? 1 : 0, j1 = simplex[c7][1] >= 3 ? 1 : 0, k1 = simplex[c7][2] >= 3 ? 1 : 0, l1 = simplex[c7][3] >= 3 ? 1 : 0, i2 = simplex[c7][0] >= 2 ? 1 : 0, j22 = simplex[c7][1] >= 2 ? 1 : 0, k2 = simplex[c7][2] >= 2 ? 1 : 0, l2 = simplex[c7][3] >= 2 ? 1 : 0, i3 = simplex[c7][0] >= 1 ? 1 : 0, j3 = simplex[c7][1] >= 1 ? 1 : 0, k3 = simplex[c7][2] >= 1 ? 1 : 0, l3 = simplex[c7][3] >= 1 ? 1 : 0, x1 = x0 - i1 + G4, y1 = y0 - j1 + G4, z1 = z0 - k1 + G4, w1 = w0 - l1 + G4, x2 = x0 - i2 + 2 * G4, y2 = y0 - j22 + 2 * G4, z2 = z0 - k2 + 2 * G4, w2 = w0 - l2 + 2 * G4, x3 = x0 - i3 + 3 * G4, y3 = y0 - j3 + 3 * G4, z3 = z0 - k3 + 3 * G4, w3 = w0 - l3 + 3 * G4, x4 = x0 - 1 + 4 * G4, y4 = y0 - 1 + 4 * G4, z4 = z0 - 1 + 4 * G4, w4 = w0 - 1 + 4 * G4, ii = i & 255, jj = j2 & 255, kk = h & 255, ll2 = l & 255, gi0 = perm[ii + perm[jj + perm[kk + perm[ll2]]]] % 32, gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1 + perm[ll2 + l1]]]] % 32, gi2 = perm[ii + i2 + perm[jj + j22 + perm[kk + k2 + perm[ll2 + l2]]]] % 32, gi3 = perm[ii + i3 + perm[jj + j3 + perm[kk + k3 + perm[ll2 + l3]]]] % 32, gi4 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll2 + 1]]]] % 32, t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
    t0 < 0 ? n0 = 0 : (t0 *= t0, n0 = t0 * t0 * this.dot4(grad4[gi0], x0, y0, z0, w0));
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
    t1 < 0 ? n1 = 0 : (t1 *= t1, n1 = t1 * t1 * this.dot4(grad4[gi1], x1, y1, z1, w1));
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
    t2 < 0 ? n2 = 0 : (t2 *= t2, n2 = t2 * t2 * this.dot4(grad4[gi2], x2, y2, z2, w2));
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
    t3 < 0 ? n3 = 0 : (t3 *= t3, n3 = t3 * t3 * this.dot4(grad4[gi3], x3, y3, z3, w3));
    let t4 = 0.6 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
    return t4 < 0 ? n4 = 0 : (t4 *= t4, n4 = t4 * t4 * this.dot4(grad4[gi4], x4, y4, z4, w4)), 27 * (n0 + n1 + n2 + n3 + n4);
  }
}, GTAOPass = class _GTAOPass extends Pass {
  constructor(scene, camera2, width, height, parameters, aoParameters, pdParameters) {
    super(), this.width = width !== void 0 ? width : 512, this.height = height !== void 0 ? height : 512, this.clear = true, this.camera = camera2, this.scene = scene, this.output = 0, this._renderGBuffer = true, this._visibilityCache = /* @__PURE__ */ new Map(), this.blendIntensity = 1, this.pdRings = 2, this.pdRadiusExponent = 2, this.pdSamples = 16, this.gtaoNoiseTexture = generateMagicSquareNoise(), this.pdNoiseTexture = this.generateNoise(), this.gtaoRenderTarget = new WebGLRenderTarget3(this.width, this.height, { type: HalfFloatType3 }), this.pdRenderTarget = this.gtaoRenderTarget.clone(), this.gtaoMaterial = new ShaderMaterial3({
      defines: Object.assign({}, GTAOShader.defines),
      uniforms: UniformsUtils4.clone(GTAOShader.uniforms),
      vertexShader: GTAOShader.vertexShader,
      fragmentShader: GTAOShader.fragmentShader,
      blending: NoBlending2,
      depthTest: false,
      depthWrite: false
    }), this.gtaoMaterial.definesPERSPECTIVE_CAMERA = this.camera.isPerspectiveCamera ? 1 : 0, this.gtaoMaterial.uniforms.tNoise.value = this.gtaoNoiseTexture, this.gtaoMaterial.uniforms.resolution.value.set(this.width, this.height), this.gtaoMaterial.uniforms.cameraNear.value = this.camera.near, this.gtaoMaterial.uniforms.cameraFar.value = this.camera.far, this.normalMaterial = new On(), this.normalMaterial.blending = NoBlending2, this.pdMaterial = new ShaderMaterial3({
      defines: Object.assign({}, PoissonDenoiseShader.defines),
      uniforms: UniformsUtils4.clone(PoissonDenoiseShader.uniforms),
      vertexShader: PoissonDenoiseShader.vertexShader,
      fragmentShader: PoissonDenoiseShader.fragmentShader,
      depthTest: false,
      depthWrite: false
    }), this.pdMaterial.uniforms.tDiffuse.value = this.gtaoRenderTarget.texture, this.pdMaterial.uniforms.tNoise.value = this.pdNoiseTexture, this.pdMaterial.uniforms.resolution.value.set(this.width, this.height), this.pdMaterial.uniforms.lumaPhi.value = 10, this.pdMaterial.uniforms.depthPhi.value = 2, this.pdMaterial.uniforms.normalPhi.value = 3, this.pdMaterial.uniforms.radius.value = 8, this.depthRenderMaterial = new ShaderMaterial3({
      defines: Object.assign({}, GTAODepthShader.defines),
      uniforms: UniformsUtils4.clone(GTAODepthShader.uniforms),
      vertexShader: GTAODepthShader.vertexShader,
      fragmentShader: GTAODepthShader.fragmentShader,
      blending: NoBlending2
    }), this.depthRenderMaterial.uniforms.cameraNear.value = this.camera.near, this.depthRenderMaterial.uniforms.cameraFar.value = this.camera.far, this.copyMaterial = new ShaderMaterial3({
      uniforms: UniformsUtils4.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blendSrc: DstColorFactor,
      blendDst: ZeroFactor,
      blendEquation: AddEquation,
      blendSrcAlpha: DstAlphaFactor,
      blendDstAlpha: ZeroFactor,
      blendEquationAlpha: AddEquation
    }), this.blendMaterial = new ShaderMaterial3({
      uniforms: UniformsUtils4.clone(GTAOBlendShader.uniforms),
      vertexShader: GTAOBlendShader.vertexShader,
      fragmentShader: GTAOBlendShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: Tn,
      blendSrc: DstColorFactor,
      blendDst: ZeroFactor,
      blendEquation: AddEquation,
      blendSrcAlpha: DstAlphaFactor,
      blendDstAlpha: ZeroFactor,
      blendEquationAlpha: AddEquation
    }), this.fsQuad = new FullScreenQuad(null), this.originalClearColor = new Ln(), this.setGBuffer(parameters ? parameters.depthTexture : void 0, parameters ? parameters.normalTexture : void 0), aoParameters !== void 0 && this.updateGtaoMaterial(aoParameters), pdParameters !== void 0 && this.updatePdMaterial(pdParameters);
  }
  dispose() {
    this.gtaoNoiseTexture.dispose(), this.pdNoiseTexture.dispose(), this.normalRenderTarget.dispose(), this.gtaoRenderTarget.dispose(), this.pdRenderTarget.dispose(), this.normalMaterial.dispose(), this.pdMaterial.dispose(), this.copyMaterial.dispose(), this.depthRenderMaterial.dispose(), this.fsQuad.dispose();
  }
  setGBuffer(depthTexture, normalTexture) {
    depthTexture !== void 0 ? (this.depthTexture = depthTexture, this.normalTexture = normalTexture, this._renderGBuffer = false) : (this.depthTexture = new Gn(), this.depthTexture.format = Rn, this.depthTexture.type = Xn, this.normalRenderTarget = new WebGLRenderTarget3(this.width, this.height, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      type: HalfFloatType3,
      depthTexture: this.depthTexture
    }), this.normalTexture = this.normalRenderTarget.texture, this._renderGBuffer = true);
    let normalVectorType = this.normalTexture ? 1 : 0, depthValueSource = this.depthTexture === this.normalTexture ? "w" : "x";
    this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE = normalVectorType, this.gtaoMaterial.defines.DEPTH_SWIZZLING = depthValueSource, this.gtaoMaterial.uniforms.tNormal.value = this.normalTexture, this.gtaoMaterial.uniforms.tDepth.value = this.depthTexture, this.pdMaterial.defines.NORMAL_VECTOR_TYPE = normalVectorType, this.pdMaterial.defines.DEPTH_SWIZZLING = depthValueSource, this.pdMaterial.uniforms.tNormal.value = this.normalTexture, this.pdMaterial.uniforms.tDepth.value = this.depthTexture, this.depthRenderMaterial.uniforms.tDepth.value = this.normalRenderTarget.depthTexture;
  }
  setSceneClipBox(box) {
    box ? (this.gtaoMaterial.needsUpdate = this.gtaoMaterial.defines.SCENE_CLIP_BOX !== 1, this.gtaoMaterial.defines.SCENE_CLIP_BOX = 1, this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(box.min), this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(box.max)) : (this.gtaoMaterial.needsUpdate = this.gtaoMaterial.defines.SCENE_CLIP_BOX === 0, this.gtaoMaterial.defines.SCENE_CLIP_BOX = 0);
  }
  updateGtaoMaterial(parameters) {
    parameters.radius !== void 0 && (this.gtaoMaterial.uniforms.radius.value = parameters.radius), parameters.distanceExponent !== void 0 && (this.gtaoMaterial.uniforms.distanceExponent.value = parameters.distanceExponent), parameters.thickness !== void 0 && (this.gtaoMaterial.uniforms.thickness.value = parameters.thickness), parameters.distanceFallOff !== void 0 && (this.gtaoMaterial.uniforms.distanceFallOff.value = parameters.distanceFallOff, this.gtaoMaterial.needsUpdate = true), parameters.scale !== void 0 && (this.gtaoMaterial.uniforms.scale.value = parameters.scale), parameters.samples !== void 0 && parameters.samples !== this.gtaoMaterial.defines.SAMPLES && (this.gtaoMaterial.defines.SAMPLES = parameters.samples, this.gtaoMaterial.needsUpdate = true), parameters.screenSpaceRadius !== void 0 && (parameters.screenSpaceRadius ? 1 : 0) !== this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS && (this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS = parameters.screenSpaceRadius ? 1 : 0, this.gtaoMaterial.needsUpdate = true);
  }
  updatePdMaterial(parameters) {
    let updateShader = false;
    parameters.lumaPhi !== void 0 && (this.pdMaterial.uniforms.lumaPhi.value = parameters.lumaPhi), parameters.depthPhi !== void 0 && (this.pdMaterial.uniforms.depthPhi.value = parameters.depthPhi), parameters.normalPhi !== void 0 && (this.pdMaterial.uniforms.normalPhi.value = parameters.normalPhi), parameters.radius !== void 0 && parameters.radius !== this.radius && (this.pdMaterial.uniforms.radius.value = parameters.radius), parameters.radiusExponent !== void 0 && parameters.radiusExponent !== this.pdRadiusExponent && (this.pdRadiusExponent = parameters.radiusExponent, updateShader = true), parameters.rings !== void 0 && parameters.rings !== this.pdRings && (this.pdRings = parameters.rings, updateShader = true), parameters.samples !== void 0 && parameters.samples !== this.pdSamples && (this.pdSamples = parameters.samples, updateShader = true), updateShader && (this.pdMaterial.defines.SAMPLES = this.pdSamples, this.pdMaterial.defines.SAMPLE_VECTORS = generatePdSamplePointInitializer(this.pdSamples, this.pdRings, this.pdRadiusExponent), this.pdMaterial.needsUpdate = true);
  }
  render(renderer2, writeBuffer, readBuffer) {
    switch (this._renderGBuffer && (this.overrideVisibility(), this.renderOverride(renderer2, this.normalMaterial, this.normalRenderTarget, 7829503, 1), this.restoreVisibility()), this.gtaoMaterial.uniforms.cameraNear.value = this.camera.near, this.gtaoMaterial.uniforms.cameraFar.value = this.camera.far, this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix), this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse), this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld), this.renderPass(renderer2, this.gtaoMaterial, this.gtaoRenderTarget, 16777215, 1), this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse), this.renderPass(renderer2, this.pdMaterial, this.pdRenderTarget, 16777215, 1), this.output) {
      case _GTAOPass.OUTPUT.Diffuse:
        this.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture, this.copyMaterial.blending = NoBlending2, this.renderPass(renderer2, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _GTAOPass.OUTPUT.AO:
        this.copyMaterial.uniforms.tDiffuse.value = this.gtaoRenderTarget.texture, this.copyMaterial.blending = NoBlending2, this.renderPass(renderer2, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _GTAOPass.OUTPUT.Denoise:
        this.copyMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture, this.copyMaterial.blending = NoBlending2, this.renderPass(renderer2, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _GTAOPass.OUTPUT.Depth:
        this.depthRenderMaterial.uniforms.cameraNear.value = this.camera.near, this.depthRenderMaterial.uniforms.cameraFar.value = this.camera.far, this.renderPass(renderer2, this.depthRenderMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _GTAOPass.OUTPUT.Normal:
        this.copyMaterial.uniforms.tDiffuse.value = this.normalRenderTarget.texture, this.copyMaterial.blending = NoBlending2, this.renderPass(renderer2, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _GTAOPass.OUTPUT.Default:
        this.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture, this.copyMaterial.blending = NoBlending2, this.renderPass(renderer2, this.copyMaterial, this.renderToScreen ? null : writeBuffer), this.blendMaterial.uniforms.intensity.value = this.blendIntensity, this.blendMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture, this.renderPass(renderer2, this.blendMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      default:
        console.warn("THREE.GTAOPass: Unknown output type.");
    }
  }
  renderPass(renderer2, passMaterial, renderTarget, clearColor, clearAlpha) {
    renderer2.getClearColor(this.originalClearColor);
    let originalClearAlpha = renderer2.getClearAlpha(), originalAutoClear = renderer2.autoClear;
    renderer2.setRenderTarget(renderTarget), renderer2.autoClear = false, clearColor != null && (renderer2.setClearColor(clearColor), renderer2.setClearAlpha(clearAlpha || 0), renderer2.clear()), this.fsQuad.material = passMaterial, this.fsQuad.render(renderer2), renderer2.autoClear = originalAutoClear, renderer2.setClearColor(this.originalClearColor), renderer2.setClearAlpha(originalClearAlpha);
  }
  renderOverride(renderer2, overrideMaterial, renderTarget, clearColor, clearAlpha) {
    renderer2.getClearColor(this.originalClearColor);
    let originalClearAlpha = renderer2.getClearAlpha(), originalAutoClear = renderer2.autoClear;
    renderer2.setRenderTarget(renderTarget), renderer2.autoClear = false, clearColor = overrideMaterial.clearColor || clearColor, clearAlpha = overrideMaterial.clearAlpha || clearAlpha, clearColor != null && (renderer2.setClearColor(clearColor), renderer2.setClearAlpha(clearAlpha || 0), renderer2.clear()), this.scene.overrideMaterial = overrideMaterial, renderer2.render(this.scene, this.camera), this.scene.overrideMaterial = null, renderer2.autoClear = originalAutoClear, renderer2.setClearColor(this.originalClearColor), renderer2.setClearAlpha(originalClearAlpha);
  }
  setSize(width, height) {
    this.width = width, this.height = height, this.gtaoRenderTarget.setSize(width, height), this.normalRenderTarget.setSize(width, height), this.pdRenderTarget.setSize(width, height), this.gtaoMaterial.uniforms.resolution.value.set(width, height), this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix), this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse), this.pdMaterial.uniforms.resolution.value.set(width, height), this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);
  }
  overrideVisibility() {
    let scene = this.scene, cache2 = this._visibilityCache;
    scene.traverse(function(object) {
      cache2.set(object, object.visible), (object.isPoints || object.isLine) && (object.visible = false);
    });
  }
  restoreVisibility() {
    let scene = this.scene, cache2 = this._visibilityCache;
    scene.traverse(function(object) {
      let visible = cache2.get(object);
      object.visible = visible;
    }), cache2.clear();
  }
  generateNoise(size = 64) {
    let simplex = new SimplexNoise(), arraySize = size * size * 4, data = new Uint8Array(arraySize);
    for (let r = 0; r < size; r++) for (let j2 = 0; j2 < size; j2++) {
      let x = r, y = j2;
      data[(r * size + j2) * 4] = (simplex.noise(x, y) * 0.5 + 0.5) * 255, data[(r * size + j2) * 4 + 1] = (simplex.noise(x + size, y) * 0.5 + 0.5) * 255, data[(r * size + j2) * 4 + 2] = (simplex.noise(x, y + size) * 0.5 + 0.5) * 255, data[(r * size + j2) * 4 + 3] = (simplex.noise(x + size, y + size) * 0.5 + 0.5) * 255;
    }
    let noiseTexture = new Sn(data, size, size, Un, Yn);
    return noiseTexture.wrapS = RepeatWrapping2, noiseTexture.wrapT = RepeatWrapping2, noiseTexture.needsUpdate = true, noiseTexture;
  }
};
GTAOPass.OUTPUT = { Default: 0, Diffuse: 1, Depth: 2, Normal: 3, AO: 4, Denoise: 5 };
var BUSINESSES = [
  {
    id: "restaurant",
    name: "Restaurant",
    tagline: "High ticket, high touch. Reputation is everything.",
    emoji: "\u{1F37D}\uFE0F",
    baseTicket: 18,
    cogsRate: 0.38,
    capture: 0.5,
    wagePerStaff: 2600,
    custPerStaffPerDay: 25,
    baseCapacityPerDay: 70,
    productLineCost: 5e3,
    renovationCost: 15e3,
    rentMult: 1.15,
    accent: "#e05b4b",
    affinity: { locals: 1, commuters: 0.8, visitors: 1.3 },
    peakMonth: 12,
    seasonalAmp: 0.1
  },
  {
    id: "convenience",
    name: "Convenience Store",
    tagline: "Thin margins, steady volume. Location is everything.",
    emoji: "\u{1F3EA}",
    baseTicket: 9.5,
    cogsRate: 0.62,
    capture: 0.9,
    wagePerStaff: 2200,
    custPerStaffPerDay: 80,
    baseCapacityPerDay: 160,
    productLineCost: 3500,
    renovationCost: 1e4,
    rentMult: 1,
    accent: "#3d9be9",
    affinity: { locals: 1, commuters: 1.25, visitors: 0.7 },
    peakMonth: 7,
    seasonalAmp: 0.06
  },
  {
    id: "coffee",
    name: "Coffee Shop",
    tagline: "Cheap to run, fickle crowd. Novelty is everything.",
    emoji: "\u2615",
    baseTicket: 7.5,
    cogsRate: 0.3,
    capture: 0.65,
    wagePerStaff: 2300,
    custPerStaffPerDay: 60,
    baseCapacityPerDay: 90,
    productLineCost: 2500,
    renovationCost: 8e3,
    rentMult: 0.7,
    accent: "#b07d4f",
    affinity: { locals: 0.95, commuters: 1.35, visitors: 0.85 },
    peakMonth: 1,
    seasonalAmp: 0.12
  },
  {
    id: "bakery",
    name: "Bakery",
    tagline: "Early mornings, loyal regulars. Consistency is everything.",
    emoji: "\u{1F950}",
    baseTicket: 7,
    cogsRate: 0.28,
    capture: 0.65,
    wagePerStaff: 2250,
    custPerStaffPerDay: 45,
    baseCapacityPerDay: 110,
    productLineCost: 2e3,
    renovationCost: 7e3,
    rentMult: 0.75,
    accent: "#d9995b",
    affinity: { locals: 1.35, commuters: 1, visitors: 0.75 },
    peakMonth: 12,
    seasonalAmp: 0.14
  },
  {
    id: "barber",
    name: "Barbershop",
    tagline: "Almost no goods cost \u2014 you sell skilled hours.",
    emoji: "\u{1F488}",
    baseTicket: 23,
    cogsRate: 0.08,
    capture: 0.2,
    wagePerStaff: 2600,
    custPerStaffPerDay: 12,
    baseCapacityPerDay: 30,
    productLineCost: 3e3,
    renovationCost: 9e3,
    rentMult: 0.5,
    accent: "#7a5fc7",
    affinity: { locals: 1.4, commuters: 0.9, visitors: 0.4 },
    peakMonth: 6,
    seasonalAmp: 0.08
  }
], LOCATIONS = [
  {
    id: "low",
    name: "Quiet Town",
    blurb: "Low population. Cheap rent, loyal locals, slow growth.",
    footTrafficPerDay: 55,
    rent: 1500,
    wageMult: 0.92,
    competitorPressure: 0.15,
    growthPerMonth: 4e-3,
    segmentMix: { locals: 0.75, commuters: 0.2, visitors: 0.05 },
    populationCap: 900
  },
  {
    id: "average",
    name: "Suburb",
    blurb: "Average density. Balanced rent and steady foot traffic.",
    footTrafficPerDay: 120,
    rent: 4400,
    wageMult: 1,
    competitorPressure: 0.5,
    growthPerMonth: 7e-3,
    segmentMix: { locals: 0.5, commuters: 0.4, visitors: 0.1 },
    populationCap: 2200
  },
  {
    id: "high",
    name: "Downtown",
    blurb: "High density. Brutal rent, huge crowds, fierce competition.",
    footTrafficPerDay: 260,
    rent: 9800,
    wageMult: 1.22,
    competitorPressure: 0.85,
    growthPerMonth: 0.01,
    segmentMix: { locals: 0.35, commuters: 0.45, visitors: 0.2 },
    populationCap: 5e3
  }
], SEGMENTS = [
  {
    id: "locals",
    name: "Locals",
    priceElasticity: 0.9,
    marketingResponse: 0.6,
    fatigueSensitivity: 1.3,
    loyaltyRate: 0.06
  },
  {
    id: "commuters",
    name: "Commuters",
    priceElasticity: 1.5,
    marketingResponse: 1,
    fatigueSensitivity: 0.8,
    loyaltyRate: 0.03
  },
  {
    id: "visitors",
    name: "Visitors",
    priceElasticity: 0.6,
    marketingResponse: 1.6,
    fatigueSensitivity: 0.2,
    loyaltyRate: 5e-3
  }
], PRICE_LEVELS = [
  { id: "budget", name: "Budget", mult: 0.75, hint: "-25% ticket" },
  { id: "value", name: "Value", mult: 0.9, hint: "-10% ticket" },
  { id: "standard", name: "Standard", mult: 1, hint: "baseline" },
  { id: "premium", name: "Premium", mult: 1.15, hint: "+15% ticket" },
  { id: "luxury", name: "Luxury", mult: 1.35, hint: "+35% ticket" }
], MARKETING_TIERS = [
  { id: "none", name: "None", cost: 0, boost: 0, desc: "Word of mouth only" },
  { id: "local", name: "Local Ads", cost: 800, boost: 0.15, desc: "+~15% demand" },
  {
    id: "campaign",
    name: "Big Campaign",
    cost: 3e3,
    boost: 0.35,
    desc: "+~35% demand, slows fatigue"
  }
], STARTING_CASH = 2e4, STARTING_RATE = 6, LOAN_CAP = 4e4, LOAN_STEP = 5e3, MAX_STORE_TIER = 3, MAX_PRODUCT_LINES = 5, BANKRUPTCY_FLOOR = -1e4, DEFAULT_MONTHS = 24, TAX_RATE = 0.21, LEASE_TERM = 12, STAFF_BONUS_PER_HEAD = 500, AP_CAP = 12, ACTIVITY_ENERGY_COST = 12, ENERGY_REGEN_PER_MONTH = 8, BURNOUT_THRESHOLD = 20, LOAN_AP = 2, ADS_AP = 2, MANAGER_WAGE_PREMIUM = 0.6, TIER_CAPACITY_MULT = [1, 1.4, 1.9];
function businessOf(id) {
  return BUSINESSES.find((b) => b.id === id);
}
function locationOf(id) {
  return LOCATIONS.find((l) => l.id === id);
}
function priceLevelOf(id) {
  return PRICE_LEVELS.find((p) => p.id === id);
}
var CAST = {
  manager: {
    id: "manager",
    name: "Sam",
    role: "your right hand",
    look: {
      skin: "#c68863",
      hair: "curly",
      hairColor: "#2b2320",
      clothes: "#4c6b4f",
      accessory: "apron"
    }
  },
  landlord: {
    id: "landlord",
    name: "Mrs. Okafor",
    role: "your landlord",
    look: {
      skin: "#8d5a3b",
      hair: "bun",
      hairColor: "#3d3d3d",
      clothes: "#7a4b5e",
      accessory: "brooch"
    }
  },
  banker: {
    id: "banker",
    name: "Mr. Grady",
    role: "your banker",
    look: {
      skin: "#e8b48c",
      hair: "short",
      hairColor: "#9a9a9a",
      clothes: "#33415c",
      accessory: "tie"
    }
  },
  supplier: {
    id: "supplier",
    name: "Tony",
    role: "supplier rep",
    look: {
      skin: "#d99a6c",
      hair: "cap",
      hairColor: "#684b32",
      clothes: "#8a6a3d",
      accessory: "clipboard"
    }
  },
  inspector: {
    id: "inspector",
    name: "Inspector Vega",
    role: "health & safety",
    look: {
      skin: "#b5754a",
      hair: "ponytail",
      hairColor: "#1f1a17",
      clothes: "#3f5570",
      accessory: "clipboard"
    }
  },
  regular: {
    id: "regular",
    name: "Miss June",
    role: "your most loyal regular",
    look: {
      skin: "#f0c8a0",
      hair: "bun",
      hairColor: "#dcdcdc",
      clothes: "#54497a",
      accessory: "glasses"
    }
  },
  accountant: {
    id: "accountant",
    name: "Priya",
    role: "your accountant",
    look: {
      skin: "#a86a3f",
      hair: "long",
      hairColor: "#241d1a",
      clothes: "#356b6e",
      accessory: "glasses"
    }
  },
  contractor: {
    id: "contractor",
    name: "Dee",
    role: "contractor",
    look: {
      skin: "#7c4a2d",
      hair: "short",
      hairColor: "#141210",
      clothes: "#b3833c",
      accessory: "hardhat"
    }
  },
  rival: {
    id: "rival",
    name: "Victor",
    role: "the competition",
    look: {
      skin: "#e3a875",
      hair: "short",
      hairColor: "#20242c",
      clothes: "#5a2f33",
      accessory: "tie"
    }
  },
  influencer: {
    id: "influencer",
    name: "Zoe",
    role: "local influencer",
    look: {
      skin: "#caa06e",
      hair: "long",
      hairColor: "#7a3b8f",
      clothes: "#c2588a",
      accessory: "phone"
    }
  },
  neighbor: {
    id: "neighbor",
    name: "Marcus",
    role: "runs the gym next door",
    look: { skin: "#6e4632", hair: "bald", hairColor: "#1a1a1a", clothes: "#356b6e" }
  }
}, OWNER_PRESETS = [
  {
    name: "Riley",
    look: {
      skin: "#f0c8a0",
      hair: "ponytail",
      hairColor: "#b8583a",
      clothes: "#4a6b9f",
      accessory: "apron"
    }
  },
  {
    name: "Andre",
    look: {
      skin: "#d99a6c",
      hair: "short",
      hairColor: "#241d1a",
      clothes: "#33415c",
      accessory: "apron"
    }
  },
  {
    name: "Imani",
    look: {
      skin: "#8d5a3b",
      hair: "curly",
      hairColor: "#141210",
      clothes: "#b3833c",
      accessory: "apron"
    }
  },
  {
    name: "Ken",
    look: {
      skin: "#e8b48c",
      hair: "short",
      hairColor: "#141210",
      clothes: "#4c6b4f",
      accessory: "apron"
    }
  },
  {
    name: "Malik",
    look: {
      skin: "#6e4632",
      hair: "short",
      hairColor: "#141210",
      clothes: "#c2703d",
      accessory: "apron"
    }
  }
];
function avatarLook(a) {
  return OWNER_PRESETS[Math.max(0, a.skin) % OWNER_PRESETS.length].look;
}
var NAME_POOLS = {
  restaurant: ["Mama Rosa's", "The Golden Spoon", "Ember & Oak", "Lucky Dragon"],
  convenience: ["QuickMart", "Corner Depot", "24/7 Express", "GrabNGo"],
  coffee: ["Bean Scene", "Roast Republic", "The Daily Grind", "Brewtopia"],
  bakery: ["Flour Power", "The Rolling Pin", "Crumb & Crust", "Sweet Rise"],
  barber: ["Fade Factory", "The Sharp Edge", "Clipper City", "Uptown Cuts"]
}, STANCES = ["discount", "quality", "copycat"], STANCE_DESC = {
  discount: "undercutting your prices",
  quality: "competing on quality",
  copycat: "copying your playbook"
};
function playerAttractiveness(s) {
  let priceMult = priceLevelOf(s.priceLevel).mult, valueForMoney = (0.55 + s.reputation / 100 * 0.6 + (s.storeTier - 1) * 0.12) / Math.pow(priceMult, 0.8), freshness = 1 - s.fatigue / 100 * 0.25;
  return valueForMoney * freshness;
}
function competitorAttractiveness(c2) {
  let rampUp = Math.min(1, 0.5 + c2.monthsActive * 0.085), openingBuzz = c2.monthsActive <= 1 ? 1.15 : 1;
  return c2.strength * rampUp * openingBuzz;
}
function stepCompetitors(e, recentMargin) {
  let loc = locationOf(e.location), headlines = [], competitors = e.competitors.map((c2) => ({ ...c2, monthsActive: c2.monthsActive + 1 })), you = playerAttractiveness(e);
  competitors = competitors.filter((c2) => {
    let exitChance = (competitorAttractiveness(c2) < you * 0.62 ? 0.22 : 0.02) + Math.max(0, c2.monthsActive - 14) * 0.02;
    return Math.random() < exitChance ? (headlines.push(`\u{1F3EA} ${c2.name} closed its doors. One less rival on the street.`), false) : true;
  });
  let maxRivals = e.location === "high" ? 3 : e.location === "average" ? 2 : 1;
  if (competitors.length < maxRivals) {
    let marginLure = Math.min(0.6, Math.max(0, recentMargin) * 2), boomLure = e.macro.phase === "boom" ? 0.35 : e.macro.phase === "recession" ? -0.5 : 0, entryChance = loc.competitorPressure * 0.09 * (1 + marginLure + boomLure);
    if (Math.random() < entryChance) {
      let pool = NAME_POOLS[e.business], used = new Set(competitors.map((c2) => c2.name)), available = pool.filter((n) => !used.has(n));
      if (available.length) {
        let m = STANCES[Math.floor(Math.random() * STANCES.length)], c2 = {
          id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          name: available[Math.floor(Math.random() * available.length)],
          stance: m,
          strength: 0.45 + Math.random() * 0.4,
          monthsActive: 0
        };
        competitors.push(c2), headlines.push(`\u{1F3E2} ${c2.name} just opened nearby \u2014 ${STANCE_DESC[c2.stance]}.`);
      }
    }
  }
  let rivalPull = loc.competitorPressure * 0.35 + competitors.reduce((a, c2) => {
    let pull = competitorAttractiveness(c2);
    return c2.stance === "discount" && (pull *= priceLevelOf(e.priceLevel).mult >= 1.15 ? 1.3 : 1), c2.stance === "quality" && (pull *= e.reputation < 50 ? 1.25 : 0.95), a + pull;
  }, 0), i = you / (you + rivalPull);
  return { competitors, headlines, playerShare: i };
}
var EVENTS = [
  {
    id: "viral-review",
    weight: (s) => 1 + s.reputation / 50,
    roll: () => ({
      headline: "\u{1F4C8} A glowing review goes viral! Crowds pour in.",
      good: true,
      repDelta: 6,
      effect: {
        id: "viral-review",
        label: "Viral review",
        monthsLeft: 2,
        demandMult: 1.3,
        cogsMult: 1,
        good: true
      }
    })
  },
  {
    id: "festival",
    weight: () => 1,
    roll: () => ({
      headline: "\u{1F389} A local festival brings the whole area out.",
      good: true,
      effect: {
        id: "festival",
        label: "Local festival",
        monthsLeft: 1,
        demandMult: 1.4,
        cogsMult: 1,
        good: true
      }
    })
  },
  {
    id: "celebrity",
    weight: (s) => 0.3 + s.reputation / 100,
    roll: () => ({
      headline: "\u{1F31F} A celebrity was spotted at your place. Everyone wants in!",
      good: true,
      repDelta: 10,
      effect: {
        id: "celebrity",
        label: "Celebrity buzz",
        monthsLeft: 1,
        demandMult: 1.5,
        cogsMult: 1,
        good: true
      }
    })
  },
  {
    id: "bad-press",
    weight: (s) => 1 + (100 - s.reputation) / 60,
    roll: () => ({
      headline: "\u{1F4C9} A scathing review is making the rounds online.",
      good: false,
      choice: {
        id: "bad-press",
        headline: "\u{1F4C9} A scathing review is going viral",
        body: "A prominent reviewer torched you online and it's spreading. How do you respond?",
        options: [
          {
            label: "Public apology + staff retraining ($1,500)",
            hint: "Costs money now, contains the damage"
          },
          { label: "Ignore it", hint: "Free, but the story runs its course" }
        ]
      }
    })
  },
  {
    id: "supply-spike",
    weight: (s) => (s.supplierDealMonths > 0 ? 0.3 : 1) * (s.macro.phase === "boom" ? 1.5 : 1) * Math.min(1.2, businessOf(s.business).cogsRate * 2.5),
    roll: () => ({
      headline: "\u{1F69A} Supplier prices spike. Your cost of goods jumps.",
      good: false,
      effect: {
        id: "supply-spike",
        label: "Supply costs up",
        monthsLeft: 2,
        demandMult: 1,
        cogsMult: 1.2,
        good: false
      }
    })
  },
  {
    id: "supplier-deal",
    weight: (s) => s.supplierDealMonths > 0 ? 0 : 0.9 * Math.min(1.2, businessOf(s.business).cogsRate * 2.5),
    roll: () => ({
      headline: "\u{1F91D} A supplier is offering a contract.",
      good: true,
      choice: {
        id: "supplier-deal",
        headline: "\u{1F91D} Supplier contract on the table",
        body: "A regional supplier offers to lock in your goods cost 8% below market for 6 months. Signing costs a $1,000 onboarding fee.",
        options: [
          {
            label: "Sign the contract ($1,000)",
            hint: "-8% cost of goods for 6 months, shields you from supply spikes"
          },
          { label: "Stay flexible", hint: "No fee, no protection" }
        ]
      }
    })
  },
  {
    id: "influencer",
    weight: (s) => 0.7 + (s.marketingTier !== "none" ? 0.4 : 0),
    roll: () => ({
      headline: "\u{1F4F1} An influencer wants to feature you.",
      good: true,
      choice: {
        id: "influencer",
        headline: "\u{1F4F1} Influencer collab offer",
        body: "A popular local influencer will feature your business for $2,000. Expect a big rush \u2014 and a crowd that expects something new next time.",
        options: [
          {
            label: "Pay $2,000 for the feature",
            hint: "+40% demand for a month, +8 customer fatigue after"
          },
          { label: "Pass", hint: "Keep the cash" }
        ]
      }
    })
  },
  {
    id: "inspection-notice",
    weight: (s) => s.inspectionDue ? 0 : 0.8,
    roll: () => ({
      headline: "\u{1F4CB} Notice: a health & safety inspector will visit next month.",
      good: false,
      armsInspection: true
    })
  },
  {
    id: "breakdown",
    weight: (s) => s.month < 4 || s.condition >= 45 ? 0 : 0.5 + (45 - s.condition) / 22,
    roll: (s) => ({
      headline: "\u{1F527} The equipment finally gave out \u2014 you knew it was coming. Emergency repairs hurt.",
      good: false,
      cashDelta: -Math.round((1500 + Math.random() * 2e3) * s.macro.cpi),
      conditionDelta: 30
    })
  },
  {
    id: "rate-hike",
    weight: (s) => s.interestRate < 11 && (s.macro.phase === "boom" || s.macro.phase === "steady") ? 0.7 : 0.1,
    roll: () => ({
      headline: "\u{1F3E6} The central bank hiked rates. Borrowing just got pricier.",
      good: false,
      rateDelta: 1
    })
  },
  {
    id: "rate-cut",
    weight: (s) => s.interestRate > 3 && (s.macro.phase === "downturn" || s.macro.phase === "recession") ? 1.2 : 0.15,
    roll: () => ({
      headline: "\u{1F3E6} The central bank cut rates. Loans are cheaper now.",
      good: true,
      rateDelta: -1
    })
  }
];
function maybeRollEvent(e) {
  if (Math.random() > 0.45) return null;
  let weights = EVENTS.map((s) => s.weight(e)), active = new Set(e.effects.map((e2) => e2.id));
  EVENTS.forEach((e2, i) => {
    active.has(e2.id) && (weights[i] = 0);
  });
  let total = weights.reduce((a2, b) => a2 + b, 0);
  if (total <= 0) return null;
  let a = Math.random() * total;
  for (let i = 0; i < EVENTS.length; i++) if (a -= weights[i], a <= 0) return EVENTS[i].roll(e);
  return null;
}
function resolveChoice(s, optionIndex) {
  let c2 = s.pendingChoice;
  if (!c2) return { state: s, lines: [] };
  let next = { ...s, effects: [...s.effects], pendingChoice: null }, lines = [];
  return c2.id === "bad-press" ? optionIndex === 0 ? (next.cash -= 1500, next.reputation = Math.max(0, next.reputation - 3), next.effects.push({
    id: "bad-press",
    label: "Bad press (contained)",
    monthsLeft: 1,
    demandMult: 0.88,
    cogsMult: 1,
    good: false
  }), lines.push("\u{1F9EF} You apologized publicly and retrained staff. The story fizzled early.")) : (next.reputation = Math.max(0, next.reputation - 8), next.effects.push({
    id: "bad-press",
    label: "Bad press",
    monthsLeft: 2,
    demandMult: 0.75,
    cogsMult: 1,
    good: false
  }), lines.push("\u{1F648} You ignored the review. It kept circulating.")) : c2.id === "supplier-deal" ? optionIndex === 0 ? (next.cash -= 1e3, next.supplierDealMonths = 6, lines.push("\u{1F91D} Supplier contract signed: goods cost locked 8% below market for 6 months.")) : lines.push("You passed on the supplier contract.") : c2.id === "influencer" && (optionIndex === 0 ? (next.cash -= 2e3, next.effects.push({
    id: "influencer",
    label: "Influencer feature",
    monthsLeft: 1,
    demandMult: 1.4,
    cogsMult: 1,
    good: true
  }), next.fatigue = Math.min(100, next.fatigue + 8), lines.push("\u{1F4F1} The influencer post is live \u2014 brace for the rush.")) : lines.push("You passed on the influencer collab.")), next.log = [...next.log, ...lines], { state: next, lines };
}
var PHASE_PARAMS = {
  boom: {
    confidence: 1.12,
    inflationMonthly: 6e-3,
    rateAnchor: 8,
    label: "Boom",
    emoji: "\u{1F525}"
  },
  steady: {
    confidence: 1,
    inflationMonthly: 25e-4,
    rateAnchor: 5.5,
    label: "Steady",
    emoji: "\u2696\uFE0F"
  },
  downturn: {
    confidence: 0.92,
    inflationMonthly: 12e-4,
    rateAnchor: 4,
    label: "Downturn",
    emoji: "\u{1F327}\uFE0F"
  },
  recession: {
    confidence: 0.82,
    inflationMonthly: 3e-4,
    rateAnchor: 2.8,
    label: "Recession",
    emoji: "\u{1F9CA}"
  }
}, TRANSITIONS = {
  boom: [0.8, 0.17, 0.03, 0],
  steady: [0.07, 0.84, 0.09, 0],
  downturn: [0.02, 0.16, 0.68, 0.14],
  recession: [0, 0.05, 0.22, 0.73]
}, PHASES = ["boom", "steady", "downturn", "recession"];
function newMacro() {
  return {
    phase: "steady",
    monthsInPhase: 0,
    cpi: 1,
    inflationYoY: 3,
    confidence: 1,
    rateAnchor: PHASE_PARAMS.steady.rateAnchor
  };
}
var PHASE_HEADLINES = {
  boom: "\u{1F4F0} The economy is booming \u2014 consumers are spending freely.",
  steady: "\u{1F4F0} The economy has settled into a steady rhythm.",
  downturn: "\u{1F4F0} Economic slowdown: shoppers are tightening their belts.",
  recession: "\u{1F4F0} Recession declared. Expect lean months ahead."
};
function stepMacro(m) {
  let probs = TRANSITIONS[m.phase], fatigueShift = Math.min(0.15, Math.max(0, (m.monthsInPhase - 8) * 0.02)), A = Math.random() * (1 - fatigueShift * 0), nextPhase = m.phase, idx = PHASES.indexOf(m.phase), adjusted = probs.map((p, i) => i === idx ? p - fatigueShift : p + fatigueShift / 3), total = adjusted.reduce((a, b) => a + b, 0);
  A = Math.random() * total;
  for (let c = 0; c < PHASES.length; c++) if (A -= adjusted[c], A <= 0) {
    nextPhase = PHASES[c];
    break;
  }
  let phaseChanged = nextPhase !== m.phase, params = PHASE_PARAMS[nextPhase], inflation = params.inflationMonthly * (0.7 + Math.random() * 0.6), f = m.cpi * (1 + inflation), g = m.confidence + (params.confidence - m.confidence) * 0.35;
  return {
    macro: {
      phase: nextPhase,
      monthsInPhase: phaseChanged ? 1 : m.monthsInPhase + 1,
      cpi: f,
      inflationYoY: (Math.pow(1 + inflation, 12) - 1) * 100,
      confidence: g,
      rateAnchor: params.rateAnchor
    },
    phaseChanged,
    headline: phaseChanged ? PHASE_HEADLINES[nextPhase] : null
  };
}
function phaseDisplay(phase) {
  return PHASE_PARAMS[phase];
}
var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), FIRST_NAMES = [
  "Maya",
  "Jordan",
  "Chris",
  "Aisha",
  "Leo",
  "Nina",
  "Omar",
  "Tasha",
  "Felix",
  "Rosa",
  "Devon",
  "Kim",
  "Ivan",
  "Gloria",
  "Pete",
  "Simone"
], staffSeq = 0;
function genStaff(role = "staff", t = 0) {
  staffSeq += 1;
  let o = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  return {
    id: `st-${Date.now().toString(36)}-${staffSeq}`,
    name: o,
    skill: role === "manager" ? 4 : 1 + Math.floor(Math.random() * 2),
    hustle: 35 + Math.floor(Math.random() * 60),
    morale: 60 + Math.floor(Math.random() * 20),
    monthsEmployed: t,
    role
  };
}
function buildRoster(count, monthsEmployed = 0) {
  return Array.from({ length: Math.max(1, count) }, () => genStaff("staff", monthsEmployed));
}
function managerOf(s) {
  return s.roster.find((m) => m.role === "manager") ?? null;
}
function reconcileRoster(e) {
  let roster = e.roster.map((m) => ({ ...m }));
  for (; roster.length < e.staff; ) roster.push(genStaff());
  for (; roster.length > e.staff && roster.length > 1; ) {
    let cuttable = roster.filter((m) => m.role !== "manager");
    if (!cuttable.length) break;
    let lowest = cuttable.reduce((a, b) => a.morale <= b.morale ? a : b);
    roster.splice(roster.findIndex((m) => m.id === lowest.id), 1);
  }
  return roster;
}
var ACTIVITIES = [
  {
    id: "serve",
    venue: "inside",
    label: (b) => ({
      restaurant: "Wait the tables",
      coffee: "Serve the line",
      bakery: "Serve the counter",
      convenience: "Work the till",
      barber: "Take the next chair"
    })[b] ?? "Work the floor",
    hint: "+1 AP \xB7 customers remember the owner showing up"
  },
  {
    id: "clean",
    venue: "back",
    label: () => "Deep clean & maintain",
    hint: "+1 AP \xB7 keeps the place from wearing down"
  },
  {
    id: "help",
    venue: "back",
    label: (b) => b === "restaurant" || b === "bakery" ? "Help the kitchen" : "Pitch in out back",
    hint: "+1 AP \xB7 the team notices"
  },
  {
    id: "books",
    venue: "office",
    label: () => "Work the books",
    hint: "+1 AP \xB7 find the quiet leaks"
  },
  {
    id: "scout",
    venue: "street",
    label: () => "Scout the competition",
    hint: "+1 AP \xB7 walk main street, take notes"
  },
  {
    id: "network",
    venue: "street",
    label: () => "Work the market crowd",
    hint: "+1 AP \xB7 faces remember faces"
  }
];
function canDoActivity(s, id) {
  return s.activitiesDone.includes(id) ? { ok: false, why: "Already done this month" } : s.energy < ACTIVITY_ENERGY_COST + 3 ? { ok: false, why: "Too tired \u2014 you need a break" } : { ok: true };
}
function doActivity(e, id) {
  let check = canDoActivity(e, id);
  if (!check.ok) return { state: e, line: check.why };
  let next = {
    ...e,
    roster: e.roster.map((m) => ({ ...m })),
    plan: { ...e.plan },
    log: [...e.log],
    energy: clamp(e.energy - ACTIVITY_ENERGY_COST, 0, 100),
    ap: Math.min(AP_CAP, e.ap + 1),
    activitiesDone: [...e.activitiesDone, id]
  }, line = "";
  if (id === "serve") next.plan.repDelta += 1, next.plan.loyaltyDelta += 3, line = "\u{1F4AA} You worked the front yourself. A few faces will be back because of it. (+1 AP)";
  else if (id === "clean") next.condition = clamp(next.condition + 14, 0, 100), line = "\u{1F9FD} You scrubbed, tightened, and oiled. The place runs like it did on day one. (+1 AP)";
  else if (id === "help") next.roster = next.roster.map((m) => ({ ...m, morale: clamp(m.morale + 5, 0, 100) })), next.plan.moraleDelta += 4, line = "\u{1F91D} You rolled your sleeves up next to the team. They clocked it. (+1 AP)";
  else if (id === "books") next.plan.cogsMult *= 0.985, line = "\u{1F9FE} Two hours in the ledgers found waste nobody was watching. (+1 AP)";
  else if (id === "scout") {
    next.plan.demandMult *= 1.01;
    let rivals = e.competitors;
    line = rivals.length ? `\u{1F575}\uFE0F You walked past ${rivals[0].name} and price-checked everything. ${rivals.length > 1 ? `${rivals.length} rivals in play.` : "Now you know their angle."} (+1 AP)` : "\u{1F575}\uFE0F You walked main street end to end. Quiet out there \u2014 the market is yours for now. (+1 AP)";
  } else id === "network" && (next.plan.repDelta += 1, next.plan.loyaltyDelta += 2, line = "\u{1F91D} An hour at the market square shaking hands. A few of them will come by. (+1 AP)");
  return next.log.push(line), { state: next, line };
}
function canTakeBreak(s) {
  return managerOf(s) ? (s.cooldowns["take-break"] ?? 0) > 0 ? { ok: false, why: "You just got back \u2014 give it a couple of months" } : s.energy >= 85 ? { ok: false, why: "You're fresh \u2014 save the getaway" } : { ok: true } : { ok: false, why: "You need a manager before you can step away" };
}
function takeBreak(s) {
  if (!canTakeBreak(s).ok) return s;
  let mgr = managerOf(s), dip = Math.max(0, 0.05 - (mgr.skill - 3) * 0.02);
  return {
    ...s,
    energy: 100,
    cooldowns: { ...s.cooldowns, "take-break": 3 },
    effects: [
      ...s.effects,
      {
        id: "owner-break",
        label: `${mgr.name} ran the shop while you rested`,
        monthsLeft: 1,
        demandMult: 1 - dip,
        cogsMult: 1,
        good: true
      }
    ],
    log: [...s.log, `\u{1F334} You took a real week off. ${mgr.name} kept the lights on.`]
  };
}
function ventureMonthly(v, t) {
  let monthsOpen = t.month - v.openedMonth;
  if (monthsOpen <= 0) return 0;
  let ramp = Math.min(1, monthsOpen / 3), base = (700 + v.managerSkill * 550) * t.macro.cpi, swing = (t.macro.confidence - 0.95) * 5e3, noise = (Math.random() - 0.45) * 1400;
  return Math.round((base + swing + noise) * ramp);
}
var FIRST = [
  "Dre",
  "Kwame",
  "Tone",
  "Reggie",
  "Sol",
  "Nas",
  "Papi",
  "Rico",
  "Trey",
  "Ced",
  "Boogie",
  "Marv",
  "Jules",
  "Sef",
  "Ova",
  "Quan"
], seq = 0, uid = () => `bb-${Date.now().toString(36)}-${seq++}`;
function makeBarber(partial = {}) {
  let t = partial.skill ?? 1 + Math.floor(Math.random() * 4);
  return {
    id: uid(),
    name: FIRST[Math.floor(Math.random() * FIRST.length)],
    skill: t,
    clientele: partial.clientele ?? Math.floor(Math.random() * 12),
    monthsHeld: 0,
    reliability: partial.reliability ?? 30 + Math.floor(Math.random() * 50),
    rentOwed: 0,
    ...partial
  };
}
function rollApplicants(e, count = 1) {
  let out = [];
  for (let i = 0; i < count; i++) {
    let b = makeBarber(), pitches = [
      `${b.clientele} heads that follow me. I just need a chair.`,
      "Between shops right now. Can start Monday.",
      "My old spot raised rent. I cut clean, ask anybody.",
      "Building my book. Give me a mirror and I'll fill it.",
      "I keep my station spotless and I pay on the first."
    ];
    out.push({ ...b, pitch: pitches[Math.floor(Math.random() * pitches.length)] });
  }
  return out;
}
function chairRent(s) {
  let tier = 1 + (s.storeTier - 1) * 0.25, condition = 0.85 + s.condition / 100 * 0.3, rep = 0.85 + s.reputation / 100 * 0.35;
  return Math.round(420 * tier * condition * rep * s.macro.cpi);
}
function churnChance(b, t) {
  let green = Math.max(0, 3 - b.monthsHeld) * 0.11, rootedness = Math.min(0.28, b.clientele * 6e-3), unreliable = (100 - b.reliability) / 100 * 0.14, shabby = t.condition < 45 ? 0.09 : 0, quiet = t.reputation < 40 ? 0.06 : 0;
  return Math.max(0.02, green + unreliable + shabby + quiet - rootedness);
}
function settleBarberMonth(e, walkInsPerMonth) {
  let log = [], rent = chairRent(e), working = e.ownerChair ? e.barbers.length + 1 : e.barbers.length, result = { rentCollected: 0, unpaid: 0, ownerCuts: 0, walkInsServed: 0, left: [], newRegulars: 0 }, servable = Math.min(walkInsPerMonth, working * 170);
  result.walkInsServed = Math.round(servable);
  let perBarber = working > 0 ? servable / working : 0, barbers = e.barbers.map((b) => ({ ...b }));
  for (let b of barbers) Math.random() * 100 < b.reliability + 25 ? (result.rentCollected += rent, b.rentOwed = 0, b.reliability = Math.min(100, b.reliability + 2)) : (result.unpaid += rent, b.rentOwed += rent, b.reliability = Math.max(0, b.reliability - 8), log.push(`\u{1F4B8} ${b.name} came up short on chair rent this month.`));
  for (let f of barbers) {
    let converted = perBarber * (0.05 + f.skill * 0.02) * (e.reputation / 100);
    f.clientele = Math.round(f.clientele + converted), result.newRegulars += Math.round(converted), f.monthsHeld += 1;
  }
  if (e.ownerChair) {
    let ticket = 23 * e.macro.cpi;
    result.ownerCuts = Math.round(perBarber * ticket);
  }
  let staying = [];
  for (let f of barbers) Math.random() < churnChance(f, e) ? (result.left.push(f.name), log.push(f.monthsHeld <= 2 ? `\u{1F6AA} ${f.name} cleared out their station after ${f.monthsHeld} month${f.monthsHeld === 1 ? "" : "s"}. Barely warmed the seat.` : `\u{1F6AA} ${f.name} left after ${f.monthsHeld} months and took ${f.clientele} regulars with them.`)) : staying.push(f);
  result.rentCollected > 0 && log.push(`\u{1F488} Chair rent collected: $${result.rentCollected.toLocaleString()} from ${barbers.length - result.left.length + result.left.length} chair${barbers.length === 1 ? "" : "s"}.`);
  let empty = Math.max(0, e.chairs - staying.length);
  return empty > 0 && log.push(`\u{1FA91} ${empty} chair${empty === 1 ? "" : "s"} sitting empty \u2014 that's $${(empty * rent).toLocaleString()} you didn't earn.`), { barbers: staying, result, log };
}
var clamp2 = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), SAVE_VERSION = 9;
function ki(business, location, o = "", A = { skin: 0, hair: 0, hairColor: 0 }) {
  let biz = businessOf(business), loc = locationOf(location), startingStaff = Math.max(1, Math.round(biz.baseCapacityPerDay / biz.custPerStaffPerDay));
  return {
    roster: buildRoster(startingStaff),
    unattendedStreak: 0,
    energy: 100,
    ap: 0,
    condition: 90,
    activitiesDone: [],
    ventures: [],
    chairs: business === "barber" ? 3 : 0,
    barbers: [],
    ownerChair: business === "barber",
    chairApplicants: [],
    ownerName: o,
    avatar: A,
    business,
    location,
    month: 0,
    maxMonths: DEFAULT_MONTHS,
    cash: STARTING_CASH,
    loan: 0,
    interestRate: STARTING_RATE,
    reputation: 50,
    fatigue: 0,
    morale: 70,
    loyalty: 0,
    priceLevel: "standard",
    marketingTier: "none",
    staff: startingStaff,
    storeTier: 1,
    productLines: 0,
    macro: newMacro(),
    competitors: [],
    effects: [],
    rentCurrent: Math.round(loc.rent * biz.rentMult),
    leaseMonthsLeft: LEASE_TERM,
    quarterProfit: 0,
    inspectionDue: false,
    supplierDealMonths: 0,
    pendingChoice: null,
    cooldowns: {},
    choiceStats: { bold: 0, steady: 0, thrifty: 0 },
    renovationMonthsLeft: 0,
    plan: {
      demandMult: 1,
      cogsMult: 1,
      repDelta: 0,
      moraleDelta: 0,
      fatigueDelta: 0,
      loyaltyDelta: 0,
      decisionsMade: 0
    },
    currentCards: [],
    completedCards: [],
    monthIntro: "",
    monthStory: [],
    activeMs: 0,
    lastPlayedAt: Date.now(),
    awayRecap: null,
    history: [],
    log: [`Opened a ${biz.name.toLowerCase()} in ${loc.name}. Good luck!`],
    gameOver: false,
    bankrupt: false,
    saveVersion: SAVE_VERSION
  };
}
function launchProductLine(s) {
  let biz = businessOf(s.business), cost = Math.round(biz.productLineCost * s.macro.cpi);
  return s.productLines >= MAX_PRODUCT_LINES || s.cash < cost ? s : {
    ...s,
    cash: s.cash - cost,
    productLines: s.productLines + 1,
    fatigue: clamp2(s.fatigue - 35, 0, 100),
    log: [
      ...s.log,
      `\u{1F195} Launched a new product line for $${cost.toLocaleString()}. Regulars are excited again.`
    ]
  };
}
function renovate(s) {
  let biz = businessOf(s.business), cost = Math.round(biz.renovationCost * s.macro.cpi);
  return s.storeTier >= MAX_STORE_TIER || s.cash < cost || s.renovationMonthsLeft > 0 ? s : {
    ...s,
    cash: s.cash - cost,
    renovationMonthsLeft: 2,
    effects: [
      ...s.effects,
      {
        id: "construction",
        label: "Renovation underway",
        monthsLeft: 2,
        demandMult: 0.95,
        cogsMult: 1,
        good: false
      }
    ],
    log: [
      ...s.log,
      `\u{1F528} Renovation started \u2014 $${cost.toLocaleString()} down, roughly two months of dust ahead.`
    ]
  };
}
function borrow(s) {
  return s.loan + LOAN_STEP > LOAN_CAP ? s : {
    ...s,
    loan: s.loan + LOAN_STEP,
    cash: s.cash + LOAN_STEP,
    log: [
      ...s.log,
      `\u{1F3E6} Borrowed $${LOAN_STEP.toLocaleString()} at ${s.interestRate.toFixed(1)}% APR.`
    ]
  };
}
function repay(s) {
  let amount = Math.min(LOAN_STEP, s.loan);
  return amount <= 0 || s.cash < amount ? s : {
    ...s,
    loan: s.loan - amount,
    cash: s.cash - amount,
    log: [...s.log, `\u{1F3E6} Repaid $${amount.toLocaleString()} of the loan.`]
  };
}
function payStaffBonus(s) {
  let cost = Math.round(s.staff * STAFF_BONUS_PER_HEAD * s.macro.cpi);
  return s.cash < cost || s.morale >= 95 ? s : {
    ...s,
    cash: s.cash - cost,
    morale: clamp2(s.morale + 14, 0, 100),
    log: [...s.log, `\u{1F49D} Paid a $${cost.toLocaleString()} staff bonus. Morale is up.`]
  };
}
function endMonth(prev) {
  let biz = businessOf(prev.business), loc = locationOf(prev.location), A = {
    ...prev,
    effects: prev.effects.map((e) => ({ ...e })),
    competitors: prev.competitors.map((c2) => ({ ...c2 })),
    roster: prev.roster.map((m) => ({ ...m })),
    ventures: [...prev.ventures],
    log: [...prev.log]
  }, month = A.month + 1, eventLabels = [], headlines = [], plan = A.plan, unattended = plan.decisionsMade === 0;
  A.reputation = clamp2(A.reputation + plan.repDelta, 0, 100), A.morale = clamp2(A.morale + plan.moraleDelta, 0, 100), A.fatigue = clamp2(A.fatigue + plan.fatigueDelta, 0, 100), A.loyalty = Math.max(0, A.loyalty + plan.loyaltyDelta);
  let planDemandMult = plan.demandMult, planCogsMult = plan.cogsMult;
  if (unattended) {
    let mgr = managerOf(A), streak = (A.unattendedStreak ?? 0) + 1;
    if (A.unattendedStreak = streak, mgr) {
      let drift = Math.min(0.3, Math.max(5e-3, 0.045 - mgr.skill * 8e-3) + 0.03 * (streak - 1));
      planDemandMult *= 1 - drift, A.morale = clamp2(A.morale - 1.5 * (streak - 1), 0, 100), A.condition = clamp2(A.condition - 2 * (streak - 1), 0, 100), A.log.push(streak <= 1 ? `\u{1F9ED} ${mgr.name} ran the month without you. Steady hands.` : `\u{1F4C9} ${mgr.name} kept the lights on, but that's month ${streak} without you \u2014 corners are getting cut.`);
    } else planDemandMult *= 0.22, planCogsMult *= 1.06, A.morale = clamp2(A.morale - 9, 0, 100), A.log.push("\u{1F6AA} Nobody came to open up. The shop sat dark most days \u2014 the bills didn't.");
  } else A.unattendedStreak = 0;
  A.roster = reconcileRoster(A).map((m) => ({
    ...m,
    monthsEmployed: m.monthsEmployed + 1,
    morale: clamp2(m.morale + (A.morale - m.morale) * 0.25, 0, 100),
    skill: m.hustle >= 65 && m.skill < 5 && Math.random() < 0.09 ? m.skill + 1 : m.skill
  }));
  let macroStep = stepMacro(A.macro);
  A.macro = macroStep.macro, macroStep.headline && (headlines.push(macroStep.headline), A.log.push(macroStep.headline));
  let cpi = A.macro.cpi;
  if (A.interestRate = clamp2(A.interestRate + (A.macro.rateAnchor - A.interestRate) * 0.18 + (Math.random() - 0.5) * 0.5, 2, 14), A.inspectionDue) {
    A.inspectionDue = false;
    let prevRecord = A.history[A.history.length - 1];
    if ((!prevRecord || A.staff >= Math.ceil(prevRecord.customers / 30 / biz.custPerStaffPerDay)) && A.fatigue < 70 && A.morale >= 40) {
      A.reputation = clamp2(A.reputation + 4, 0, 100);
      let line = "\u{1F4CB} \u2705 You passed the health inspection with flying colors. (+4 reputation)";
      headlines.push(line), A.log.push(line), eventLabels.push(line);
    } else {
      let fine = Math.round(2500 * cpi);
      A.cash -= fine, A.reputation = clamp2(A.reputation - 10, 0, 100), A.effects.push({
        id: "failed-inspection",
        label: "Failed inspection",
        monthsLeft: 2,
        demandMult: 0.85,
        cogsMult: 1,
        good: false
      });
      let Ce = `\u{1F4CB} \u274C You failed the health inspection: $${fine.toLocaleString()} fine and the report is public.`;
      headlines.push(Ce), A.log.push(Ce), eventLabels.push(Ce);
    }
  }
  let ev = maybeRollEvent(A), eventHeadline = null, eventGood = true;
  ev && (eventHeadline = ev.headline, eventGood = ev.good, eventLabels.push(ev.headline), ev.effect && A.effects.push({ ...ev.effect }), ev.repDelta && (A.reputation = clamp2(A.reputation + ev.repDelta, 0, 100)), ev.cashDelta && (A.cash += ev.cashDelta), ev.rateDelta && (A.interestRate = clamp2(A.interestRate + ev.rateDelta, 2, 14)), ev.conditionDelta && (A.condition = clamp2(A.condition + ev.conditionDelta, 0, 100)), ev.armsInspection && (A.inspectionDue = true), ev.choice && (A.pendingChoice = ev.choice), A.log.push(eventHeadline));
  let lastRec = A.history[A.history.length - 1], recentMargin = lastRec && lastRec.revenue > 0 ? lastRec.profit / lastRec.revenue : 0.1, comp = stepCompetitors(A, recentMargin);
  A.competitors = comp.competitors, comp.headlines.forEach((h) => {
    headlines.push(h), A.log.push(h);
  });
  let traffic = loc.footTrafficPerDay * Math.pow(1 + loc.growthPerMonth, month), calMonth = (month - 1 + 2) % 12 + 1, seasonality = 1 + biz.seasonalAmp * Math.cos((calMonth - biz.peakMonth) % 12 / 12 * Math.PI * 2), repMult = 0.6 + A.reputation / 100 * 0.8, priceMult = priceLevelOf(A.priceLevel).mult, mkt = MARKETING_TIERS.find((m) => m.id === A.marketingTier), eventMult = A.effects.reduce((m, e) => m * e.demandMult, 1), productMult = 1 + A.productLines * 0.04, conditionMult = A.condition >= 40 ? 1 : 1 - (40 - A.condition) * 4e-3, walkInPerDay = 0, segmentDemand = {};
  for (let seg of SEGMENTS) {
    let base = traffic * loc.segmentMix[seg.id] * biz.capture * biz.affinity[seg.id], priceResponse = Math.pow(priceMult, -seg.priceElasticity), marketingResponse = 1 + mkt.boost * seg.marketingResponse, fatiguePenalty = 1 - A.fatigue / 100 * 0.5 * seg.fatigueSensitivity, d = base * priceResponse * marketingResponse * Math.max(0.1, fatiguePenalty) * repMult * A.macro.confidence * eventMult * productMult * seasonality * planDemandMult * conditionMult;
    segmentDemand[seg.id] = d, walkInPerDay += d;
  }
  walkInPerDay *= comp.playerShare;
  let loyalPerDay = A.loyalty * 3 / 30 * (1 - A.fatigue / 100 * 0.3) * A.macro.confidence, demandPerDay = walkInPerDay + loyalPerDay, capacity = biz.baseCapacityPerDay * TIER_CAPACITY_MULT[A.storeTier - 1], served = Math.min(demandPerDay, capacity), lostToCapacity = Math.max(0, demandPerDay - capacity), staffNeeded = Math.max(1, Math.ceil(served / biz.custPerStaffPerDay)), staffRatio = A.staff / staffNeeded;
  staffRatio >= 1 ? (A.morale = clamp2(A.morale + 2, 0, 100), A.reputation = clamp2(A.reputation + 1, 0, 100)) : staffRatio >= 0.75 ? (A.morale = clamp2(A.morale - 6, 0, 100), A.reputation = clamp2(A.reputation - 1, 0, 100), A.log.push("\u26A0\uFE0F Slightly understaffed \u2014 the team is stretched.")) : (A.morale = clamp2(A.morale - 12, 0, 100), A.reputation = clamp2(A.reputation - 3, 0, 100), A.log.push("\u{1F6A8} Badly understaffed \u2014 long waits and a burned-out team."));
  let serviceMult = 0.75 + A.morale / 100 * 0.3, unhappiest = A.roster.filter((m) => m.role !== "manager").sort((a, b) => a.morale - b.morale)[0];
  if (unhappiest && unhappiest.morale < 32 && A.staff > 1 && Math.random() < 0.35) {
    A.staff -= 1, A.roster = A.roster.filter((m) => m.id !== unhappiest.id);
    let y = `\u{1F44B} ${unhappiest.name} quit after ${unhappiest.monthsEmployed} months. You saw it coming \u2014 and didn't move.`;
    headlines.push(y), A.log.push(y);
  }
  let wear = 2 + served / capacity * 4, prevCondition = A.condition;
  A.condition = clamp2(A.condition - wear, 0, 100), prevCondition >= 40 && A.condition < 40 ? A.log.push("\u{1F529} The place is starting to look \u2014 and run \u2014 tired. Customers notice.") : prevCondition >= 20 && A.condition < 20 && A.log.push("\u26A0\uFE0F Equipment is overdue for real maintenance. Something is going to give."), lostToCapacity > capacity * 0.15 && (A.reputation = clamp2(A.reputation - 2, 0, 100), A.log.push("\u{1F6B6} You turned away crowds at the door \u2014 the store is at capacity."));
  let customersPerDay = served * serviceMult, customers2 = Math.round(customersPerDay * 30), walkInServed = Math.max(0, customersPerDay - loyalPerDay * serviceMult), totalSegDemand = Object.values(segmentDemand).reduce((a, b) => a + b, 0) || 1, eo = SEGMENTS.map((seg) => ({
    id: seg.id,
    customers: Math.round(segmentDemand[seg.id] / totalSegDemand * walkInServed * 30)
  })), satisfaction = A.morale / 100 * 0.5 + A.reputation / 100 * 0.5, newRegulars = 0;
  for (let y of SEGMENTS) {
    let segServed = segmentDemand[y.id] / totalSegDemand * walkInServed * 30;
    newRegulars += segServed * y.loyaltyRate * satisfaction;
  }
  let badPress = A.effects.some((e) => !e.good && e.demandMult < 1), churnRate = 0.03 + A.fatigue / 100 * 0.06 + (badPress ? 0.05 : 0);
  A.loyalty = clamp2(A.loyalty + newRegulars - A.loyalty * churnRate, 0, loc.populationCap);
  let ticket = biz.baseTicket * priceMult * (1 + A.productLines * 0.06) * cpi, supplierDiscount = A.supplierDealMonths > 0 ? 0.92 : 1, cogsMult = A.effects.reduce((m, e) => m * e.cogsMult, 1) * supplierDiscount * planCogsMult, managerCount = A.roster.filter((m) => m.role === "manager").length, isBarber = A.business === "barber", revenue, cogs, wages;
  if (isBarber) {
    let settle2 = settleBarberMonth(A, customers2);
    A.barbers = settle2.barbers, settle2.log.forEach((l) => {
      A.log.push(l), headlines.push(l);
    }), revenue = settle2.result.rentCollected + settle2.result.ownerCuts, cogs = settle2.result.ownerCuts * 0.08 * cogsMult, wages = Math.round(managerCount * MANAGER_WAGE_PREMIUM * biz.wagePerStaff * loc.wageMult * cpi), A.loyalty = A.barbers.reduce((a, b) => a + b.clientele, 0), A.ownerChair && (A.energy = clamp2(A.energy - 10, 0, 100));
    let applicants = rollApplicants(A, Math.max(0, A.chairs - A.barbers.length) > 0 ? 1 + (Math.random() < 0.4 ? 1 : 0) : 0);
    A.chairApplicants = applicants, applicants.length && A.log.push(`\u{1F488} ${applicants.length === 1 ? "A barber is" : `${applicants.length} barbers are`} asking about a chair.`);
  } else revenue = customers2 * ticket, cogs = revenue * biz.cogsRate * cogsMult, wages = Math.round((A.staff + managerCount * MANAGER_WAGE_PREMIUM) * biz.wagePerStaff * loc.wageMult * cpi);
  let overhead = Math.round(A.rentCurrent * 0.22 + (isBarber ? A.chairs * 90 : A.staff * 130) * cpi + revenue * 0.015), marketingCost = Math.round(mkt.cost * cpi), interestPaid = A.loan * A.interestRate / 100 / 12;
  if (A.leaseMonthsLeft -= 1, A.leaseMonthsLeft <= 0) {
    let newRent = Math.round(loc.rent * biz.rentMult * cpi), pct = (newRent - A.rentCurrent) / A.rentCurrent * 100, Ce = `\u{1F3E0} Lease renewed: rent is now $${newRent.toLocaleString()}/mo (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%).`;
    headlines.push(Ce), A.log.push(Ce), A.rentCurrent = newRent, A.leaseMonthsLeft = LEASE_TERM;
  }
  let rent = A.rentCurrent, preTaxProfit = revenue - cogs - rent - wages - overhead - marketingCost - interestPaid;
  A.quarterProfit += preTaxProfit;
  let taxes = 0;
  month % 3 === 0 && (A.quarterProfit > 0 && (taxes = A.quarterProfit * TAX_RATE, A.log.push(`\u{1F9FE} Quarterly taxes: $${Math.round(taxes).toLocaleString()}.`)), A.quarterProfit = 0);
  let profit = preTaxProfit - taxes;
  A.cash += profit, A.supplierDealMonths > 0 && (A.supplierDealMonths -= 1);
  let ventureProfit = 0;
  for (let v of A.ventures) {
    let net = ventureMonthly(v, { ...A, month });
    ventureProfit += net, net !== 0 && A.log.push(net >= 0 ? `\u{1F3EA} ${v.name} sent up $${net.toLocaleString()} \u2014 ${v.managerName} is holding it down.` : `\u{1F3EA} ${v.name} lost $${Math.abs(net).toLocaleString()} this month. ${v.managerName} is fighting the market.`);
  }
  A.cash += ventureProfit;
  let fatigueGain = A.marketingTier === "campaign" ? 2.5 : 3.5;
  if (A.fatigue = clamp2(A.fatigue + fatigueGain, 0, 100), A.energy = clamp2(A.energy + ENERGY_REGEN_PER_MONTH + (managerOf(A) ? 5 : 0), 0, 100), A.energy <= BURNOUT_THRESHOLD && (A.reputation = clamp2(A.reputation - 2, 0, 100), A.morale = clamp2(A.morale - 3, 0, 100), A.log.push("\u{1F975} You're burned out \u2014 short with the team, sloppy with details. Take a real break.")), A.reputation = clamp2(A.reputation + (50 - A.reputation) * 0.02, 0, 100), A.effects = A.effects.map((e) => ({ ...e, monthsLeft: e.monthsLeft - 1 })).filter((e) => e.monthsLeft > 0), A.renovationMonthsLeft > 0 && (A.renovationMonthsLeft -= 1, A.renovationMonthsLeft === 0)) {
    A.storeTier = Math.min(MAX_STORE_TIER, A.storeTier + 1), A.reputation = clamp2(A.reputation + 8, 0, 100), A.fatigue = clamp2(A.fatigue - 15, 0, 100);
    let y = `\u{1F528} The renovation is finished \u2014 welcome to your tier-${A.storeTier} space. The neighborhood noticed.`;
    headlines.push(y), A.log.push(y);
  }
  let nextCooldowns = {};
  for (let [id, months] of Object.entries(A.cooldowns ?? {})) months > 1 && (nextCooldowns[id] = months - 1);
  if (A.cooldowns = nextCooldowns, A.cash < 0 && A.loan < LOAN_CAP) {
    let need = Math.min(LOAN_CAP - A.loan, Math.ceil(-A.cash / 1e3) * 1e3);
    A.loan += need, A.cash += need, A.log.push(`\u{1F198} Cash ran dry \u2014 the bank extended an emergency $${need.toLocaleString()} loan.`);
  }
  (A.cash < BANKRUPTCY_FLOOR * cpi || A.cash < 0 && A.loan >= LOAN_CAP) && (A.gameOver = true, A.bankrupt = true, A.log.push("\u{1F480} The bank called it. You are bankrupt.")), A.month = month, month >= A.maxMonths && !A.bankrupt && (A.gameOver = true);
  let record = {
    month,
    customers: customers2,
    loyalCustomers: Math.round(A.loyalty),
    lostToCapacity: Math.round(lostToCapacity * 30),
    revenue: Math.round(revenue),
    cogs: Math.round(cogs),
    rent,
    wages,
    overhead,
    marketingCost,
    interestPaid: Math.round(interestPaid),
    taxes: Math.round(taxes),
    profit: Math.round(profit),
    cash: Math.round(A.cash),
    reputation: Math.round(A.reputation),
    fatigue: Math.round(A.fatigue),
    morale: Math.round(A.morale),
    interestRate: A.interestRate,
    cpi,
    phase: A.macro.phase,
    marketShare: comp.playerShare,
    segments: eo,
    eventLabels,
    ventureProfit: Math.round(ventureProfit)
  };
  return A.history = [...A.history, record], A.plan = {
    demandMult: 1,
    cogsMult: 1,
    repDelta: 0,
    moraleDelta: 0,
    fatigueDelta: 0,
    loyaltyDelta: 0,
    decisionsMade: 0
  }, A.currentCards = [], A.completedCards = [], A.monthIntro = "", A.monthStory = [], A.activeMs = 0, A.lastPlayedAt = Date.now(), A.activitiesDone = [], { state: A, record, eventHeadline, eventGood, headlines };
}
function scoreGame(e) {
  if (e.bankrupt) return {
    valuation: 0,
    grade: "D",
    summary: "The business went under. Every founder has a first failure \u2014 run it back."
  };
  let last3 = e.history.slice(-3), avgProfit = last3.reduce((a, r) => a + r.profit, 0) / Math.max(1, last3.length), repMultiple = 0.5 + e.reputation / 100, nominal = e.cash - e.loan + avgProfit * 12 * repMultiple + e.storeTier * 5e3 + e.loyalty * 40, valuation = Math.round(nominal / e.macro.cpi), grade = valuation >= 7e5 ? "S" : valuation >= 4e5 ? "A" : valuation >= 16e4 ? "B" : valuation >= 6e4 ? "C" : "D";
  return {
    valuation,
    grade,
    summary: {
      S: "A local legend. Investors are calling \u2014 franchise material.",
      A: "A thriving business with real momentum. Well played.",
      B: "A solid, profitable operation. Room to grow.",
      C: "You survived \u2014 barely profitable. Study your worst months.",
      D: "Still standing, but the numbers are rough. Rethink the fundamentals."
    }[grade]
  };
}
var DECISIONS_PER_MONTH = 4, COOLDOWNS = {
  "renovation-offer": 9,
  equipment: 5,
  "product-launch": 4,
  "rush-prep": 10,
  "landlord-visit": 7,
  "victor-visits": 6,
  "vega-walkthrough": 7,
  "local-critic": 9,
  "catering-order": 5,
  "mystery-shopper": 7,
  "staff-idea": 9,
  "senior-discount": 24,
  "neighbor-complaint": 7,
  partnership: 7,
  "poach-attempt": 6,
  community: 5,
  "supplier-squeeze": 5,
  "waste-audit": 5,
  "deep-clean": 4,
  "staff-conflict": 4,
  "shift-crisis": 3,
  "flash-promo": 3,
  experiment: 4,
  "price-review": 3,
  "marketing-review": 3,
  "bank-visit": 4,
  "staffing-review": 3
}, pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)], FLAVOR = {
  restaurant: {
    item: "menu",
    gear: "walk-in fridge",
    maker: "kitchen",
    waste: "Spoilage, over-ordering\u2026 maybe worse, I don't want to point fingers",
    supply: "produce and proteins",
    sampleLabel: "Send out a plate of the house special, on you",
    sampleReaction: "*chews slowly* \u2026That's annoyingly good. That is ANNOYINGLY good. *leaves without another word*",
    bigOrder: "An office across town wants us to cater their all-hands next Friday",
    bigOrderDone: "DONE. Delivered, devoured, applauded. That check cleared before we finished loading the van.",
    criticTell: "always order the second-cheapest entr\xE9e and sit near the window",
    mysteryCover: "their dinner",
    mysteryFindings: "four minutes before anyone greeted them, the special never offered, one wobbly table",
    readyPhrase: "Tested, tasted, priced.",
    flowNoun: "our kitchen flow"
  },
  convenience: {
    item: "shelf lineup",
    gear: "freezer bank",
    maker: "stockroom",
    waste: "Shrinkage \u2014 damaged stock, miscounts\u2026 maybe worse, I don't want to point fingers",
    supply: "wholesale stock",
    sampleLabel: "Hand him a bag of the local goods you stock",
    sampleReaction: "*turns the jar over, reads the label* \u2026Where do you FIND this stuff? That's annoyingly good sourcing. *leaves without another word*",
    bigOrder: "A construction site up the road wants a big weekly supply run \u2014 drinks, snacks, essentials \u2014 first month paid up front",
    bigOrderDone: "DONE. Three van loads, zero missed items, and the site manager already texted about next month.",
    criticTell: `they're scouting for a "best corner stores in town" listicle and always check the fridges first`,
    mysteryCover: "a full basket",
    mysteryFindings: "two mispriced shelves, nobody said hello, and a fridge light's been flickering for weeks",
    readyPhrase: "Sourced, shelved, priced.",
    flowNoun: "the restock flow"
  },
  coffee: {
    item: "drink list",
    gear: "espresso machine",
    maker: "bar",
    waste: "Stale beans, over-pulled shots, milk going off faster than the math says",
    supply: "beans and dairy",
    sampleLabel: "Pull him a flat white, on the house",
    sampleReaction: "*sips. pauses. sips again* \u2026That's annoyingly good. That is ANNOYINGLY good. *leaves without another word*",
    bigOrder: "A conference downtown wants full coffee service next Friday \u2014 urns, pastries, two baristas",
    bigOrderDone: "DONE. Four hundred cups, zero disasters, and the check cleared before the afternoon panel.",
    criticTell: `always order a plain cappuccino \u2014 apparently that's "the true test of a shop"`,
    mysteryCover: "their coffee and a pastry",
    mysteryFindings: "four minutes in line at a quiet hour, no size asked, one wobbly table",
    readyPhrase: "Tested, tasted, priced.",
    flowNoun: "the bar flow"
  },
  bakery: {
    item: "pastry case",
    gear: "main oven",
    maker: "kitchen",
    waste: "Day-olds piling up, over-proofing, flour going faster than the recipes say it should",
    supply: "flour and butter",
    sampleLabel: "Hand him a warm croissant, on the house",
    sampleReaction: "*bites. closes eyes. opens them, betrayed* \u2026That's annoyingly good. ANNOYINGLY good. *leaves without another word*",
    bigOrder: "A wedding wants a full dessert table for two hundred guests next Saturday",
    bigOrderDone: "DONE. Two hundred desserts, one standing ovation for the croquembouche, and the check cleared before the first dance.",
    criticTell: `always buy the plain croissant first \u2014 "you can't hide behind a plain croissant," apparently`,
    mysteryCover: "a pastry box",
    mysteryFindings: "the case half-empty by ten, day-olds not marked down, one wobbly table",
    readyPhrase: "Tested, tasted, priced.",
    flowNoun: "our bake schedule"
  },
  barber: {
    item: "service list",
    gear: "chair hydraulics",
    maker: "shop floor",
    waste: "Product walking off the shelf \u2014 pomade, blades, towels vanishing faster than we sell them",
    supply: "clippers, blades, and product",
    sampleLabel: "Give him a quick beard line-up, on the house",
    sampleReaction: "*checks the mirror. checks it again* \u2026That's annoyingly precise. ANNOYINGLY precise. *leaves without another word*",
    bigOrder: "A wedding party wants on-site grooming for twelve \u2014 cuts, shaves, the works \u2014 morning of the big day",
    bigOrderDone: "DONE. Twelve fresh fades, one very calm groom, and the check cleared before the ceremony started.",
    criticTell: "always book a plain classic cut, no small talk \u2014 they judge the fundamentals",
    mysteryCover: "their cut",
    mysteryFindings: "nine minutes past their booking, no product suggested after the cut, and the waiting bench wobbles",
    readyPhrase: "Practiced, timed, priced.",
    flowNoun: "the floor rotation"
  }
}, we = (n, cpi) => Math.round(n * cpi), CARDS = [
  {
    id: "waste-audit",
    category: "ops",
    weight: () => 1.2,
    build: (e) => {
  let t = FLAVOR[e.business], o = we(800, e.macro.cpi);
  return {
      id: "waste-audit",
      venue: "back",
      title: "The numbers don't add up",
      speaker: "manager",
      mood: "worried",
      lines: [
        `Boss, got a second? I've been doing the ${t.maker} counts three weeks running and they keep coming up short.`,
        `${t.waste}. It's small each week, but it compounds.`
      ],
      options: [
        {
          label: `Run a full audit ($${o.toLocaleString()})`,
          hint: "Find the leak and fix it",
          tone: "steady",
          cost: o,
          effects: { lingering: {
            id: "tight-ship",
            label: "Tight inventory",
            monthsLeft: 3,
            demandMult: 1,
            cogsMult: 0.97,
            good: true
          } },
          result: "Found it! A standing order nobody remembered placing. Two days of counting, but our costs just came down.",
          resultMood: "happy"
        },
        {
          label: "Eyeball it and move on",
          hint: "No time, no money",
          tone: "thrifty",
          effects: { lingering: {
            id: "shrinkage",
            label: "Shrinkage",
            monthsLeft: 2,
            demandMult: 1,
            cogsMult: 1.06,
            good: false
          } },
          result: "If you say so. But those gaps aren't going to close themselves\u2026",
          resultMood: "worried"
        }
      ]
    };
}
  },
  {
    id: "equipment",
    category: "ops",
    weight: (e) => e.month < 3 || e.condition >= 60 ? 0 : 0.7 + (60 - e.condition) / 40,
    build: (e) => {
  let t = FLAVOR[e.business], o = we(1400, e.macro.cpi), A = we(350, e.macro.cpi), a = Math.random() < 0.4;
  return {
      id: "equipment",
      venue: "back",
      title: `The ${t.gear} is making a new noise`,
      speaker: "manager",
      mood: "worried",
      lines: [
        `So\u2026 the ${t.gear}. It still works. Mostly.`,
        `But it's developed a rattle I can only describe as "on its farewell tour." Your call, boss.`
      ],
      options: [
        {
          label: `Repair it properly ($${o.toLocaleString()})`,
          hint: "Fixed is fixed",
          tone: "steady",
          cost: o,
          effects: { conditionDelta: 35 },
          result: "The tech replaced a part I can't pronounce. Listen to that. Nothing. Beautiful, expensive silence.",
          resultMood: "happy"
        },
        {
          label: `Cheap patch ($${A.toLocaleString()})`,
          hint: "Buy some time, roll the dice",
          tone: "thrifty",
          cost: A,
          effects: a ? {
            conditionDelta: 8,
            lingering: {
              id: "breakdown",
              label: "Equipment limping",
              monthsLeft: 2,
              demandMult: 0.93,
              cogsMult: 1.04,
              good: false
            }
          } : { conditionDelta: 8 },
          result: a ? "Patched it\u2026 aaand it's already rattling again. This is going to bite us, I can feel it." : "Patched it. It's quiet \u2014 for now. I'll keep an ear on it.",
          resultMood: a ? "worried" : "neutral"
        },
        {
          label: "Run it till it dies",
          hint: "Free, famous last words",
          tone: "thrifty",
          effects: { lingering: {
            id: "breakdown",
            label: "Equipment failing",
            monthsLeft: 2,
            demandMult: 0.9,
            cogsMult: 1.08,
            good: false
          } },
          result: "It died on Saturday. Mid-rush. I did what I could, boss, but everything's slower and pricier till we deal with it.",
          resultMood: "stern"
        }
      ]
    };
}
  },
  {
    id: "staff-conflict",
    category: "ops",
    weight: (e) => e.staff >= 2 ? 1 + (70 - e.morale) / 60 : 0,
    build: () => ({
      id: "staff-conflict",
      venue: "inside",
      title: "Two of your people aren't speaking",
      speaker: "manager",
      mood: "worried",
      lines: [
        "Heads up \u2014 we've got a cold war on the floor. A scheduling slight, a tone taken, nobody remembers exactly.",
        "But the silence between those two is loud enough that customers are noticing."
      ],
      options: [
        {
          label: "Sit them down together",
          hint: "An hour of awkward, then air cleared",
          tone: "steady",
          effects: { moraleDelta: 9 },
          result: "Twenty minutes of staring at shoes, then it ALL came out. They closed together tonight \u2014 laughing. Thank you.",
          resultMood: "happy"
        },
        {
          label: "Let them work it out",
          hint: "You're an owner, not a counselor",
          tone: "thrifty",
          effects: { moraleDelta: -8, demandMult: 0.97 },
          result: "They did not work it out. The chill's spreading to the whole shift now. Just so you know.",
          resultMood: "stern"
        }
      ]
    })
  },
  {
    id: "shift-crisis",
    category: "ops",
    weight: (e) => e.staff >= 2 ? 1 : 0.3,
    build: (e) => {
  let t = we(600, e.macro.cpi);
  return {
      id: "shift-crisis",
      venue: "inside",
      title: "Down a person for the week",
      speaker: "manager",
      mood: "worried",
      lines: [
        "Bad news \u2014 family emergency, we're down a person all week.",
        "Which week? The busiest one of the month. Naturally. How do you want to play it?"
      ],
      options: [
        {
          label: `Cover it with overtime ($${t.toLocaleString()})`,
          hint: "Service holds, wallet doesn't",
          tone: "steady",
          cost: t,
          effects: { moraleDelta: 4 },
          result: "The team stepped up for the extra pay. Nobody waited long all week \u2014 and they noticed you paid fair.",
          resultMood: "happy"
        },
        {
          label: "Stretch the remaining crew",
          hint: "Free, but everyone feels it",
          tone: "thrifty",
          effects: { moraleDelta: -7, demandMult: 0.95, repDelta: -2 },
          result: "We survived. Barely. Saturday's line backed up, one review mentioned the wait, and everyone went home wrecked.",
          resultMood: "stern"
        },
        {
          label: "Work the shifts yourself",
          hint: "The owner rolls up their sleeves",
          tone: "bold",
          effects: { moraleDelta: 6, fatigueDelta: -2, repDelta: 1 },
          result: `Honestly? The team loved having you on the floor. Miss June told everyone "that's the owner!" like you were famous.`,
          resultMood: "happy"
        }
      ]
    };
}
  },
  {
    id: "supplier-squeeze",
    category: "ops",
    weight: (e) => e.supplierDealMonths > 0 ? 0.3 : 1,
    build: (e) => {
  let t = FLAVOR[e.business], o = Math.random() < 0.5;
  return {
      id: "supplier-squeeze",
      venue: "street",
      title: "A cheaper supplier comes knocking",
      speaker: "supplier",
      mood: "happy",
      lines: [
        `Boss! Tony. Good to see you. Listen \u2014 I'll cut right to it: I can beat what you're paying on ${t.supply} by a real margin.`,
        "Same categories, faster truck. Samples are out back. They're\u2026 fine. They're FINE!"
      ],
      options: [
        {
          label: "Switch to the cheap stuff",
          hint: "Save now, risk the product",
          tone: "thrifty",
          effects: { lingering: o ? {
            id: "cheap-supply",
            label: "Cheaper supplies",
            monthsLeft: 3,
            demandMult: 1,
            cogsMult: 0.92,
            good: true
          } : {
            id: "quality-slip",
            label: "Quality slipping",
            monthsLeft: 3,
            demandMult: 0.94,
            cogsMult: 0.92,
            good: false
          } },
          result: o ? "Smart move! And hey \u2014 nobody's noticed a difference. You just got cheaper without getting worse." : `You won't regret it! \u2026Okay, small thing. Some regulars are saying it's "not the same." Give it time?`,
          resultMood: o ? "happy" : "worried"
        },
        {
          label: "Use the quote to negotiate",
          hint: "Play them against each other",
          tone: "steady",
          effects: { lingering: {
            id: "negotiated",
            label: "Negotiated rates",
            monthsLeft: 3,
            demandMult: 1,
            cogsMult: 0.975,
            good: true
          } },
          result: "Oh, you took my quote to your guy? Cold. COLD. \u2026Respect, though. That's exactly what I'd do.",
          resultMood: "neutral"
        },
        {
          label: "Stay loyal, full price",
          hint: "Quality you can trust",
          tone: "bold",
          effects: { repDelta: 1 },
          result: "Loyalty, huh. Can't argue with it \u2014 your product stays exactly what your regulars expect. Door's open if you change your mind!",
          resultMood: "neutral"
        }
      ]
    };
}
  },
  {
    id: "deep-clean",
    category: "ops",
    weight: (e) => e.inspectionDue ? 2.5 : 0.8,
    build: (e) => ({
      id: "deep-clean",
      venue: "inside",
      title: "The place is looking lived-in",
      speaker: "manager",
      mood: e.inspectionDue ? "worried" : "neutral",
      lines: e.inspectionDue ? [
        "Boss. Vega's coming this month. THE inspector.",
        "And every scuff and smudge in here suddenly looks like a citation to me. Do we scrub tonight or hope for mercy?"
      ] : [
        "Not urgent, but \u2014 look at the corners. Grime creeps in slow, then all at once.",
        "The place is announcing our deferred maintenance. Deep clean means closing early one night."
      ],
      options: [
        {
          label: "Close early for a deep clean",
          hint: "Lose an evening, gleam for weeks",
          tone: "steady",
          effects: { demandMult: 0.98, repDelta: 3, fatigueDelta: -3 },
          result: "Four hours, three buckets, one pizza. Look at this place \u2014 it's REBORN. Worth every lost sale.",
          resultMood: "happy"
        },
        {
          label: "A quick wipe-down will do",
          hint: "Keep the doors open",
          tone: "thrifty",
          effects: { repDelta: e.inspectionDue ? -3 : -1 },
          result: "Hit the visible surfaces, hoped nobody looks up. \u2026Somebody always looks up, boss.",
          resultMood: "worried"
        }
      ]
    })
  },
  {
    id: "flash-promo",
    category: "growth",
    unsuited: ["convenience"],
    weight: () => 1,
    build: (e) => {
  let t = we(500, e.macro.cpi);
  return {
      id: "flash-promo",
      venue: "inside",
      title: "An empty Tuesday stares back",
      speaker: "manager",
      mood: "neutral",
      lines: [
        "Tuesday again. You could roll a bowling ball through here.",
        `I sketched out a weekday special \u2014 flyers, a little push online. About $${t.toLocaleString()} to do it right. Want to wake Tuesday up?`
      ],
      options: [
        {
          label: `Run the weekday special ($${t.toLocaleString()})`,
          hint: "Buy some buzz",
          tone: "bold",
          cost: t,
          effects: { demandMult: 1.08, fatigueDelta: 1 },
          result: "Word got around by Thursday. Tuesday has a PULSE. You should've seen lunch today.",
          resultMood: "happy"
        },
        {
          label: "Let Tuesday be Tuesday",
          hint: "Save the money",
          tone: "thrifty",
          result: "Fair enough. Tuesday remains, resolutely, Tuesday.",
          resultMood: "neutral"
        }
      ]
    };
}
  },
  {
    id: "partnership",
    category: "growth",
    weight: (e) => 0.8 + locationOf(e.location).segmentMix.commuters,
    build: (e) => {
  let t = we(700, e.macro.cpi);
  return {
      id: "partnership",
      venue: "street",
      title: "Marcus has a proposition",
      speaker: "neighbor",
      mood: "happy",
      lines: [
        "Hey! Marcus, from the gym around the corner. Great to finally meet the owner.",
        `Here's my pitch: my members get a little perk here, you get a stream of new faces. Costs you about $${t.toLocaleString()} to set up. My people are CREATURES of habit \u2014 win them once, they're yours.`
      ],
      options: [
        {
          label: `Sign the partnership ($${t.toLocaleString()})`,
          hint: "Three months of new faces",
          tone: "bold",
          cost: t,
          effects: { lingering: {
            id: "partnership",
            label: "Local partnership",
            monthsLeft: 3,
            demandMult: 1.06,
            cogsMult: 1,
            good: true
          } },
          result: "Deal! You'll see my six-AM crowd in here by Friday. They tip well when they've earned it, trust me.",
          resultMood: "happy"
        },
        {
          label: "Politely decline",
          hint: "Perks cost margin",
          tone: "thrifty",
          result: "No hard feelings! \u2026I'll ask across the street, then. They seem hungry for it.",
          resultMood: "neutral"
        }
      ]
    };
}
  },
  {
    id: "experiment",
    category: "growth",
    weight: (e) => 0.7 + e.fatigue / 80,
    build: (e) => {
  let t = FLAVOR[e.business], o = Math.random() < 0.75;
  return {
      id: "experiment",
      venue: "inside",
      title: "Miss June has opinions",
      speaker: "regular",
      mood: "happy",
      lines: [
        "Dear, sit down a minute. You know I love this place. You KNOW I do.",
        `But the ${t.item} hasn't changed since I started coming, and I've started noticing. A regular notices things. Try something new. Surprise me.`
      ],
      options: [
        {
          label: "Try something new this month",
          hint: "Novelty has power",
          tone: "bold",
          effects: o ? { demandMult: 1.05, fatigueDelta: -6 } : { demandMult: 0.98, repDelta: -2 },
          result: o ? "Oh, NOW you're talking. I told everyone at bridge club. Half of them are coming Thursday. You're welcome, dear." : "Hmm. Well. It was\u2026 brave. Take it off the board, dear, and we'll never speak of it again.",
          resultMood: o ? "happy" : "worried"
        },
        {
          label: "Stick to what works",
          hint: "Consistency is a brand",
          tone: "steady",
          effects: { fatigueDelta: 1 },
          result: "Suit yourself, dear. The usual, then. Same as always. Same\u2026 as\u2026 always.",
          resultMood: "neutral"
        }
      ]
    };
}
  },
  {
    id: "community",
    category: "growth",
    weight: (e) => 0.6 + locationOf(e.location).segmentMix.locals,
    build: (e) => {
  let t = we(500, e.macro.cpi);
  return {
      id: "community",
      venue: "inside",
      title: "The neighborhood asks",
      speaker: "regular",
      mood: "neutral",
      lines: [
        `Dear, I'm here on official business today. I'm with ${pickOne([
          "the little-league team",
          "the street fair committee",
          "the school fundraiser",
          "the neighborhood cleanup"
        ])} \u2014 don't laugh, it's very serious.`,
        `We're looking for a sponsor. $${t.toLocaleString()}, your name on the banner, and the gratitude of every family in the neighborhood. Locals remember these things. We remember everything.`
      ],
      options: [
        {
          label: `Sponsor them ($${t.toLocaleString()})`,
          hint: "Locals remember",
          tone: "steady",
          cost: t,
          effects: { repDelta: 4, loyaltyDelta: 8 },
          result: "Wonderful! I knew you were one of the good ones. Everyone will hear about this \u2014 I'll make certain of it.",
          resultMood: "happy"
        },
        {
          label: "Not this time",
          hint: "Charity begins at solvency",
          tone: "thrifty",
          result: "I see. Well. Times are hard for everyone, I'm sure. *files it away with a polite nod*",
          resultMood: "stern"
        }
      ]
    };
}
  },
  {
    id: "price-review",
    category: "growth",
    weight: () => 0.9,
    build: (e) => {
  let t = priceLevelOf(e.priceLevel), o = e.priceLevel === "budget" ? "value" : e.priceLevel === "value" ? "standard" : e.priceLevel === "standard" ? "premium" : "luxury", A = e.priceLevel === "luxury" ? "premium" : e.priceLevel === "premium" ? "standard" : e.priceLevel === "standard" ? "value" : "budget", a = [];
  return e.priceLevel !== "luxury" && a.push({
      label: `Raise prices (${o})`,
      hint: "More per sale, fewer sales \u2014 unless your name carries it",
      tone: "bold",
      action: { setPrice: o },
      result: "New numbers are live. I watched the first few customers read them\u2026 and order anyway. So far, so good.",
      resultMood: "neutral"
    }), a.push({
      label: `Hold at ${t.name.toLowerCase()}`,
      hint: "Predictability is comfortable",
      tone: "steady",
      result: "Holding. Nobody notices, which is rather the point of holding.",
      resultMood: "neutral"
    }), e.priceLevel !== "budget" && a.push({
      label: `Cut prices (${A})`,
      hint: "Chase volume, squeeze margin",
      tone: "thrifty",
      action: { setPrice: A },
      result: "Cuts are live. The penny-watchers found them within days. Your margins found them immediately.",
      resultMood: "worried"
    }), {
      id: "price-review",
      venue: "office",
      title: "Priya slides the spreadsheet over",
      speaker: "accountant",
      mood: "neutral",
      lines: [
        "So. Prices. Don't make that face \u2014 we do this every quarter.",
        `You're at ${t.name.toLowerCase()} right now. Locals will forgive a bump if they love you; commuters will walk a block to save a dollar. Question is whether the market bears more, or wants less.`
      ],
      options: a
    };
}
  },
  {
    id: "marketing-review",
    category: "growth",
    weight: () => 0.9,
    build: (e) => {
  let t = we(800, e.macro.cpi), o = we(3e3, e.macro.cpi);
  return {
      id: "marketing-review",
      venue: "office",
      title: "How loud should you be?",
      speaker: "accountant",
      mood: "neutral",
      lines: [
        "Two envelopes on my desk this morning: a media kit from the local ad network, and a quote from an actual agency.",
        `Local presence runs $${t.toLocaleString()} a month. The full campaign is $${o.toLocaleString()} \u2014 billboards, feeds, the works. Attention is for sale. How much are we buying?`
      ],
      options: [
        {
          label: `Big campaign ($${o.toLocaleString()}/mo)`,
          hint: "Billboards, feeds, the works",
          tone: "bold",
          action: { setMarketing: "campaign" },
          result: "Signed. Two weeks from now, people you've never met will know this place's name. I'll be watching whether they show up.",
          resultMood: "neutral"
        },
        {
          label: `Local ads ($${t.toLocaleString()}/mo)`,
          hint: "Steady, sensible presence",
          tone: "steady",
          action: { setMarketing: "local" },
          result: "Sensible. Flyers, local feeds, the neighborhood paper. It works while you sleep, which is my favorite kind of working.",
          resultMood: "happy"
        },
        {
          label: "Go dark \u2014 word of mouth only",
          hint: "Free, and quiet",
          tone: "thrifty",
          action: { setMarketing: "none" },
          result: "Canceled everything. From here on, your customers are your advertising. Hope they're chatty.",
          resultMood: "neutral"
        }
      ]
    };
}
  },
  {
    id: "renovation-offer",
    category: "strategic",
    weight: (e) => {
  if (e.storeTier >= MAX_STORE_TIER || e.renovationMonthsLeft > 0) return 0;
  let t = e.history[e.history.length - 1];
  return t && t.lostToCapacity > t.customers * 0.08 ? 2.2 : 0.5;
},
    build: (e) => {
  let t = Math.round(businessOf(e.business).renovationCost * e.macro.cpi);
  return {
      id: "renovation-offer",
      venue: "inside",
      title: "Dee walks the space",
      speaker: "contractor",
      mood: "neutral",
      lines: [
        "*taps a wall, listens* Good bones. You're wasting them.",
        `I watched you turn people away at the door twice while I was measuring. A bigger, better room keeps them. $${t.toLocaleString()}, about two months of honest construction, done right the first time.`
      ],
      options: [
        {
          label: `Start the renovation ($${t.toLocaleString()})`,
          hint: "Two months of dust, then more room and +8 reputation",
          tone: "bold",
          action: "renovate",
          result: "*rolls out the plans on your counter* Crew starts Monday. Two months, some dust, a little noise \u2014 then you won't recognize the place.",
          resultMood: "happy"
        },
        {
          label: "Not yet",
          hint: "The war chest stays shut",
          tone: "steady",
          result: "Your call. Keep my quote \u2014 the line out your door is flattering, but flattery doesn't pay rent. I do callbacks.",
          resultMood: "neutral"
        }
      ]
    };
}
  },
  {
    id: "product-launch",
    category: "strategic",
    weight: (e) => e.productLines >= MAX_PRODUCT_LINES ? 0 : 0.4 + e.fatigue / 45,
    build: (e) => {
  let t = FLAVOR[e.business], o = Math.round(businessOf(e.business).productLineCost * e.macro.cpi);
  return {
      id: "product-launch",
      venue: "back",
      title: `Time to reinvent the ${t.item}?`,
      speaker: "manager",
      mood: "happy",
      lines: [
        "Okay. Don't say no yet. Remember that whole new line we've been testing after close? It's READY.",
        `${t.readyPhrase} Launch costs $${o.toLocaleString()} all in. Boredom is the one competitor we can't out-price, boss.`
      ],
      options: [
        {
          label: `Launch the new line ($${o.toLocaleString()})`,
          hint: "Novelty resets fatigue, raises ticket",
          tone: "bold",
          action: "productLine",
          result: "LAUNCH DAY. Regulars photographing the new board. Someone clapped. Someone CLAPPED, boss. I feel ten feet tall.",
          resultMood: "happy"
        },
        {
          label: "Keep it in development",
          hint: "Save the cash for now",
          tone: "thrifty",
          effects: { fatigueDelta: 2 },
          result: "\u2026Back in the binder it goes. The regulars ordered the usual today. A little less brightly, if you ask me.",
          resultMood: "worried"
        }
      ]
    };
}
  },
  {
    id: "bank-visit",
    category: "strategic",
    weight: (e) => e.cash < 8e3 ? 1.4 : e.loan > 0 && e.cash > e.loan + 15e3 ? 1.2 : 0.4,
    build: (e) => {
  let t = [];
  return e.loan + LOAN_STEP <= LOAN_CAP && t.push({
      label: `Borrow $${LOAN_STEP.toLocaleString()} at ${e.interestRate.toFixed(1)}%`,
      hint: "Fuel now, interest forever",
      tone: "bold",
      action: "borrow",
      result: "Funds cleared before you reach the door. A pleasure. It's always a pleasure \u2014 that's rather the point of my business.",
      resultMood: "happy"
    }), e.loan > 0 && e.cash >= Math.min(LOAN_STEP, e.loan) && t.push({
      label: `Repay $${Math.min(LOAN_STEP, e.loan).toLocaleString()}`,
      hint: "Shrink the interest bleed",
      tone: "steady",
      action: "repay",
      result: "Paid down. Your interest line just got a little less insulting. I'll admit I'm mildly disappointed.",
      resultMood: "neutral"
    }), t.push({
      label: "Just checking in",
      hint: "No moves today",
      tone: "thrifty",
      result: "Always happy to review the numbers. Do take a calendar on your way out. We had them printed.",
      resultMood: "neutral"
    }), {
      id: "bank-visit",
      venue: "office",
      title: "An appointment at the bank",
      speaker: "banker",
      mood: "neutral",
      lines: [
        `Ah \u2014 do sit. I took the liberty of printing your summary. Rates are at ${e.interestRate.toFixed(1)}%, and ${e.loan > 0 ? `you're carrying $${e.loan.toLocaleString()} with us` : "your slate is admirably clean"}.`,
        "The only question I ever ask: should money be moving?"
      ],
      options: t
    };
}
  },
  {
    id: "staffing-review",
    category: "strategic",
    weight: (e) => {
  let t = e.history[e.history.length - 1];
  if (!t) return 0.4;
  let o = businessOf(e.business), A = Math.ceil(t.customers / 30 / o.custPerStaffPerDay);
  return e.staff < A ? 2.5 : e.morale < 50 ? 1.8 : 0.6;
},
    build: (e) => {
  let t = businessOf(e.business), o = Math.round(t.wagePerStaff * locationOf(e.location).wageMult * e.macro.cpi), A = Math.round(e.staff * STAFF_BONUS_PER_HEAD * e.macro.cpi), a = [
      {
        label: `Hire another pair of hands ($${o.toLocaleString()}/mo)`,
        hint: "Service quality is capacity",
        tone: "bold",
        action: "hire",
        result: "New hire fumbled everything day one, nailed it by day three. The whole team just exhaled. Good call.",
        resultMood: "happy"
      },
      {
        label: `Pay a team bonus ($${A.toLocaleString()})`,
        hint: "Morale is a multiplier",
        tone: "steady",
        action: "bonus",
        result: "Envelopes at close of shift. Boss\u2026 everyone was five minutes EARLY this morning. I didn't know they could do that.",
        resultMood: "happy"
      }
    ];
  return e.staff > 1 && a.push({
      label: "Trim the roster by one",
      hint: "Save a salary, spend some trust",
      tone: "thrifty",
      action: "fire",
      result: "It's done. Hard conversation. The wage bill's smaller\u2026 so is the warmth in the room. I'll hold it together.",
      resultMood: "stern"
    }), {
      id: "staffing-review",
      venue: "inside",
      title: "The team, considered",
      speaker: "manager",
      mood: e.morale < 50 ? "worried" : "neutral",
      lines: [
        `Payroll day. ${e.staff} of us on the roster, morale sitting at about ${Math.round(e.morale)} out of 100, if you had to put a number on it. Which I just did.`,
        "Every option costs something \u2014 money, energy, or goodwill. What are we spending?"
      ],
      options: a
    };
}
  },
  {
    id: "poach-attempt",
    category: "strategic",
    weight: (e) => e.competitors.length > 0 && e.staff >= 2 ? 1.2 : 0,
    build: (e) => {
  let t = e.competitors[0]?.name ?? "the competition", o = we(300, e.macro.cpi);
  return {
      id: "poach-attempt",
      venue: "inside",
      title: "Sam closes the office door",
      speaker: "manager",
      mood: "worried",
      lines: [
        `Boss, I need to be straight with you. ${t} made me an offer. Real money.`,
        `I'd rather stay. This place is\u2026 look, I built half of it with you. But "rather" is doing a lot of work in that sentence. It's about $${o.toLocaleString()} more a month.`
      ],
      options: [
        {
          label: `Match it with a raise (+$${o.toLocaleString()}/mo)`,
          hint: "Keep your best, pay for it",
          tone: "steady",
          effects: {
            moraleDelta: 8,
            lingering: {
              id: "raise",
              label: "Payroll bump",
              monthsLeft: 6,
              demandMult: 1,
              cogsMult: 1.02,
              good: false
            }
          },
          result: "\u2026You didn't even hesitate. Okay. Okay! I'm not crying, there's flour in my eye. Back to work. FOREVER, apparently.",
          resultMood: "happy"
        },
        {
          label: "Wish them well",
          hint: "Nobody is irreplaceable, right?",
          tone: "thrifty",
          effects: { moraleDelta: -12, demandMult: 0.94, repDelta: -2 },
          result: "*from the doorway, apron folded on the counter* Take care of the place, yeah? \u2026Yeah.",
          resultMood: "stern"
        }
      ]
    };
}
  },
  {
    id: "landlord-visit",
    category: "ops",
    weight: (e) => 0.6 + (e.leaseMonthsLeft <= 3 ? 0.8 : 0),
    build: (e) => {
  let t = we(900, e.macro.cpi);
  return {
      id: "landlord-visit",
      venue: "street",
      title: "Mrs. Okafor inspects her property",
      speaker: "landlord",
      mood: "stern",
      lines: [
        "*runs a gloved finger along the window frame* Mm. I was in the neighborhood. I own half of it, after all.",
        "The frontage is looking\u2026 loved. Which is a landlord's way of saying tired. A tenant who maintains my property is a tenant I remember warmly at lease time."
      ],
      options: [
        {
          label: `Spruce up the frontage ($${t.toLocaleString()})`,
          hint: "Curb appeal + a warm lease memory",
          tone: "steady",
          cost: t,
          effects: {
            repDelta: 2,
            lingering: {
              id: "fresh-frontage",
              label: "Fresh frontage",
              monthsLeft: 3,
              demandMult: 1.04,
              cogsMult: 1,
              good: true
            }
          },
          result: "Fresh paint, polished glass. *she almost smiles* You take care of things. I shall make a note of it.",
          resultMood: "happy"
        },
        {
          label: "It has character, Mrs. Okafor",
          hint: "Free, but she remembers everything",
          tone: "thrifty",
          effects: { repDelta: -1 },
          result: '"Character." *writes something in a small black book* I also keep books, you know. Good day.',
          resultMood: "stern"
        }
      ]
    };
}
  },
  {
    id: "victor-visits",
    category: "growth",
    weight: (e) => e.competitors.length > 0 ? 1.1 : 0,
    build: (e) => {
  let t = FLAVOR[e.business], o = e.competitors[0]?.name ?? "his place", A = we(2500, e.macro.cpi);
  return {
      id: "victor-visits",
      venue: "inside",
      title: "The competition walks in",
      speaker: "rival",
      mood: "happy",
      lines: [
        `Nice place. Small, but nice. Victor \u2014 I run ${o}. Thought I'd finally see what the fuss is about.`,
        `Relax, I'm not here to borrow your playbook. Well. Not NOTHING. I'll pay $${A.toLocaleString()} for an hour of your time \u2014 how you run your operation. Call it\u2026 professional curiosity.`
      ],
      options: [
        {
          label: `Take the $${A.toLocaleString()}, talk shop`,
          hint: "Easy money, sharper rival",
          tone: "thrifty",
          cost: -A,
          effects: { lingering: {
            id: "briefed-rival",
            label: "Rival knows your playbook",
            monthsLeft: 4,
            demandMult: 0.95,
            cogsMult: 1,
            good: false
          } },
          result: "*taking notes* Fascinating. FASCINATING. You've been very helpful. You'll see just how helpful shortly.",
          resultMood: "happy"
        },
        {
          label: "Walk him out, politely",
          hint: "Your secrets stay yours",
          tone: "steady",
          effects: { repDelta: 1, moraleDelta: 3 },
          result: "*at the door* Worth a try. It's always worth a try. See you around, neighbor \u2014 the market decides these things anyway.",
          resultMood: "neutral"
        },
        {
          label: t.sampleLabel,
          hint: "Confidence is a message",
          tone: "bold",
          effects: { repDelta: 2 },
          result: t.sampleReaction,
          resultMood: "worried"
        }
      ]
    };
}
  },
  {
    id: "vega-walkthrough",
    category: "ops",
    weight: (e) => e.inspectionDue ? 0 : 0.6,
    build: (e) => {
  let t = we(600, e.macro.cpi);
  return {
      id: "vega-walkthrough",
      venue: "inside",
      title: "Inspector Vega, off duty. Mostly.",
      speaker: "inspector",
      mood: "neutral",
      lines: [
        "Off the record \u2014 I'm not inspecting today. I had lunch nearby and my feet walked me here out of habit.",
        "But habits notice things. Want me to point out what I'd flag if I WERE working? Free advice, one-time offer."
      ],
      options: [
        {
          label: `Yes \u2014 and fix what she finds ($${t.toLocaleString()})`,
          hint: "Cheaper than a citation later",
          tone: "steady",
          cost: t,
          effects: { repDelta: 2, moraleDelta: 2 },
          result: "Three small things, all fixable, all fixed by Friday. *nods* When I DO come back, this will be a boring visit. I love boring visits.",
          resultMood: "happy"
        },
        {
          label: "We run a tight ship already",
          hint: "Confident \u2014 hopefully correctly",
          tone: "thrifty",
          effects: Math.random() < 0.35 ? { lingering: {
            id: "unseen-issue",
            label: "Something's off in back",
            monthsLeft: 2,
            demandMult: 1,
            cogsMult: 1.04,
            good: false
          } } : {},
          result: "*shrugs* Your call. Ships always look tight from the deck. It's the hull you want to worry about.",
          resultMood: "neutral"
        }
      ]
    };
}
  },
  {
    id: "catering-order",
    category: "growth",
    unsuited: ["barber"],
    weight: () => 0.9,
    build: (e) => {
  let t = FLAVOR[e.business], o = we(1800, e.macro.cpi);
  return {
      id: "catering-order",
      venue: "back",
      title: "A very big order",
      speaker: "manager",
      mood: "happy",
      lines: [
        `Boss! Big one just came in. ${t.bigOrder}. $${o.toLocaleString()}, paid up front.`,
        "Catch is, it's huge. That's two brutal days on top of regular service. The team can do it. The team will FEEL it."
      ],
      options: [
        {
          label: `Take the order (+$${o.toLocaleString()})`,
          hint: "A windfall, paid in sweat",
          tone: "steady",
          cost: -o,
          effects: { moraleDelta: -5, fatigueDelta: 1, repDelta: 2 },
          result: t.bigOrderDone,
          resultMood: "happy"
        },
        {
          label: "Too much strain \u2014 pass",
          hint: "Protect the team and the regulars",
          tone: "thrifty",
          effects: { moraleDelta: 2 },
          result: "I'll tell them we're booked. Honestly? Probably right. The regulars come first, and the team could use a normal week.",
          resultMood: "neutral"
        }
      ]
    };
}
  },
  {
    id: "local-critic",
    category: "growth",
    unsuited: ["convenience", "barber"],
    weight: (e) => 0.5 + e.reputation / 150,
    build: (e) => {
  let t = FLAVOR[e.business], o = we(400, e.macro.cpi), A = Math.random() < 0.7, a = Math.random() < 0.5;
  return {
      id: "local-critic",
      venue: "inside",
      title: "Miss June brings intelligence",
      speaker: "regular",
      mood: "worried",
      lines: [
        "Dear. Lean in. You didn't hear this from me \u2014 my niece works at the paper.",
        `A REVIEWER is coming this month. Anonymous, but my niece says they ${t.criticTell}. What are you going to do about it?`
      ],
      options: [
        {
          label: `Drill the team all week ($${o.toLocaleString()})`,
          hint: "Leave nothing to chance",
          tone: "steady",
          cost: o,
          effects: A ? {
            repDelta: 4,
            moraleDelta: -2,
            lingering: {
              id: "good-review",
              label: "Glowing write-up",
              monthsLeft: 2,
              demandMult: 1.06,
              cogsMult: 1,
              good: true
            }
          } : { moraleDelta: -4 },
          result: A ? `The write-up is in! "Precise, warm, worth crossing town for." I'm framing it. I'm framing TWO.` : "All that drilling and\u2026 no review ever ran. My niece thinks they got reassigned. The team is exhausted for nothing, dear.",
          resultMood: A ? "happy" : "worried"
        },
        {
          label: "We are what we are \u2014 act natural",
          hint: "A coin flip with your reputation",
          tone: "bold",
          effects: a ? { repDelta: 3 } : { repDelta: -3 },
          result: a ? `The review ran: "unpretentious and genuine." See? I always said you were genuine. I'll take my usual, dear.` : 'Oh dear. "Uneven on a Tuesday." UNEVEN. Well \u2014 nobody reads the Tuesday edition anyway. *pats your hand*',
          resultMood: a ? "happy" : "worried"
        }
      ]
    };
}
  },
  {
    id: "staff-idea",
    category: "ops",
    weight: (e) => e.morale >= 50 ? 0.9 : 0.3,
    build: (e) => {
  let t = FLAVOR[e.business], o = we(600, e.macro.cpi);
  return {
      id: "staff-idea",
      venue: "back",
      title: "Sam has been sketching again",
      speaker: "manager",
      mood: "happy",
      lines: [
        `Okay hear me out. I've been timing ${t.flowNoun} for two weeks. We cross paths eleven times an hour back here. ELEVEN.`,
        `Rearrange the stations \u2014 about $${o.toLocaleString()} in shelving and a weekend \u2014 and I can get us twenty minutes back per shift. I made a diagram. There's a laminated version.`
      ],
      options: [
        {
          label: `Fund the reorganization ($${o.toLocaleString()})`,
          hint: "Trust the laminated diagram",
          tone: "steady",
          cost: o,
          effects: {
            moraleDelta: 6,
            lingering: {
              id: "smooth-flow",
              label: "Streamlined prep",
              monthsLeft: 4,
              demandMult: 1,
              cogsMult: 0.97,
              good: true
            }
          },
          result: "IT WORKS. It works exactly like the diagram. Nobody has collided in three days. I have never been happier.",
          resultMood: "happy"
        },
        {
          label: "Interesting \u2014 maybe next quarter",
          hint: "Free, slightly deflating",
          tone: "thrifty",
          effects: { moraleDelta: -3 },
          result: "*rolls up the diagram very slowly* Sure. Next quarter. I'll just\u2026 keep colliding with people. Eleven times an hour.",
          resultMood: "worried"
        }
      ]
    };
}
  },
  {
    id: "neighbor-complaint",
    category: "ops",
    weight: () => 0.6,
    build: (e) => {
  let t = we(250, e.macro.cpi);
  return {
      id: "neighbor-complaint",
      venue: "street",
      title: "Marcus, less cheerful than usual",
      speaker: "neighbor",
      mood: "stern",
      lines: [
        "Hey. Neighbor to neighbor \u2014 your late crew's been leaving the bins out past midnight, and the lids don't shut.",
        "My six-AM class does NOT love the smell, and two of them mentioned it by name. Yours, not mine. Small thing now. Won't stay small."
      ],
      options: [
        {
          label: `Sort the bins properly ($${t.toLocaleString()})`,
          hint: "Good fences, good neighbors",
          tone: "steady",
          cost: t,
          effects: { repDelta: 2 },
          result: "THAT'S all I'm asking. New lids, new schedule, done. First smoothie's on me if you ever brave one.",
          resultMood: "happy"
        },
        {
          label: "Bins are bins, Marcus",
          hint: "Free, and neighborly relations sour",
          tone: "thrifty",
          effects: { repDelta: -3, loyaltyDelta: -6 },
          result: "*long exhale* Okay. Okay! Just know my members talk to YOUR customers. That's all I'll say. Bins are bins.",
          resultMood: "stern"
        }
      ]
    };
}
  },
  {
    id: "senior-discount",
    category: "growth",
    unsuited: ["convenience"],
    weight: (e) => 0.4 + locationOf(e.location).segmentMix.locals * 0.8,
    build: () => ({
      id: "senior-discount",
      venue: "inside",
      title: "A delegation of regulars",
      speaker: "regular",
      mood: "happy",
      lines: [
        "Dear, the bridge club took a vote \u2014 don't look alarmed, you won.",
        "We'd like a little regulars' discount. Nothing dramatic. Ten percent, weekday mornings. In exchange you get us, forever, and we are EXTREMELY loyal and EXTREMELY punctual."
      ],
      options: [
        {
          label: "Regulars' discount, weekday mornings",
          hint: "Thinner margin, thicker loyalty",
          tone: "steady",
          effects: {
            loyaltyDelta: 14,
            lingering: {
              id: "regulars-club",
              label: "Regulars' club",
              monthsLeft: 6,
              demandMult: 1.02,
              cogsMult: 1.02,
              good: true
            }
          },
          result: "WONDERFUL. I'll tell the club. You've just acquired eleven of the most reliable customers in the neighborhood, dear. We take attendance.",
          resultMood: "happy"
        },
        {
          label: "Everyone pays the same here",
          hint: "Fair, firm, a little chilly",
          tone: "thrifty",
          effects: { loyaltyDelta: -4 },
          result: "*sniffs* Principled. The club respects principle. The club also remembers, dear. We'll see you Tuesday regardless.",
          resultMood: "stern"
        }
      ]
    })
  },
  {
    id: "rush-prep",
    category: "strategic",
    weight: (e) => {
  let t = (e.month + 2) % 12 + 1, o = businessOf(e.business);
  return Math.min(Math.abs(t - o.peakMonth), 12 - Math.abs(t - o.peakMonth)) <= 1 ? 1.6 : 0.2;
},
    build: (e) => {
  let t = we(700, e.macro.cpi), o = Math.random() < 0.35;
  return {
      id: "rush-prep",
      venue: "back",
      title: "The busy season is coming",
      speaker: "supplier",
      mood: "neutral",
      lines: [
        "Boss. Calendar check \u2014 your big season's almost here, and everyone orders from me the same desperate week. Every year. Like clockwork.",
        `Pre-order now at $${t.toLocaleString()} and I lock your stock at today's prices, delivered early. Or ride your luck with everyone else. I'll love you either way, but one of you will be crying in three weeks.`
      ],
      options: [
        {
          label: `Pre-order the season's stock ($${t.toLocaleString()})`,
          hint: "Locked prices, zero scramble",
          tone: "steady",
          cost: t,
          effects: { lingering: {
            id: "stocked-up",
            label: "Season stocked",
            monthsLeft: 2,
            demandMult: 1,
            cogsMult: 0.94,
            good: true
          } },
          result: "Smart. SMART. Your pallet's already got your name on it. Watch everyone else fight over the leftovers in a few weeks.",
          resultMood: "happy"
        },
        {
          label: "We'll ride our luck",
          hint: "Keep the cash, roll the dice",
          tone: "thrifty",
          effects: o ? { lingering: {
            id: "stockout",
            label: "Supply scramble",
            monthsLeft: 2,
            demandMult: 0.95,
            cogsMult: 1.05,
            good: false
          } } : {},
          result: o ? "*three weeks later, on the phone* Yeahhh, so, about stock\u2026 everyone ordered at once. Like I said. Crying week." : "Luck held! This year. It held THIS year. I'm writing that down for next year's pitch.",
          resultMood: o ? "worried" : "neutral"
        }
      ]
    };
}
  },
  {
    id: "mystery-shopper",
    category: "ops",
    weight: (e) => e.staff >= 2 ? 0.6 : 0.2,
    build: (e) => {
  let t = FLAVOR[e.business], o = we(300, e.macro.cpi), A = Math.random() < 0.5;
  return {
      id: "mystery-shopper",
      venue: "office",
      title: "A test of the ordinary Tuesday",
      speaker: "accountant",
      mood: "neutral",
      lines: [
        "Management idea for you. Cheap one, even \u2014 you know I don't bring you expensive ideas.",
        `Send a friend in as a mystery shopper. $${o.toLocaleString()} covers ${t.mysteryCover} and a small thank-you. You'll learn what a stranger's Tuesday actually feels like, without you standing there making everyone behave.`
      ],
      options: [
        {
          label: `Run the mystery shop ($${o.toLocaleString()})`,
          hint: "The truth, cheaply",
          tone: "steady",
          cost: o,
          effects: A ? {
            moraleDelta: -2,
            lingering: {
              id: "service-tune",
              label: "Service tuned up",
              monthsLeft: 3,
              demandMult: 1.03,
              cogsMult: 1,
              good: true
            }
          } : { moraleDelta: 3, repDelta: 1 },
          result: A ? `Report's in: ${t.mysteryFindings}. All fixable \u2014 and now we're fixing them.` : "Report's in: essentially flawless. I'll admit I'm a little disappointed. The team earned this one \u2014 tell them.",
          resultMood: A ? "neutral" : "happy"
        },
        {
          label: "I trust what I see",
          hint: "Free, and comfortably blind",
          tone: "thrifty",
          result: "Noted. For the record: everyone behaves when the owner's watching. That's not data, that's theater. But noted.",
          resultMood: "neutral"
        }
      ]
    };
}
  }
];
function choiceToCard(choice) {
  let stage = {
    "bad-press": {
      speaker: "regular",
      mood: "worried",
      venue: "inside",
      lines: [
        "Dear. Sit down. Have you SEEN what they're saying online?",
        "Some reviewer with far too many followers tore this place apart. It's spreading. Bridge club is already asking me about it. How are you going to answer?"
      ]
    },
    "supplier-deal": {
      speaker: "supplier",
      mood: "happy",
      venue: "street",
      lines: [
        "Big day, boss. Head office finally approved what I've been pushing for: a real contract, just for you.",
        "Lock in 8% below market for six months. One grand to onboard, and supply spikes can't touch you. I pulled strings for this!"
      ]
    },
    influencer: {
      speaker: "influencer",
      mood: "happy",
      venue: "inside",
      lines: [
        "Okay so \u2014 hi, I'm Zoe, you've maybe seen my stuff? Two hundred thousand locals follow where I eat and shop.",
        "I want to feature THIS place. The vibe is so real. Two thousand for the full treatment. Fair warning: my followers will show up in force, and they'll expect something new next visit."
      ]
    }
  }[choice.id] ?? { speaker: "manager", mood: "neutral", venue: "inside", lines: [choice.body] };
  return {
    id: choice.id,
    title: choice.headline.replace(/^[^\w]*/, ""),
    speaker: stage.speaker,
    mood: stage.mood,
    venue: stage.venue,
    lines: stage.lines,
    fromEvent: true,
    options: choice.options.map((o, i) => ({ label: o.label, hint: o.hint, tone: i === 0 ? "bold" : "thrifty", result: "" }))
  };
}
function eventResponseLine(choiceId, optionIndex) {
  return {
    "bad-press": [
      {
        line: "A public apology AND retraining? Good. That's how my generation did it. I'll tell bridge club the matter is handled.",
        mood: "happy"
      },
      {
        line: "Ignore it?! Dear, that story is going to circulate like a casserole recipe. Don't say I didn't warn you.",
        mood: "stern"
      }
    ],
    "supplier-deal": [
      {
        line: "THERE it is! Signed and locked. Six months of prices nobody else on this street is getting. You're my favorite stop, don't tell the others.",
        mood: "happy"
      },
      {
        line: "Staying flexible, huh? I get it, I get it. Offer stands till head office notices I made it.",
        mood: "neutral"
      }
    ],
    influencer: [
      {
        line: "Posted! It's already doing numbers. Brace yourself \u2014 my followers are VERY enthusiastic. Good luck!!",
        mood: "happy"
      },
      {
        line: "Passing on free fame? Bold. Respect the confidence. My followers will find somewhere else to hang out, I guess.",
        mood: "neutral"
      }
    ]
  }[choiceId]?.[optionIndex] ?? { line: "Consider it done.", mood: "neutral" };
}
function drawCards(e) {
  let cards = [];
  e.pendingChoice && cards.push(choiceToCard(e.pendingChoice));
  let byCat = (cat) => CARDS.filter((d) => d.category === cat), drawn = /* @__PURE__ */ new Set(), speakersUsed = new Set(cards.map((card) => card.speaker)), drawFrom = (pool, anySpeaker = false) => {
    let avail = pool.filter((d) => !drawn.has(d.id) && (e.cooldowns?.[d.id] ?? 0) <= 0 && !(d.unsuited ?? []).includes(e.business)), weights = avail.map((d) => d.weight(e)), total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (let i = 0; i < avail.length; i++) if (r -= weights[i], r <= 0) {
      let built = avail[i].build(e);
      return !anySpeaker && speakersUsed.has(built.speaker) ? (drawn.add(avail[i].id), drawFrom(pool, false) ?? drawFrom(pool, true)) : (drawn.add(avail[i].id), speakersUsed.add(built.speaker), built);
    }
    return null;
  }, shape = ["ops", "growth", "strategic", Math.random() < 0.5 ? "ops" : "growth"];
  for (let cat of shape) {
    if (cards.length >= DECISIONS_PER_MONTH) break;
    let card = drawFrom(byCat(cat)) ?? drawFrom(CARDS);
    card && cards.push(card);
  }
  for (; cards.length < DECISIONS_PER_MONTH; ) {
    let n = drawFrom(CARDS);
    if (!n) break;
    cards.push(n);
  }
  return cards.slice(0, DECISIONS_PER_MONTH);
}
function applyOption(e, card, optionIndex) {
  if (card.fromEvent) {
    let resolved = resolveChoice(e, optionIndex).state, tone = card.options[optionIndex]?.tone, stats = tone ? { ...resolved.choiceStats, [tone]: (resolved.choiceStats?.[tone] ?? 0) + 1 } : resolved.choiceStats;
    return {
      ...resolved,
      choiceStats: stats,
      plan: { ...resolved.plan, decisionsMade: resolved.plan.decisionsMade + 1 }
    };
  }
  let opt = card.options[optionIndex];
  if (!opt) return e;
  let next = { ...e, plan: { ...e.plan }, effects: [...e.effects], log: [...e.log] };
  opt.cost && (next.cash -= opt.cost), opt.action && (opt.action === "renovate" ? next = { ...renovate(next), plan: next.plan } : opt.action === "productLine" ? next = { ...launchProductLine(next), plan: next.plan } : opt.action === "borrow" ? next = { ...borrow(next), plan: next.plan } : opt.action === "repay" ? next = { ...repay(next), plan: next.plan } : opt.action === "bonus" ? next = { ...payStaffBonus(next), plan: next.plan } : opt.action === "hire" ? next.staff = Math.min(14, next.staff + 1) : opt.action === "fire" ? (next.staff = Math.max(1, next.staff - 1), next.morale = Math.max(0, next.morale - 5)) : "setPrice" in opt.action ? next.priceLevel = opt.action.setPrice : "setMarketing" in opt.action && (next.marketingTier = opt.action.setMarketing));
  let fx = opt.effects;
  return fx && (fx.demandMult && (next.plan.demandMult *= fx.demandMult), fx.cogsMult && (next.plan.cogsMult *= fx.cogsMult), fx.repDelta && (next.plan.repDelta += fx.repDelta), fx.moraleDelta && (next.plan.moraleDelta += fx.moraleDelta), fx.fatigueDelta && (next.plan.fatigueDelta += fx.fatigueDelta), fx.loyaltyDelta && (next.plan.loyaltyDelta += fx.loyaltyDelta), fx.conditionDelta && (next.condition = Math.max(0, Math.min(100, next.condition + fx.conditionDelta))), fx.lingering && next.effects.push({ ...fx.lingering })), next.plan.decisionsMade += 1, next.cooldowns = { ...next.cooldowns, [card.id]: COOLDOWNS[card.id] ?? 3 }, opt.tone && (next.choiceStats = { ...next.choiceStats, [opt.tone]: (next.choiceStats?.[opt.tone] ?? 0) + 1 }), next;
}
var pick = (arr) => arr[Math.floor(Math.random() * arr.length)], MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
function calendarMonth(gameMonth) {
  return (gameMonth - 1 + 2) % 12 + 1;
}
function monthName(gameMonth) {
  return MONTH_NAMES[calendarMonth(gameMonth) - 1];
}
function yearOf(gameMonth) {
  return 1 + Math.floor((gameMonth - 1 + 2) / 12);
}
var SEASON_LINES = {
  winter: [
    "Cold rain streaks the windows and everyone comes in with their shoulders up.",
    "The heater hums all day. Daylight is gone by five.",
    "Snow slush tracks across the floor no matter how often you mop."
  ],
  spring: [
    "The street trees are budding and foot traffic is waking up with them.",
    "First warm week of the season \u2014 people are lingering outside again.",
    "Pollen dusts the windowsills. The morning light comes earlier now."
  ],
  summer: [
    "The afternoons are long and hot, and the sidewalk is busy late.",
    "Summer crowds drift past in no hurry at all.",
    "The AC strains through the afternoon rush."
  ],
  fall: [
    "Leaves pile against the doorway. The morning air has a bite to it.",
    "The after-work rush comes earlier as the days shorten.",
    "Sweater weather \u2014 your regulars linger a little longer inside."
  ]
};
function seasonOf(cal) {
  return cal === 12 || cal <= 2 ? "winter" : cal <= 5 ? "spring" : cal <= 8 ? "summer" : "fall";
}
var PHASE_LINES = {
  boom: [
    "The papers say the economy is roaring, and you can feel it in the till.",
    "Money is loose right now \u2014 people are treating themselves."
  ],
  steady: [
    "Business news is quiet. Steady as she goes.",
    "No headlines, no drama \u2014 the kind of month you can plan around."
  ],
  downturn: [
    "Customers are counting their change again. You can feel belts tightening.",
    "The slowdown is in the air \u2014 smaller orders, more hesitation."
  ],
  recession: [
    "The recession is the only thing anyone talks about. Every sale feels earned.",
    "Times are hard out there. People still come \u2014 but carefully."
  ]
}, STATE_HOOKS = {
  highFatigue: [
    "You catch a regular stifling a yawn at the menu. Same old, same old.",
    "The concept is feeling stale \u2014 you've seen three regulars less often lately."
  ],
  lowMorale: [
    "The team is quiet this week. Not the good kind of quiet.",
    "Someone left the break-room door shut all shift. Morale needs attention."
  ],
  highRep: [
    "A stranger tells you their friend recommended this place. Word is out.",
    "Your name is starting to mean something around here."
  ],
  lowCash: [
    "You check the account before opening. The number stares back, unimpressed.",
    "Cash is tight enough that you do the math twice on every order."
  ],
  rivals: [
    "On your walk in, you pass the competition. Their line is not short.",
    "A rival flyer is taped to the lamppost outside. Bold of them."
  ]
};
function monthOpen(s) {
  let cal = calendarMonth(s.month + 1), season = seasonOf(cal), name = s.ownerName ? `, ${s.ownerName}` : "", lines = [
    `${monthName(s.month + 1)}, year ${yearOf(s.month + 1)}. You unlock the door of your ${businessOf(s.business).name.toLowerCase()} in ${locationOf(s.location).name}${name}.`,
    pick(SEASON_LINES[season]),
    pick(PHASE_LINES[s.macro.phase])
  ];
  return s.fatigue > 55 ? lines.push(pick(STATE_HOOKS.highFatigue)) : s.morale < 45 ? lines.push(pick(STATE_HOOKS.lowMorale)) : s.cash < 6e3 ? lines.push(pick(STATE_HOOKS.lowCash)) : s.competitors.length >= 2 ? lines.push(pick(STATE_HOOKS.rivals)) : s.reputation > 70 && lines.push(pick(STATE_HOOKS.highRep)), lines.join(" ");
}
function monthRecap(r, s) {
  let profitLine = r.profit >= 4e3 ? pick([
    `A genuinely great month \u2014 ${fmtMoney(r.profit)} to the good.`,
    `You count the month out at +${fmtMoney(r.profit)}. This is what it's supposed to feel like.`
  ]) : r.profit >= 500 ? pick([
    `The month closes ${fmtMoney(r.profit)} in the black. Not glamorous, but forward.`,
    `A modest +${fmtMoney(r.profit)}. Rent is paid and the lights stay on.`
  ]) : r.profit >= -500 ? pick([
    "You basically broke even. A month of running to stand still.",
    "The ledger lands at almost exactly zero. All that work, a wash."
  ]) : pick([
    `The month bleeds ${fmtMoney(-r.profit)}. You feel every dollar of it.`,
    `Down ${fmtMoney(-r.profit)}. You sit with the books a long time after close.`
  ]), extras = [];
  return r.lostToCapacity > r.customers * 0.12 && extras.push("You turned people away at the door \u2014 the place simply cannot hold them."), r.taxes > 0 && extras.push(`The quarterly tax bill took ${fmtMoney(r.taxes)}.`), s.loyalty > 20 && r.loyalCustomers > 0 && extras.push(`${r.loyalCustomers} regulars now count this place as theirs.`), [profitLine, ...extras].join(" ");
}
function ji(e, t, o, A) {
  let a = o - t, s = A ? "It was not enough. The bank made its call while you were gone." : a >= 0 ? `The books moved ${fmtMoney(a)} in your favor.` : `Running on autopilot cost you ${fmtMoney(-a)}.`;
  return `You were away, and the world did not wait: ${e} month${e > 1 ? "s" : ""} passed. Your team kept the doors open without you \u2014 decisions deferred, opportunities missed. ${s}`;
}
function fmtMoney(v) {
  return `$${Math.round(Math.abs(v)).toLocaleString()}`;
}
var ca = 1200 * 1e3, Ni = 1440 * 60 * 1e3, Ji = 3;
function Ki(e, t = Date.now()) {
  if (e.gameOver) return { state: e, monthsPassed: 0 };
  let o = t - (e.lastPlayedAt || t), A = Math.min(Ji, Math.floor(o / Ni), e.maxMonths - e.month);
  if (A <= 0) return { state: e, monthsPassed: 0 };
  let a = e.cash, s = e;
  for (let r = 0; r < A && !s.gameOver; r++) s = endMonth(s).state, s.pendingChoice && (s = { ...s, pendingChoice: null });
  return s = { ...s, lastPlayedAt: t, awayRecap: ji(A, a, s.cash, s.bankrupt) }, { state: s, monthsPassed: A };
}
var MENUS = {
  restaurant: {
    heading: "Dinner Menu",
    base: [
      { name: "Bruschetta", mult: 0.45 },
      { name: "House Pasta", mult: 1 },
      { name: "Grilled Salmon", mult: 1.35 },
      { name: "Steak Frites", mult: 1.6 },
      { name: "Tiramisu", mult: 0.5 }
    ],
    extras: [
      { name: "Truffle Risotto", mult: 1.5 },
      { name: "Weekend Brunch", mult: 1.1 },
      { name: "Wine Pairing Flight", mult: 0.9 },
      { name: "Catch of the Day", mult: 1.4 },
      { name: "Chef's Tasting Menu", mult: 2.2 }
    ]
  },
  convenience: {
    heading: "In Store Today",
    base: [
      { name: "Coffee to Go", mult: 0.35 },
      { name: "Deli Sandwich", mult: 0.8 },
      { name: "Snacks & Candy", mult: 0.3 },
      { name: "Cold Six-Pack", mult: 1.3 },
      { name: "Everyday Essentials", mult: 1 }
    ],
    extras: [
      { name: "Fresh Produce Corner", mult: 0.9 },
      { name: "Hot Food Counter", mult: 1.1 },
      { name: "Local Goods Shelf", mult: 1.2 },
      { name: "Pharmacy Basics", mult: 0.8 },
      { name: "Lottery & Games", mult: 0.5 }
    ]
  },
  coffee: {
    heading: "Drinks & Bites",
    base: [
      { name: "Drip Coffee", mult: 0.4 },
      { name: "Cappuccino", mult: 0.7 },
      { name: "Latte", mult: 0.75 },
      { name: "Cold Brew", mult: 0.8 },
      { name: "Butter Croissant", mult: 0.55 }
    ],
    extras: [
      { name: "Matcha Latte", mult: 0.85 },
      { name: "Nitro Cold Brew", mult: 0.95 },
      { name: "Seasonal Special", mult: 0.9 },
      { name: "Affogato", mult: 0.8 },
      { name: "Breakfast Sandwich", mult: 1.1 }
    ]
  },
  bakery: {
    heading: "Fresh This Morning",
    base: [
      { name: "Croissant", mult: 0.5 },
      { name: "Baguette", mult: 0.55 },
      { name: "Cinnamon Roll", mult: 0.65 },
      { name: "Sourdough Loaf", mult: 1 },
      { name: "Cookies (3)", mult: 0.45 }
    ],
    extras: [
      { name: "Focaccia", mult: 0.9 },
      { name: "Danish Box", mult: 1.4 },
      { name: "Macarons (6)", mult: 1.6 },
      { name: "Seasonal Pie", mult: 2.2 },
      { name: "Celebration Cake", mult: 3.5 }
    ]
  },
  barber: {
    heading: "Services",
    base: [
      { name: "Classic Cut", mult: 1 },
      { name: "Skin Fade", mult: 1.1 },
      { name: "Beard Trim", mult: 0.5 },
      { name: "Kids Cut", mult: 0.7 },
      { name: "Hot Towel Shave", mult: 1.3 }
    ],
    extras: [
      { name: "Head Massage Add-on", mult: 0.6 },
      { name: "Color & Style", mult: 1.6 },
      { name: "Grooming Products", mult: 0.8 },
      { name: "Full Service Package", mult: 1.8 },
      { name: "Monthly Membership", mult: 3 }
    ]
  }
};
function currentMenu(e) {
  let biz = businessOf(e.business), def = MENUS[e.business], unit = biz.baseTicket * priceLevelOf(e.priceLevel).mult * e.macro.cpi, a = [
    ...def.base.map((i) => ({ name: i.name, price: i.mult * unit, isNew: false })),
    ...def.extras.slice(0, e.productLines).map((i) => ({ name: i.name, price: i.mult * unit, isNew: true }))
  ], level = priceLevelOf(e.priceLevel), notes = {
    budget: "Everyday low prices",
    value: "Fair prices, honest portions",
    standard: "The neighborhood standard",
    premium: "Quality worth a little more",
    luxury: "A finer experience"
  };
  return { heading: def.heading, lines: a, note: notes[level.id] };
}
function formatPrice(p) {
  return p >= 100 ? `$${Math.round(p)}` : `$${p.toFixed(2)}`;
}
import * as THREE6 from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var Wi = class {
  constructor(minX, minZ, maxX, maxZ, cell = 0.3) {
    this.area = null, this.cell = cell, this.minX = minX, this.minZ = minZ, this.w = Math.ceil((maxX - minX) / cell), this.h = Math.ceil((maxZ - minZ) / cell), this.blocked = new Uint8Array(this.w * this.h);
  }
  addBox(b, pad) {
    let x0 = b.x0 - pad, x1 = b.x1 + pad, z0 = b.z0 - pad, z1 = b.z1 + pad, i0 = Math.max(0, Math.floor((x0 - this.minX) / this.cell)), i1 = Math.min(this.w - 1, Math.ceil((x1 - this.minX) / this.cell)), j0 = Math.max(0, Math.floor((z0 - this.minZ) / this.cell)), j1 = Math.min(this.h - 1, Math.ceil((z1 - this.minZ) / this.cell));
    for (let j2 = j0; j2 <= j1; j2++) for (let i = i0; i <= i1; i++) {
      let cx = this.minX + (i + 0.5) * this.cell, cz = this.minZ + (j2 + 0.5) * this.cell;
      cx > x0 && cx < x1 && cz > z0 && cz < z1 && (this.blocked[j2 * this.w + i] = 1);
    }
  }
  labelAreas() {
    let W = this.w, H = this.h, area = new Int32Array(W * H), stack = new Int32Array(W * H), id = 0;
    for (let start = 0; start < W * H; start++) {
      if (this.blocked[start] || area[start]) continue;
      id++;
      let top = 0;
      for (stack[top++] = start, area[start] = id; top; ) {
        let c2 = stack[--top], i = c2 % W, j2 = c2 / W | 0;
        i > 0 && !this.blocked[c2 - 1] && !area[c2 - 1] && (area[c2 - 1] = id, stack[top++] = c2 - 1), i < W - 1 && !this.blocked[c2 + 1] && !area[c2 + 1] && (area[c2 + 1] = id, stack[top++] = c2 + 1), j2 > 0 && !this.blocked[c2 - W] && !area[c2 - W] && (area[c2 - W] = id, stack[top++] = c2 - W), j2 < H - 1 && !this.blocked[c2 + W] && !area[c2 + W] && (area[c2 + W] = id, stack[top++] = c2 + W);
      }
    }
    this.area = area;
  }
  areaAt(i, j2) {
    return this.area && i >= 0 && j2 >= 0 && i < this.w && j2 < this.h ? this.area[j2 * this.w + i] : 0;
  }
  ci(x) {
    return Math.floor((x - this.minX) / this.cell);
  }
  cj(z) {
    return Math.floor((z - this.minZ) / this.cell);
  }
  wx(i) {
    return this.minX + (i + 0.5) * this.cell;
  }
  wz(j2) {
    return this.minZ + (j2 + 0.5) * this.cell;
  }
  freeCell(i, j2) {
    return i >= 0 && j2 >= 0 && i < this.w && j2 < this.h && !this.blocked[j2 * this.w + i];
  }
  isFree(x, z) {
    return this.freeCell(this.ci(x), this.cj(z));
  }
  nearestFree(x, z, area = 0) {
    let i0 = this.ci(x), j0 = this.cj(z), ok = (i, j2) => this.freeCell(i, j2) && (!area || this.areaAt(i, j2) === area);
    if (ok(i0, j0)) return [i0, j0];
    for (let r = 1; r < 70; r++) {
      let best = null, bestD = 1 / 0;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        let i = i0 + di, j2 = j0 + dj;
        if (!ok(i, j2)) continue;
        let d = di * di + dj * dj;
        d < bestD && (bestD = d, best = [i, j2]);
      }
      if (best) return best;
    }
    return null;
  }
  lineFree(ax, az, bx, bz) {
    let dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(len / (this.cell * 0.4)));
    for (let k = 0; k <= steps; k++) {
      let t = k / steps;
      if (!this.isFree(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  }
  findPath(sx, sz, tx, tz) {
    let a = this.nearestFree(sx, sz);
    if (!a) return null;
    let reach = this.areaAt(a[0], a[1]), t = this.nearestFree(tx, tz, reach);
    if (!t) return null;
    let n = this.w, N2 = this.w * this.h, start = a[1] * n + a[0], goal = t[1] * n + t[0], endX = this.wx(t[0]), endZ = this.wz(t[1]), exactEnd = this.isFree(tx, tz) && (!reach || this.areaAt(this.ci(tx), this.cj(tz)) === reach);
    if (start === goal) return [{ x: exactEnd ? tx : endX, z: exactEnd ? tz : endZ }];
    let g = new Float32Array(N2).fill(1 / 0), from = new Int32Array(N2).fill(-1), closed = new Uint8Array(N2), heap = [], f = new Float32Array(N2), push = (n2) => {
      heap.push(n2);
      let k2 = heap.length - 1;
      for (; k2 > 0; ) {
        let p = k2 - 1 >> 1;
        if (f[heap[p]] <= f[heap[k2]]) break;
        [heap[p], heap[k2]] = [heap[k2], heap[p]], k2 = p;
      }
    }, pop = () => {
      let top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k2 = 0;
        for (; ; ) {
          let l = 2 * k2 + 1, r = l + 1, m = k2;
          if (l < heap.length && f[heap[l]] < f[heap[m]] && (m = l), r < heap.length && f[heap[r]] < f[heap[m]] && (m = r), m === k2) break;
          [heap[m], heap[k2]] = [heap[k2], heap[m]], k2 = m;
        }
      }
      return top;
    }, hx = t[0], hz = t[1], heur = (i, j2) => {
      let dx = Math.abs(i - hx), dz = Math.abs(j2 - hz);
      return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    g[start] = 0, f[start] = heur(a[0], a[1]), push(start);
    let found = false, guard = 0;
    for (; heap.length && guard++ < 4e5; ) {
      let cur = pop();
      if (cur === goal) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      let ci = cur % n, cj = cur / n | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        let ni = ci + di, nj = cj + dj;
        if (!this.freeCell(ni, nj) || di && dj && (!this.freeCell(ci + di, cj) || !this.freeCell(ci, cj + dj))) continue;
        let He = nj * n + ni;
        if (closed[He]) continue;
        let ng = g[cur] + (di && dj ? Math.SQRT2 : 1);
        ng < g[He] && (g[He] = ng, from[He] = cur, f[He] = ng + heur(ni, nj), push(He));
      }
    }
    if (!found) return null;
    let raw = [];
    for (let U = goal; U !== -1; U = from[U]) raw.push({ x: this.wx(U % n), z: this.wz(U / n | 0) });
    raw.reverse(), raw[raw.length - 1] = { x: exactEnd ? tx : endX, z: exactEnd ? tz : endZ };
    let out = [], anchor = { x: sx, z: sz }, k = 0;
    for (; k < raw.length; ) {
      let far = k;
      for (let m = raw.length - 1; m > k; m--) if (this.lineFree(anchor.x, anchor.z, raw[m].x, raw[m].z)) {
        far = m;
        break;
      }
      out.push(raw[far]), anchor = raw[far], k = far + 1;
    }
    return out;
  }
};
function collide(p, t, boxes) {
  for (let b of boxes) {
    let cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1)), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (!(d2 >= t * t)) if (d2 > 1e-9) {
      let d = Math.sqrt(d2);
      p.x = cx + dx / d * t, p.z = cz + dz / d * t;
    } else {
      let l = p.x - b.x0, rr2 = b.x1 - p.x, f = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rr2, f, bt);
      m === l ? p.x = b.x0 - t : m === rr2 ? p.x = b.x1 + t : m === f ? p.z = b.z0 - t : p.z = b.z1 + t;
    }
  }
}
import * as THREE2 from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
function batch(root, exclude = /* @__PURE__ */ new Set()) {
  root.updateMatrixWorld(true);
  let inv = root.matrixWorld.clone().invert(), buckets = /* @__PURE__ */ new Map(), victims = [], s = new THREE.Matrix4(), visit = (o) => {
    if (o !== root && exclude.has(o)) return;
    let mesh = o;
    if (mesh.isMesh && !o.isPoints && !Array.isArray(mesh.material) && o.visible && !o.userData.keep) {
      let l = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      s.multiplyMatrices(inv, mesh.matrixWorld), l.applyMatrix4(s), l.attributes.uv || l.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(l.attributes.position.count * 2), 2)), l.attributes.normal || l.computeVertexNormals();
      for (let k of Object.keys(l.attributes)) k !== "position" && k !== "normal" && k !== "uv" && l.deleteAttribute(k);
      let mat2 = mesh.material, key = `${mat2.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`, b = buckets.get(key);
      b || (b = { mat: mat2, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [] }, buckets.set(key, b)), b.geos.push(l), victims.push(mesh);
    }
    for (let c2 of [...o.children]) visit(c2);
  };
  visit(root);
  for (let b of buckets.values()) {
    if (b.geos.length < 2) {
      b.geos.forEach((g) => g.dispose());
      continue;
    }
    let i = 0;
    for (let m of b.geos) i += m.attributes.position.count;
    let pos = new Float32Array(i * 3), nor = new Float32Array(i * 3), uv = new Float32Array(i * 2), o = 0;
    for (let m of b.geos) pos.set(m.attributes.position.array, o * 3), nor.set(m.attributes.normal.array, o * 3), uv.set(m.attributes.uv.array, o * 2), o += m.attributes.position.count, m.dispose();
    let merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(pos, 3)), merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3)), merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2)), merged.computeBoundingSphere();
    let mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast, mesh.receiveShadow = b.receive, mesh.userData.batched = true, root.add(mesh);
    for (let v of victims) v.material === b.mat && v.castShadow === b.cast && v.receiveShadow === b.receive && (v.userData.merged = true);
  }
  for (let n of victims) n.userData.merged && n.removeFromParent();
}
var matCache = /* @__PURE__ */ new Map();
function mat(color, rough = 0.85, metal = 0) {
  let key = `${color}|${rough}|${metal}`, m = matCache.get(key);
  return m || (m = new THREE2.MeshStandardMaterial({ color, roughness: rough, metalness: metal }), matCache.set(key, m)), m;
}
var torsoProfile = [
  [0, 0],
  [0.155, 0],
  [0.15, 0.06],
  [0.135, 0.17],
  [0.15, 0.27],
  [0.172, 0.36],
  [0.182, 0.42],
  [0.165, 0.47],
  [0.1, 0.505],
  [0, 0.515]
].map(([r, y]) => new THREE2.Vector2(r, y)), skirtProfile = [[0, -0.42], [0.25, -0.42], [0.2, -0.2], [0.16, 0]].map(([r, y]) => new THREE2.Vector2(r, y)), N = {
  torso: new THREE2.LatheGeometry(torsoProfile, 20).scale(1, 1, 0.66),
  pelvis: new THREE2.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65).scale(1, 0.9, 0.7),
  skirt: new THREE2.LatheGeometry(skirtProfile, 20).scale(1, 1, 0.75),
  thigh: new THREE2.CapsuleGeometry(0.068, 0.34, 4, 12).translate(0, -0.21, 0),
  shin: new THREE2.CapsuleGeometry(0.052, 0.36, 4, 12).translate(0, -0.215, 0),
  shoe: new THREE2.BoxGeometry(0.095, 0.075, 0.25).translate(0, -0.468, 0.045),
  upperArm: new THREE2.CapsuleGeometry(0.047, 0.22, 4, 10).translate(0, -0.15, 0),
  forearm: new THREE2.CapsuleGeometry(0.04, 0.2, 4, 10).translate(0, -0.135, 0),
  hand: new THREE2.SphereGeometry(0.044, 10, 8).scale(0.8, 1.15, 0.55).translate(0, -0.3, 0),
  neck: new THREE2.CylinderGeometry(0.048, 0.055, 0.12, 12),
  head: new THREE2.SphereGeometry(0.11, 28, 22).scale(0.9, 1.12, 1),
  jaw: new THREE2.SphereGeometry(0.085, 18, 12).scale(0.95, 0.75, 1),
  sclera: new THREE2.SphereGeometry(0.0155, 12, 8).scale(1.25, 0.9, 0.6),
  iris: new THREE2.SphereGeometry(85e-4, 10, 8),
  brow: new THREE2.BoxGeometry(0.036, 8e-3, 0.01),
  nose: new THREE2.ConeGeometry(0.014, 0.036, 8).rotateX(-0.25),
  lip: new THREE2.CapsuleGeometry(55e-4, 0.03, 3, 6).rotateZ(Math.PI / 2),
  ear: new THREE2.SphereGeometry(0.02, 8, 6).scale(0.5, 1.2, 0.85),
  hairCap: new THREE2.SphereGeometry(0.118, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.93, 1.12, 1.04),
  hairBack: new THREE2.SphereGeometry(0.117, 22, 12, Math.PI * 1.05, Math.PI * 0.9, Math.PI * 0.3, Math.PI * 0.4).scale(0.93, 1.12, 1.04),
  afro: new THREE2.IcosahedronGeometry(0.14, 3),
  bun: new THREE2.SphereGeometry(0.048, 14, 10),
  longBack: new THREE2.CylinderGeometry(0.112, 0.125, 0.3, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8),
  pony: new THREE2.CapsuleGeometry(0.03, 0.18, 4, 8),
  capTop: new THREE2.SphereGeometry(0.122, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42).scale(0.95, 1.05, 1.05),
  capBrim: new THREE2.CylinderGeometry(0.095, 0.095, 0.012, 18, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.15),
  hardhat: new THREE2.SphereGeometry(0.135, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hatBrim: new THREE2.CylinderGeometry(0.16, 0.16, 0.014, 22),
  lens: new THREE2.TorusGeometry(0.021, 35e-4, 6, 18),
  bridge: new THREE2.BoxGeometry(0.022, 4e-3, 4e-3),
  apron: new THREE2.PlaneGeometry(0.3, 0.6),
  tie: new THREE2.BoxGeometry(0.045, 0.3, 0.01),
  collar: new THREE2.TorusGeometry(0.06, 0.016, 6, 16).rotateX(Math.PI / 2).scale(1, 1, 0.8),
  clip: new THREE2.BoxGeometry(0.17, 0.23, 0.012),
  phone: new THREE2.BoxGeometry(0.035, 0.07, 8e-3),
  brooch: new THREE2.SphereGeometry(0.014, 8, 6),
  belt: new THREE2.TorusGeometry(0.15, 0.012, 4, 22).rotateX(Math.PI / 2).scale(1, 1, 0.68)
};
function shade(hex, k) {
  let c2 = new THREE2.Color(hex);
  return c2.multiplyScalar(k), `#${c2.getHexString()}`;
}
var idSeq = 0, _Person = class qo {
  constructor(look, opts = {}) {
    this.id = ++idSeq, this.root = new THREE2.Group(), this.body = new THREE2.Group(), this.hip = new THREE2.Group(), this.torso = new THREE2.Group(), this.head = new THREE2.Group(), this.speed = 1.35, this.heading = 0, this.targetHeading = 0, this.path = [], this.onArrive = null, this.phase = Math.random() * 10, this.t = Math.random() * 10, this.gesture = "none", this.sitting = false, this.sitHeight = 0.47, this.moving = false, this.radius = 0.28, this.lookTarget = null, this.userData = {}, this.look = look;
    let top = mat(look.clothes, 0.88), pants = mat(look.pants ?? shade(look.clothes, 0.42), 0.9), skin = new THREE2.MeshStandardMaterial({ color: look.skin, roughness: 0.55 }), hair = mat(look.hairColor, 0.7), shoe = mat(look.shoes ?? "#24201d", 0.55), build = look.build ?? 1, add = (parent, o) => (parent.add(o), o), mesh = (g, m, shadow = true) => {
      let x = new THREE2.Mesh(g, m);
      return x.castShadow = shadow, x;
    };
    this.root.add(this.body), this.hip.position.y = qo.HIP, this.body.add(this.hip);
    let pel = add(this.hip, mesh(N.pelvis, look.bottom === "skirt" ? top : pants));
    pel.position.y = 0.02, pel.scale.x = build, look.bottom === "skirt" ? add(this.hip, mesh(N.skirt, top)).position.y = 0.03 : add(this.hip, mesh(N.belt, mat("#2a2522", 0.5), false)).position.y = 0.06;
    let leg = (x) => {
      let thigh = new THREE2.Group();
      thigh.position.set(x * build, 0, 0), this.hip.add(thigh), thigh.add(mesh(N.thigh, look.bottom === "skirt" ? skin : pants));
      let shin = new THREE2.Group();
      return shin.position.y = -0.42, thigh.add(shin), shin.add(mesh(N.shin, look.bottom === "skirt" ? skin : pants)), shin.add(mesh(N.shoe, shoe)), [thigh, shin];
    };
    [this.thighL, this.shinL] = leg(0.088), [this.thighR, this.shinR] = leg(-0.088), this.torso.position.y = 0.04, this.hip.add(this.torso);
    let t = add(this.torso, mesh(N.torso, top));
    t.scale.x = build;
    let neck = add(this.torso, mesh(N.neck, skin));
    neck.position.y = 0.55;
    let arm = (x) => {
      let sh = new THREE2.Group();
      sh.position.set(x * build, 0.45, 0), sh.rotation.z = x > 0 ? 0.08 : -0.08, this.torso.add(sh), sh.add(mesh(N.upperArm, top));
      let el = new THREE2.Group();
      return el.position.y = -0.3, sh.add(el), el.add(mesh(N.forearm, look.sleeves === "short" ? skin : top)), el.add(mesh(N.hand, skin)), [sh, el];
    };
    [this.armL, this.elbowL] = arm(0.205), [this.armR, this.elbowR] = arm(-0.205), this.head.position.y = 0.66, this.torso.add(this.head), this.head.add(mesh(N.head, skin)), add(this.head, mesh(N.jaw, skin)).position.set(0, -0.05, 0.012);
    let white = mat("#f4f1ea", 0.35), iris = mat("#2a1d16", 0.3);
    for (let sx of [-1, 1]) {
      add(this.head, mesh(N.sclera, white, false)).position.set(sx * 0.037, 0.012, 0.093), add(this.head, mesh(N.iris, iris, false)).position.set(sx * 0.037, 0.012, 0.102);
      let b = add(this.head, mesh(N.brow, hair, false));
      b.position.set(sx * 0.038, 0.04, 0.1), b.rotation.z = sx * -0.12, add(this.head, mesh(N.ear, skin, false)).position.set(sx * 0.1, 0, 0);
    }
    add(this.head, mesh(N.nose, mat(shade(look.skin, 0.93), 0.55), false)).position.set(0, -0.012, 0.112), add(this.head, mesh(N.lip, mat(shade(look.skin, 0.68), 0.5), false)).position.set(0, -0.056, 0.093), this.buildHair(hair), this.buildAccessory(), batch(this.head), this.hit = new THREE2.Mesh(new THREE2.CylinderGeometry(0.42, 0.42, 1.85, 8), new THREE2.MeshBasicMaterial({ visible: false })), this.hit.position.y = 0.92, this.hit.userData.person = this, this.root.userData.person = this, this.root.add(this.hit), this.scale = opts.scale ?? look.height ?? 1, this.root.scale.setScalar(this.scale);
  }
  buildHair(hair) {
    let style = this.look.hair, h = this.head, add = (g, m, x = 0, y = 0, z = 0) => {
      let mesh = new THREE2.Mesh(g, m);
      return mesh.position.set(x, y, z), mesh.castShadow = true, h.add(mesh), mesh;
    };
    if (style === "bald") return;
    if (style === "cap") {
      let capM = mat(this.look.capColor ?? shade(this.look.clothes, 0.75), 0.75);
      add(N.hairBack, hair, 0, -5e-3, -4e-3);
      let top = add(N.capTop, capM, 0, 0.012, -4e-3);
      top.rotation.x = -0.1;
      let brim = add(N.capBrim, capM, 0, 0.045, 0.1);
      brim.rotation.x = 0.1;
      return;
    }
    if (style === "curly") {
      add(N.afro, hair, 0, 0.04, -0.018).scale.set(0.93, 0.86, 0.9);
      return;
    }
    let cap = add(N.hairCap, hair, 0, 4e-3, -6e-3);
    if (cap.rotation.x = -0.32, add(N.hairBack, hair), style === "bun") add(N.bun, hair, 0, 0.1, -0.09);
    else if (style === "long") add(N.longBack, hair, 0, -0.1, -4e-3).scale.set(0.95, 1, 0.95);
    else if (style === "ponytail") {
      let p = add(N.pony, hair, 0, -0.04, -0.13);
      p.rotation.x = 0.3, add(N.bun, hair, 0, 0.02, -0.112).scale.setScalar(0.6);
    }
  }
  buildAccessory() {
    let acc = this.look.accessory;
    if (acc) {
      if (acc === "glasses") {
        let m = mat("#26262b", 0.35, 0.4);
        for (let sx of [-1, 1]) {
          let l = new THREE2.Mesh(N.lens, m);
          l.position.set(sx * 0.037, 0.013, 0.108), this.head.add(l);
        }
        let b = new THREE2.Mesh(N.bridge, m);
        b.position.set(0, 0.015, 0.112), this.head.add(b);
      } else if (acc === "hardhat") {
        let o = mat("#f2b632", 0.45), hh = new THREE2.Mesh(N.hardhat, o);
        hh.position.y = 0.025, hh.castShadow = true, this.head.add(hh);
        let br = new THREE2.Mesh(N.hatBrim, o);
        br.position.set(0, 0.03, 0.01), this.head.add(br);
      } else if (acc === "apron") {
        let ap = new THREE2.Mesh(N.apron, new THREE2.MeshStandardMaterial({ color: "#f1ede4", roughness: 0.95, side: THREE2.DoubleSide }));
        ap.position.set(0, 0.2, 0.118), ap.rotation.x = -0.08, this.torso.add(ap);
      } else if (acc === "tie") {
        let tie = new THREE2.Mesh(N.tie, mat("#8f2732", 0.55));
        tie.position.set(0, 0.36, 0.123), tie.rotation.x = -0.12, this.torso.add(tie);
        let col = new THREE2.Mesh(N.collar, mat("#f2f0ea", 0.7));
        col.position.set(0, 0.5, 5e-3), this.torso.add(col);
      } else if (acc === "clipboard") {
        let c2 = new THREE2.Mesh(N.clip, mat("#9a7448", 0.65));
        c2.position.set(0, -0.3, 0.06), c2.rotation.x = -0.4, this.elbowR.add(c2), this.armR.userData.hold = -0.4, this.elbowR.userData.hold = -1.1;
      } else if (acc === "phone") {
        let p = new THREE2.Mesh(N.phone, mat("#18181c", 0.25, 0.3));
        p.position.set(0, -0.31, 0.03), p.rotation.x = -0.4, this.elbowR.add(p), this.armR.userData.hold = -0.25, this.elbowR.userData.hold = -1.5;
      } else if (acc === "brooch" || acc === "scissorsPin") {
        let o = new THREE2.Mesh(N.brooch, mat(acc === "brooch" ? "#d9b44a" : "#c9cdd2", 0.3, 0.8));
        o.position.set(0.075, 0.4, 0.105), this.torso.add(o);
      }
    }
  }
  get x() {
    return this.root.position.x;
  }
  get z() {
    return this.root.position.z;
  }
  get eyeHeight() {
    return (qo.HIP + 0.04 + 0.66 + 0.012) * this.scale + this.root.position.y + this.body.position.y * this.scale;
  }
  setVisible(v) {
    this.body.visible = v;
  }
  place(x, z, heading = this.heading) {
    this.root.position.set(x, this.root.position.y, z), this.heading = this.targetHeading = heading, this.root.rotation.y = heading;
  }
  face(x, z) {
    let dx = x - this.x, dz = z - this.z;
    dx * dx + dz * dz > 1e-4 && (this.targetHeading = Math.atan2(dx, dz));
  }
  faceHeading(h) {
    this.targetHeading = h;
  }
  setHeading(h) {
    this.heading = this.targetHeading = h, this.root.rotation.y = h;
  }
  walkTo(path2, onArrive = null) {
    this.sitting = false, this.path = path2 ? [...path2] : [], this.onArrive = onArrive, !this.path.length && onArrive && (this.onArrive = null, onArrive());
  }
  stop() {
    this.path = [], this.onArrive = null;
  }
  sit(heading) {
    this.stop(), this.sitting = true, this.faceHeading(heading), this.heading = heading;
  }
  update(dt, groundY2, boxes) {
    let moved = 0;
    if (this.path.length && !this.sitting) {
      let wp = this.path[0], dx = wp.x - this.x, dz = wp.z - this.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= Math.max(step, 0.06)) {
        if (this.root.position.x = wp.x, this.root.position.z = wp.z, this.path.shift(), moved = d, !this.path.length) {
          let cb = this.onArrive;
          this.onArrive = null, cb?.();
        }
      } else this.root.position.x += dx / d * step, this.root.position.z += dz / d * step, this.targetHeading = Math.atan2(dx, dz), moved = step;
      if (boxes) {
        let p = { x: this.root.position.x, z: this.root.position.z };
        collide(p, this.radius, boxes), this.root.position.x = p.x, this.root.position.z = p.z;
      }
    }
    this.animate(dt, moved / Math.max(dt, 1e-4), groundY2);
  }
  animate(dt, speed, groundY2) {
    this.t += dt, this.moving = speed > 0.15;
    let dh = this.targetHeading - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh)), this.heading += dh * Math.min(1, dt * 9), this.root.rotation.y = this.heading;
    let gy = groundY2(this.x, this.z);
    this.root.position.y += (gy - this.root.position.y) * Math.min(1, dt * 12);
    let k = Math.min(1, dt * 10), ease = (o, v, axis = "x") => {
      o.rotation[axis] += (v - o.rotation[axis]) * k;
    }, holdA = this.armR.userData.hold ?? 0, holdE = this.elbowR.userData.hold ?? 0;
    if (this.sitting) this.body.position.y += (this.sitHeight + 0.07 - qo.HIP - this.body.position.y) * k, ease(this.thighL, -1.5), ease(this.thighR, -1.5), ease(this.shinL, 1.45), ease(this.shinR, 1.45), ease(this.armL, -0.35), ease(this.elbowL, -0.9), ease(this.armR, holdA || -0.35), ease(this.elbowR, holdE || -0.9), ease(this.torso, 0.04), ease(this.torso, 0, "y"), this.torso.position.y = 0.04 + Math.sin(this.t * 1.8) * 3e-3;
    else if (this.moving) {
      let run = speed > 3;
      this.phase += dt * speed * (run ? 2.4 : 3.6);
      let p = this.phase, A = run ? 0.75 : Math.min(0.5, 0.22 + speed * 0.18), K2 = run ? 1.5 : 0.75;
      this.thighL.rotation.x = -A * Math.sin(p), this.thighR.rotation.x = A * Math.sin(p), this.shinL.rotation.x = 0.05 + K2 * Math.max(0, Math.cos(p)) * (run ? 1 : 0.9), this.shinR.rotation.x = 0.05 + K2 * Math.max(0, -Math.cos(p)) * (run ? 1 : 0.9);
      let armA = run ? 0.9 : A * 0.75;
      this.armL.rotation.x = armA * Math.sin(p), this.elbowL.rotation.x = run ? -1.4 : -0.25 - 0.25 * Math.max(0, -Math.sin(p)), this.armR.rotation.x = holdA || -armA * Math.sin(p), this.elbowR.rotation.x = holdE || (run ? -1.4 : -0.25 - 0.25 * Math.max(0, Math.sin(p))), this.body.position.y = -0.025 + Math.abs(Math.cos(p)) * (run ? 0.06 : 0.03), this.torso.rotation.y = Math.sin(p) * (run ? 0.14 : 0.07), this.torso.rotation.x = run ? 0.18 : 0.03, this.hip.rotation.y = -Math.sin(p) * 0.06;
    } else {
      let sway = Math.sin(this.t * 0.9);
      ease(this.thighL, 0.02 + sway * 0.02), ease(this.thighR, -0.02 + sway * 0.02), ease(this.shinL, 0.04), ease(this.shinR, 0.06), ease(this.hip, 0, "y"), ease(this.torso, 0), ease(this.torso, 0, "y"), this.body.position.y += (0 - this.body.position.y) * k, this.torso.position.y = 0.04 + Math.sin(this.t * 1.8) * 4e-3, this.gesture === "none" && (ease(this.armL, Math.sin(this.t * 1.1) * 0.03), ease(this.elbowL, -0.12), ease(this.armR, holdA || -Math.sin(this.t * 1.1) * 0.03), ease(this.elbowR, holdE || -0.12), this.armR.rotation.z += (-0.08 - this.armR.rotation.z) * k);
    }
    this.gesture === "talk" && !this.moving ? (ease(this.elbowR, -0.9 + Math.sin(this.t * 4) * 0.25), ease(this.armR, -0.25 + Math.sin(this.t * 2.3) * 0.1), this.head.rotation.x = Math.sin(this.t * 7) * 0.04) : this.gesture === "work" ? (ease(this.armL, -0.7 + Math.sin(this.t * 10) * 0.15), ease(this.elbowL, -0.9), ease(this.armR, -0.7 - Math.sin(this.t * 10) * 0.15), ease(this.elbowR, -0.9), this.head.rotation.x = 0.3) : this.gesture === "wave" ? (ease(this.armR, -2.7), this.armR.rotation.z = -0.2 + Math.sin(this.t * 9) * 0.3, ease(this.elbowR, -0.4)) : this.head.rotation.x += (0 - this.head.rotation.x) * k;
    let want = 0;
    if (this.lookTarget) {
      let dx = this.lookTarget.x - this.x, dz = this.lookTarget.z - this.z, rel = Math.atan2(dx, dz) - this.heading;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel)), Math.abs(rel) < 1.6 && (want = Math.max(-0.9, Math.min(0.9, rel)));
    }
    this.head.rotation.y += (want - this.head.rotation.y) * Math.min(1, dt * 6);
  }
  talk() {
    this.gesture = "talk";
  }
  quiet() {
    this.gesture = "none";
  }
  work() {
    this.gesture = "work";
  }
  wave() {
    this.gesture = "wave";
  }
  rest() {
    this.gesture = "none", this.armR.rotation.z = -0.08;
  }
  dispose() {
    this.root.removeFromParent();
  }
};
_Person.HIP = 0.93;
var Person = _Person, SKINS = ["#f6d5b8", "#ecc19c", "#dca37a", "#c68863", "#a86a45", "#8d5a3b", "#6e4632", "#4f3122"], HAIRS = [
  "#14100e",
  "#2b2320",
  "#4a3122",
  "#6d4a2b",
  "#a9713d",
  "#d1a866",
  "#8a8a8a",
  "#dedad2",
  "#7a2f22"
], OUTFITS = [
  "#3b5f8c",
  "#9b3d3d",
  "#3f7a5a",
  "#c48a2f",
  "#6b4f8f",
  "#2f6f7a",
  "#c25f7a",
  "#5c6670",
  "#d1c4a8",
  "#36404d",
  "#b9572f",
  "#7d8f45",
  "#f1efe8",
  "#1f2328"
], PANTS = ["#2d3440", "#3a3a3e", "#4b3d31", "#2c3e5c", "#5a5550", "#1f2328", "#6b6458", "#8a7b62"], STYLES = ["short", "curly", "bun", "long", "cap", "bald", "ponytail"];
function randomLook(rand = Math.random) {
  let pick2 = (a) => a[Math.floor(rand() * a.length)], hair = pick2([...STYLES, "short", "long"]), acc = rand() < 0.14 ? "glasses" : rand() < 0.07 ? "phone" : void 0;
  return {
    skin: pick2(SKINS),
    hair,
    hairColor: pick2(HAIRS),
    clothes: pick2(OUTFITS),
    pants: pick2(PANTS),
    accessory: acc,
    sleeves: rand() < 0.4 ? "short" : "long",
    bottom: (hair === "long" || hair === "bun" || hair === "ponytail") && rand() < 0.35 ? "skirt" : "pants",
    build: 0.92 + rand() * 0.2,
    height: 0.93 + rand() * 0.13
  };
}
import * as THREE5 from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
import * as THREE3 from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
var glassMat = new THREE3.MeshStandardMaterial({ color: "#1d2730", roughness: 0.08, metalness: 0.6 }), tireMat = new THREE3.MeshStandardMaterial({ color: "#161616", roughness: 0.9 }), rimMat = new THREE3.MeshStandardMaterial({ color: "#b9bec4", roughness: 0.3, metalness: 0.9 }), trimMat = new THREE3.MeshStandardMaterial({ color: "#1b1d20", roughness: 0.6 }), tire = new THREE3.CylinderGeometry(0.33, 0.33, 0.22, 20).rotateX(Math.PI / 2), rim = new THREE3.CylinderGeometry(0.2, 0.2, 0.23, 14).rotateX(Math.PI / 2);
function profile(points) {
  let s = new THREE3.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let p of points.slice(1)) s.lineTo(p[0], p[1]);
  return s;
}
function extrude(points, width, bevel = 0.05) {
  let g = new THREE3.ExtrudeGeometry(profile(points), {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 4
  });
  return g.translate(0, 0, -(width - bevel * 2) / 2), g.computeVertexNormals(), g;
}
var BODY = {
  sedan: {
    len: 4.5,
    w: 1.78,
    lower: [
      [-2.25, 0.3],
      [2.2, 0.3],
      [2.28, 0.55],
      [2.15, 0.82],
      [1, 0.95],
      [-1.4, 0.98],
      [-2.2, 0.9],
      [-2.3, 0.6]
    ],
    cabin: [[-1.4, 0.95], [1.05, 0.95], [0.35, 1.42], [-0.85, 1.42], [-1.55, 1]],
    axle: 1.38
  },
  hatch: {
    len: 3.9,
    w: 1.72,
    lower: [
      [-1.9, 0.3],
      [1.95, 0.3],
      [2, 0.55],
      [1.85, 0.82],
      [0.85, 0.95],
      [-1.85, 0.98],
      [-1.98, 0.6]
    ],
    cabin: [[-1.85, 0.95], [0.9, 0.95], [0.2, 1.45], [-1.6, 1.45], [-1.92, 1.05]],
    axle: 1.2
  },
  suv: {
    len: 4.7,
    w: 1.9,
    lower: [
      [-2.3, 0.38],
      [2.3, 0.38],
      [2.36, 0.65],
      [2.2, 1],
      [1.1, 1.08],
      [-2.25, 1.1],
      [-2.36, 0.7]
    ],
    cabin: [[-2.2, 1.06], [1.15, 1.06], [0.5, 1.7], [-2.1, 1.72]],
    axle: 1.45
  }
};
function makeCar(e, kind = "sedan") {
  let o = new THREE3.Group(), paint = new THREE3.MeshStandardMaterial({ color: e, roughness: 0.28, metalness: 0.55 }), add = (geo, g, x = 0, y = 0, z = 0) => {
    let mesh = new THREE3.Mesh(geo, g);
    return mesh.position.set(x, y, z), mesh.castShadow = true, mesh.receiveShadow = true, o.add(mesh), mesh;
  }, lightsF = [], lightsR = [], head = new THREE3.MeshStandardMaterial({ color: "#fff6dc", emissive: "#ffe9b0", emissiveIntensity: 0.2, roughness: 0.2 }), tail = new THREE3.MeshStandardMaterial({ color: "#6a0f0f", emissive: "#ff2a1a", emissiveIntensity: 0.25, roughness: 0.3 });
  if (kind === "truck") {
    add(new THREE3.BoxGeometry(1.9, 1.5, 2.05), paint, 2.35, 1.25, 0), add(new THREE3.BoxGeometry(0.05, 0.7, 1.8), glassMat, 3.33, 1.6, 0), add(new THREE3.BoxGeometry(4.6, 2.5, 2.2), mat("#eeeeea", 0.6), -1.1, 1.85, 0), add(new THREE3.BoxGeometry(6.6, 0.25, 1.9), trimMat, 0.1, 0.55, 0);
    for (let x of [2.6, -0.4, -2.4]) for (let z of [0.86, -0.86]) add(tire, tireMat, x, 0.38, z).scale.setScalar(1.15), add(rim, rimMat, x, 0.38, z * 1.01);
    for (let f of [0.7, -0.7]) lightsF.push(add(new THREE3.BoxGeometry(0.05, 0.16, 0.3), head, 3.32, 0.85, f)), lightsR.push(add(new THREE3.BoxGeometry(0.05, 0.18, 0.2), tail, -3.42, 0.9, f));
    return { group: o, length: 6.8, lightsF, lightsR };
  }
  let b = BODY[kind];
  add(extrude(b.lower, b.w), paint), add(extrude(b.cabin, b.w - 0.16, 0.03), glassMat);
  let roofY = kind === "suv" ? 1.71 : kind === "hatch" ? 1.44 : 1.41;
  add(new THREE3.BoxGeometry(kind === "suv" ? 2.5 : kind === "hatch" ? 1.75 : 1.25, 0.05, b.w - 0.2), paint, kind === "suv" ? -0.8 : kind === "hatch" ? -0.72 : -0.25, roofY, 0), add(new THREE3.BoxGeometry(0.12, 0.06, b.w - 0.1), trimMat, b.len / 2 - 0.02, 0.45, 0), add(new THREE3.BoxGeometry(0.12, 0.06, b.w - 0.1), trimMat, -b.len / 2 + 0.02, 0.45, 0);
  for (let f of [b.axle, -b.axle]) for (let g of [b.w / 2 - 0.12, -b.w / 2 + 0.12]) add(tire, tireMat, f, 0.33, g), add(rim, rimMat, f, 0.33, g + Math.sign(g) * 0.01);
  for (let f of [b.w / 2 - 0.32, -b.w / 2 + 0.32]) lightsF.push(add(new THREE3.BoxGeometry(0.06, 0.12, 0.34), head, b.len / 2 + 0.02, 0.72, f)), lightsR.push(add(new THREE3.BoxGeometry(0.06, 0.12, 0.3), tail, -b.len / 2 - 0.02, 0.78, f));
  for (let f of [b.w / 2 + 0.06, -b.w / 2 - 0.06]) add(new THREE3.BoxGeometry(0.15, 0.1, 0.1), paint, kind === "suv" ? 1 : 0.95, 1.05, f);
  return { group: o, length: b.len, lightsF, lightsR };
}
var CAR_COLORS = [
  "#b8252b",
  "#1f4e8c",
  "#e9e7e1",
  "#1d1f22",
  "#8a9096",
  "#c9a24a",
  "#3f6b52",
  "#5a2a3a",
  "#d5d0c4",
  "#24364f"
];
import * as THREE4 from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
function canvas(w, h) {
  let c2 = document.createElement("canvas");
  return c2.width = w, c2.height = h, [c2, c2.getContext("2d")];
}
function tex(c2, repeat) {
  let t = new THREE4.CanvasTexture(c2);
  return t.colorSpace = THREE4.SRGBColorSpace, t.anisotropy = 4, repeat && (t.wrapS = t.wrapT = THREE4.RepeatWrapping, t.repeat.set(repeat[0], repeat[1])), t;
}
var DISPLAY = '"Bricolage Grotesque", "Arial Black", system-ui, sans-serif';
function signTexture(text, bg, fg, opts = {}) {
  let w = opts.w ?? 1024, h = opts.h ?? 192, [c2, g] = canvas(w, h);
  g.fillStyle = bg, g.fillRect(0, 0, w, h), g.strokeStyle = "rgba(255,255,255,0.18)", g.lineWidth = 8, g.strokeRect(12, 12, w - 24, h - 24), g.fillStyle = fg, g.textAlign = "center", g.textBaseline = "middle";
  let size = opts.sub ? h * 0.42 : h * 0.52;
  for (g.font = `800 ${size}px ${DISPLAY}`; g.measureText(text).width > w * 0.9 && size > 20; ) size -= 4, g.font = `800 ${size}px ${DISPLAY}`;
  return g.fillText(text, w / 2, opts.sub ? h * 0.42 : h * 0.53), opts.sub && (g.globalAlpha = 0.8, g.font = `600 ${h * 0.17}px ${DISPLAY}`, g.fillText(opts.sub.toUpperCase().split("").join(" "), w / 2, h * 0.78)), tex(c2);
}
function stripeTexture(e, b, stripes = 8) {
  let [c2, g] = canvas(256, 64), sw = 256 / stripes;
  for (let i = 0; i < stripes; i++) g.fillStyle = i % 2 ? b : e, g.fillRect(i * sw, 0, sw, 64);
  return g.fillStyle = "rgba(0,0,0,0.12)", g.fillRect(0, 52, 256, 12), tex(c2);
}
function menuBoardTexture(heading, lines, note, accent) {
  let [c2, s] = canvas(1024, 512);
  s.fillStyle = "#1f2522", s.fillRect(0, 0, 1024, 512), s.strokeStyle = "#8a6b45", s.lineWidth = 22, s.strokeRect(0, 0, 1024, 512), s.fillStyle = accent, s.font = `800 58px ${DISPLAY}`, s.textAlign = "center", s.fillText(heading.toUpperCase(), 1024 / 2, 86), s.font = `500 30px ${DISPLAY}`, s.textAlign = "left";
  let rows = lines.slice(0, 8), cols = rows.length > 4 ? 2 : 1, colW = 904 / cols;
  return rows.forEach((l, i) => {
    let col = cols === 2 ? Math.floor(i / Math.ceil(rows.length / 2)) : 0, row = cols === 2 ? i % Math.ceil(rows.length / 2) : i, x = 60 + col * colW, y = 160 + row * 64;
    s.fillStyle = "#f2efe6", s.fillText(l.name + (l.isNew ? " \u2605" : ""), x, y), s.textAlign = "right", s.fillStyle = accent, s.fillText(l.price, x + colW - 30, y), s.textAlign = "left", s.fillStyle = "rgba(242,239,230,0.25)", s.fillRect(x, y + 14, colW - 30, 2);
  }), s.fillStyle = "rgba(242,239,230,0.6)", s.font = `italic 500 26px ${DISPLAY}`, s.textAlign = "center", s.fillText(note, 1024 / 2, 476), tex(c2);
}
function paperTexture(text, sub) {
  let [c2, g] = canvas(256, 256);
  return g.fillStyle = "#f4efe1", g.fillRect(0, 0, 256, 256), g.fillStyle = "#b23a2e", g.textAlign = "center", g.font = `800 52px ${DISPLAY}`, g.fillText(text, 128, 110), g.fillStyle = "#333", g.font = `600 22px ${DISPLAY}`, g.fillText(sub, 128, 160), tex(c2);
}
function skyMaterial() {
  return new THREE4.ShaderMaterial({
    side: THREE4.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE4.Color("#6fa8dc") },
      bottom: { value: new THREE4.Color("#dfeaf0") },
      sunColor: { value: new THREE4.Color("#fff2d8") },
      sunDir: { value: new THREE4.Vector3(0.3, 0.6, 0.5).normalize() },
      cloudColor: { value: new THREE4.Color("#ffffff") },
      cloudShade: { value: new THREE4.Color("#b9c4d0") },
      time: { value: 0 },
      cover: { value: 0.45 }
    },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }",
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir;
      uniform vec3 cloudColor; uniform vec3 cloudShade; uniform float time; uniform float cover;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(bottom, top, pow(clamp(h*1.25+0.05, 0.0, 1.0), 0.7));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(sd, 6.0)*0.35 + pow(sd, 64.0)*0.6);
        col = mix(col, sunColor*1.6, smoothstep(0.9993, 0.9997, sd));
        if (d.y > 0.02) {
          vec2 uv = d.xz / (d.y + 0.12) * 1.4 + vec2(time*0.004, time*0.0015);
          float n = fbm(uv);
          float c = smoothstep(1.0 - cover, 1.0 - cover + 0.32, n);
          float shade = fbm(uv + 0.6);
          vec3 cc = mix(cloudColor, cloudShade, smoothstep(0.35, 0.8, shade));
          cc += sunColor * pow(sd, 8.0) * 0.4;
          col = mix(col, cc, c * smoothstep(0.02, 0.25, d.y) * 0.92);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
}
function seededRand(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = s * 1664525 + 1013904223 >>> 0, s / 4294967296);
}
function normalFrom(height, w, h, strength) {
  let [c2, s] = canvas(w, h), img = s.createImageData(w, h), H = (x, y) => height[(y + h) % h * w + (x + w) % w];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, c = Math.hypot(dx, dy, 1), v = (y * w + x) * 4;
    img.data[v] = (-dx / c * 0.5 + 0.5) * 255, img.data[v + 1] = (dy / c * 0.5 + 0.5) * 255, img.data[v + 2] = (1 / c * 0.5 + 0.5) * 255, img.data[v + 3] = 255;
  }
  s.putImageData(img, 0, 0);
  let t = new THREE4.CanvasTexture(c2);
  return t.colorSpace = THREE4.NoColorSpace, t.wrapS = t.wrapT = THREE4.RepeatWrapping, t.anisotropy = 4, t;
}
function surface(size, seed, strength, paint) {
  let [c2, s] = canvas(size, size), img = s.createImageData(size, size), height = new Float32Array(size * size), i = seededRand(seed);
  paint({
    rand: i,
    size,
    put: (x, y, rgb, ht) => {
    let i2 = y * size + x;
    img.data[i2 * 4] = rgb[0], img.data[i2 * 4 + 1] = rgb[1], img.data[i2 * 4 + 2] = rgb[2], img.data[i2 * 4 + 3] = 255, height[i2] = ht;
  }
  }), s.putImageData(img, 0, 0);
  let map = new THREE4.CanvasTexture(c2);
  return map.colorSpace = THREE4.SRGBColorSpace, map.wrapS = map.wrapT = THREE4.RepeatWrapping, map.anisotropy = 8, { map, normalMap: normalFrom(height, size, size, strength) };
}
var rgbOf = (hex) => {
  let c2 = new THREE4.Color(hex);
  return [c2.r * 255, c2.g * 255, c2.b * 255];
}, clamp255 = (v) => Math.max(0, Math.min(255, v)), jitter = (rgb, k, n) => [clamp255(rgb[0] * k + n), clamp255(rgb[1] * k + n), clamp255(rgb[2] * k + n)];
function vnoise(seed) {
  let t = seededRand(seed), N2 = 256, perm = new Float32Array(N2 * N2);
  for (let s = 0; s < perm.length; s++) perm[s] = t();
  let at = (x, y) => perm[(y & N2 - 1) * N2 + (x & N2 - 1)];
  return (x, y) => {
    let xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}
var cache = /* @__PURE__ */ new Map();
function cached(key, make) {
  let s = cache.get(key);
  return s || (s = make(), cache.set(key, s)), s;
}
function bricks(color) {
  return cached(`brick${color}`, () => surface(512, 11, 2.2, ({ put, rand, size }) => {
    let base = rgbOf(color), mortar = rgbOf("#cbc3b6"), bw = 64, bh = 24, i = 3, shades = [];
    for (let f = 0; f < 400; f++) shades.push(0.78 + rand() * 0.4);
    let n = vnoise(3);
    for (let y = 0; y < size; y++) {
      let row = Math.floor(y / bh), off = row % 2 * (bw / 2);
      for (let v = 0; v < size; v++) {
        let bx = Math.floor((v + off) / bw), inX = (v + off) % bw, inY = y % bh, isMortar = inX < i || inY < i, grain = n(v * 0.35, y * 0.35) * 26 - 13;
        if (isMortar) put(v, y, jitter(mortar, 0.92, grain * 0.6), 40 + grain);
        else {
          let k = shades[(row * 13 + bx * 7) % shades.length], edge = Math.min(inX - i, bw - inX, inY - i, bh - inY);
          put(v, y, jitter(base, k, grain), 170 + Math.min(edge, 4) * 12 + grain * 0.8);
        }
      }
    }
  }));
}
function stoneBlocks(color) {
  return cached(`stone${color}`, () => surface(512, 23, 1.6, ({ put, rand, size }) => {
    let base = rgbOf(color), s = vnoise(5), bw = 128, bh = 64, shades = [];
    for (let i = 0; i < 64; i++) shades.push(0.9 + rand() * 0.16);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let row = Math.floor(y / bh), off = row % 2 * (bw / 2), inX = (x + off) % bw, inY = y % bh, joint = inX < 3 || inY < 3, g = s(x * 0.08, y * 0.08) * 20 + s(x * 0.6, y * 0.6) * 10 - 15, k = shades[(row * 5 + Math.floor((x + off) / bw)) % shades.length];
      put(x, y, jitter(base, joint ? 0.72 : k, g), joint ? 30 : 180 + g);
    }
  }));
}
function concreteSlabs(color = "#c9c3b8") {
  return cached(`slab${color}`, () => surface(512, 31, 2.4, ({ put, size }) => {
    let base = rgbOf(color), a = vnoise(7), n2 = vnoise(8), tile = 256;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let jx = x % tile, jy = y % tile, joint = jx < 3 || jy < 3, stain = a(x * 0.012, y * 0.012), speck = n2(x * 0.9, y * 0.9), g = (stain - 0.5) * 22 + (speck - 0.5) * 8;
      put(x, y, jitter(base, joint ? 0.68 : 0.96 + (stain - 0.5) * 0.12, g), joint ? 20 : 150 + speck * 10);
    }
  }));
}
// The basketball court's painted surface (a texture, so it is one stable layer, not loose lines on asphalt).
// 80 px per metre; the canvas covers world x 12..26, z 31.6..44.4.
function courtTexture() {
  return cached("court", () => {
    const S = 80, W = 14 * S, H = 12.8 * S;
    const c = document.createElement("canvas");
    c.width = W, c.height = H;
    const g = c.getContext("2d");
    const X = (x) => (x - 12) * S, Z = (z) => (z - 31.6) * S;
    g.fillStyle = "#2f6f93", g.fillRect(0, 0, W, H);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // fixed seed: the speckle never changes
    for (let i = 0; i < 5200; i++) g.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "0,0,0"},${0.02 + rnd() * 0.04})`, g.fillRect(rnd() * W, rnd() * H, 2, 2);
    g.fillStyle = "#c4553d";
    for (const [z0, z1] of [[31.6, 35], [41, 44.4]]) g.fillRect(X(17.2), Z(z0), 3.6 * S, (z1 - z0) * S);
    g.strokeStyle = "#f4f2ea", g.fillStyle = "#f4f2ea", g.lineWidth = 7, g.lineJoin = "miter";
    g.strokeRect(X(12.1), Z(31.6), 13.8 * S, 12.8 * S);
    g.beginPath(), g.moveTo(X(12.1), Z(38)), g.lineTo(X(25.9), Z(38)), g.stroke();
    g.beginPath(), g.arc(X(19), Z(38), 0.9 * S, 0, Math.PI * 2), g.stroke();
    g.globalAlpha = 0.85, g.font = `bold ${0.5 * S}px sans-serif`, g.textAlign = "center", g.fillText("BIZ", X(19), Z(38) + 0.18 * S), g.globalAlpha = 1;
    const end = (north) => {
      g.save();
      if (!north) g.translate(0, Z(38) * 2), g.scale(1, -1);
      g.strokeRect(X(17.2), Z(31.6), 3.6 * S, 3.4 * S);
      g.beginPath(), g.arc(X(19), Z(35), 1.3 * S, 0, Math.PI), g.stroke();
      g.setLineDash([14, 14]), g.beginPath(), g.arc(X(19), Z(35), 1.3 * S, Math.PI, Math.PI * 2), g.stroke(), g.setLineDash([]);
      const dz = 31.6 - 32.5, dx = Math.sqrt(4.3 * 4.3 - dz * dz);
      g.beginPath(), g.arc(X(19), Z(32.5), 4.3 * S, Math.atan2(dz, dx), Math.PI - Math.atan2(dz, dx)), g.stroke();
      g.restore();
    };
    end(true), end(false);
    const t = new THREE5.CanvasTexture(c);
    return t.colorSpace = THREE5.SRGBColorSpace, t.anisotropy = 8, t;
  });
}
function asphalt() {
  return cached("asphalt", () => surface(512, 41, 1.6, ({ put, size }) => {
    let base = rgbOf("#3e4146"), A = vnoise(9), n2 = vnoise(10), n3 = vnoise(12);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let agg = n2(x * 1.3, y * 1.3), patch = A(x * 0.01, y * 0.01), crack = Math.abs(n3(x * 0.03, y * 0.03) - 0.5) < 6e-3 ? 1 : 0, g = (agg - 0.5) * 16 + (patch - 0.5) * 16 - crack * 20;
      put(x, y, jitter(base, 0.95, g), 120 + agg * 35 - crack * 60);
    }
  }));
}
function qs(color) {
  return cached(`planks${color}`, () => surface(512, 51, 1.8, ({ put, rand, size }) => {
    let base = rgbOf(color), s = vnoise(13), ph = 64, tones = [];
    for (let i = 0; i < 64; i++) tones.push(0.8 + rand() * 0.35);
    for (let y = 0; y < size; y++) {
      let row = Math.floor(y / ph), off = row * 197 % size;
      for (let x = 0; x < size; x++) {
        let seg = Math.floor((x + off) % size / 256), seam = y % ph < 2 || (x + off) % 256 < 2, grain = Math.sin((y + s(x * 0.02, y * 0.15) * 30) * 0.9) * 0.5 + 0.5, k = tones[(row * 3 + seg) % tones.length] * (0.9 + grain * 0.14);
        put(x, y, jitter(base, seam ? 0.55 : k, (s(x * 0.5, y * 0.5) - 0.5) * 10), seam ? 30 : 160 + grain * 25);
      }
    }
  }));
}
function mo(e, b, o = 8) {
  return cached(`tiles${e}${b}${o}`, () => surface(512, 61, 2, ({ put, size }) => {
    let A = rgbOf(e), B = rgbOf(b), grout = rgbOf("#b8b4ac"), s = size / o, nz = vnoise(15);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let ix = Math.floor(x / s), iy = Math.floor(y / s), gx = x % s, gy = y % s, g = gx < 2 || gy < 2, col = (ix + iy) % 2 ? A : B, v = (nz(x * 0.2, y * 0.2) - 0.5) * 10;
      put(x, y, g ? jitter(grout, 0.9, v) : jitter(col, 1, v), g ? 40 : 200 + v);
    }
  }));
}
function grass() {
  return cached("grass", () => surface(512, 71, 1.4, ({ put, size }) => {
    let o = vnoise(17), n2 = vnoise(18), n3 = vnoise(19), a = rgbOf("#6d8f4a"), b = rgbOf("#8aa85c"), d = rgbOf("#5b7a3c");
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let big = o(x * 0.015, y * 0.015), blade = n2(x * 1.6, y * 0.5), fine = n3(x * 3, y * 3), col = [0, 1, 2].map((k) => a[k] * (1 - big) + b[k] * big), mixd = blade > 0.7 ? d : col;
      put(x, y, jitter(mixd, 0.9 + fine * 0.2, 0), 100 + blade * 100 + fine * 30);
    }
  }));
}
function plaster(color) {
  return cached(`plaster${color}`, () => surface(256, 81, 1, ({ put, size }) => {
    let base = rgbOf(color), a = vnoise(21), n2 = vnoise(22);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = a(x * 0.05, y * 0.05) * 0.6 + n2(x * 0.5, y * 0.5) * 0.4;
      put(x, y, jitter(base, 0.95 + v * 0.08, 0), 120 + v * 60);
    }
  }));
}
function ll(color) {
  return cached(`carpet${color}`, () => surface(256, 91, 0.8, ({ put, size }) => {
    let base = rgbOf(color), a = vnoise(25);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = a(x * 1.5, y * 1.5);
      put(x, y, jitter(base, 0.9 + v * 0.2, 0), 120 + v * 80);
    }
  }));
}
function pbr(e, repeat, opts = {}) {
  let map = e.map.clone(), nm = e.normalMap.clone();
  for (let t of [map, nm]) t.repeat.set(repeat[0], repeat[1]), t.needsUpdate = true;
  let m = new THREE4.MeshStandardMaterial({
    color: opts.color ?? "#ffffff",
    map,
    normalMap: nm,
    roughness: opts.rough ?? 0.9,
    metalness: opts.metal ?? 0
  });
  return m.normalScale.set(opts.normal ?? 1, opts.normal ?? 1), m;
}
function uvBox(w, h, d, scale) {
  let g = new THREE5.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    let k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / scale, uv.getY(k) * dims[f][1] / scale);
  }
  return g;
}
var matCache2 = /* @__PURE__ */ new Map();
function cachedMat(key, make) {
  let m = matCache2.get(key);
  return m || (m = make(), matCache2.set(key, m)), m;
}
var j = {
  brick: (c2) => cachedMat(`b${c2}`, () => pbr(bricks(c2), [1, 1], { rough: 0.92, normal: 1.2 })),
  stone: (c2) => cachedMat(`s${c2}`, () => pbr(stoneBlocks(c2), [1, 1], { rough: 0.85 })),
  plaster: (c2) => cachedMat(`p${c2}`, () => pbr(plaster(c2), [1, 1], { rough: 0.95, normal: 0.3 })),
  slab: () => cachedMat("slab", () => pbr(concreteSlabs(), [1, 1], { rough: 0.95 })),
  asphalt: () => cachedMat("asph", () => pbr(asphalt(), [1, 1], { rough: 0.95, normal: 0.8 })),
  grass: () => cachedMat("grass", () => pbr(grass(), [1, 1], { rough: 1, normal: 0.7 })),
  iron: () => mat("#22262a", 0.55, 0.6),
  trim: (c2) => mat(c2, 0.6)
}, rt = { brick: 1.75, stone: 3.2, plaster: 2.2, slab: 3, asphalt: 7, grass: 5 }, ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
function local(w, x, z, facing) {
  let g = new THREE5.Group();
  return g.position.set(x, 0, z), g.rotation.y = ROT[facing], w.scene.add(g), g;
}
function Re(e, b) {
  let o = local(e, b.x, b.z, b.facing), floorH = 3.1, groundH = b.groundH ?? 4, height = groundH + (b.floors - 1) * floorH, wallMat = b.wall === "brick" ? j.brick(b.color) : b.wall === "stone" ? j.stone(b.color) : j.plaster(b.color), scale = b.wall === "brick" ? rt.brick : b.wall === "stone" ? rt.stone : rt.plaster, trim = j.trim(b.trim ?? "#e9e3d6"), body = new THREE5.Mesh(uvBox(b.width, height, b.depth, scale), wallMat);
  body.position.set(0, height / 2, -b.depth / 2), body.castShadow = body.receiveShadow = true, o.add(body);
  let c2 = Math.cos(ROT[b.facing]), s = Math.sin(ROT[b.facing]), corners = [[-b.width / 2, 0], [b.width / 2, 0], [-b.width / 2, -b.depth], [b.width / 2, -b.depth]].map(([lx, lz]) => [b.x + lx * c2 + lz * s, b.z - lx * s + lz * c2]), xs = corners.map((p) => p[0]), zs = corners.map((p) => p[1]);
  e.collider(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)), e.mapRects.push({
    x0: Math.min(...xs),
    z0: Math.min(...zs),
    x1: Math.max(...xs),
    z1: Math.max(...zs),
    kind: "building",
    label: b.label
  }), e.occluders.push({
    x0: Math.min(...xs),
    z0: Math.min(...zs),
    x1: Math.max(...xs),
    z1: Math.max(...zs),
    h: height + 0.6
  });
  let bays = b.bays ?? Math.max(2, Math.round(b.width / 2.8)), bayW = b.width / bays;
  for (let f = 1; f < b.floors; f++) {
    let y = groundH + (f - 1) * floorH + 0.75;
    for (let i = 0; i < bays; i++) {
      let C = -b.width / 2 + bayW * (i + 0.5), lit = (i * 7 + f * 3 + Math.round(b.x)) % 5 < 2, ww = Math.min(1.3, bayW * 0.55), wh = 1.65;
      e.box(ww, wh, 0.04, lit ? e.windowLit : e.windowDark, C, y, 0.01, o, false), e.box(ww + 0.16, 0.08, 0.1, trim, C, y + wh, 0.04, o, false), e.box(ww + 0.22, 0.07, 0.16, trim, C, y - 0.07, 0.06, o, false), e.box(0.07, wh, 0.08, trim, C - ww / 2 - 0.03, y, 0.03, o, false), e.box(0.07, wh, 0.08, trim, C + ww / 2 + 0.03, y, 0.03, o, false), e.box(ww, 0.05, 0.05, trim, C, y + wh * 0.55, 0.03, o, false), b.wall === "brick" && e.box(ww + 0.3, 0.18, 0.06, j.trim("#cfc5b4"), C, y + wh + 0.08, 0.02, o, false);
    }
    b.wall !== "plaster" && e.box(b.width, 0.12, 0.08, trim, 0, groundH + (f - 1) * floorH, 0.03, o, false);
  }
  if (b.cornice !== false) {
    e.box(b.width + 0.4, 0.32, 0.5, trim, 0, height - 0.32, 0.12, o), e.box(b.width + 0.25, 0.14, 0.3, trim, 0, height - 0.5, 0.06, o, false);
    for (let h = -b.width / 2 + 0.3; h <= b.width / 2 - 0.2; h += 0.55) e.box(0.12, 0.2, 0.22, trim, h, height - 0.56, 0.12, o, false);
  }
  if (e.box(b.width, 0.6, 0.18, wallMat, 0, height, -0.09, o), e.box(b.width, 0.6, 0.18, wallMat, 0, height, -b.depth + 0.09, o), e.box(0.18, 0.6, b.depth, wallMat, -b.width / 2 + 0.09, height, -b.depth / 2, o), e.box(0.18, 0.6, b.depth, wallMat, b.width / 2 - 0.09, height, -b.depth / 2, o), e.box(b.width - 0.3, 0.05, b.depth - 0.3, mat("#5d5a55", 0.95), 0, height, -b.depth / 2, o, false), e.box(1.6, 0.9, 1.1, mat("#a7abae", 0.45, 0.5), -b.width / 4, height, -b.depth * 0.6, o), b.waterTower) {
    let tw = new THREE5.Group();
    tw.position.set(b.width / 4, height, -b.depth * 0.5), o.add(tw);
    let wood = mat("#6e5038", 0.85);
    for (let [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) e.box(0.12, 2.4, 0.12, j.iron(), lx, 0, lz, tw, false);
    e.cyl(1.25, 1.25, 2.6, wood, 0, 2.4, 0, tw, 18);
    let roofCone = new THREE5.Mesh(new THREE5.ConeGeometry(1.4, 1, 18), mat("#4a3a2c", 0.8));
    roofCone.position.y = 5.5, roofCone.castShadow = true, tw.add(roofCone);
  }
  if (b.storefront !== false) {
    let sf2 = b.storefront ?? {}, glassH = groundH - 1.5;
    e.box(b.width - 0.6, 0.45, 0.14, trim, 0, 0, 0.04, o), e.box(b.width - 0.8, glassH, 0.04, sf2.dark ? e.windowDark : e.shopGlassOut, 0, 0.45, 0.02, o, false);
    for (let B = -b.width / 2 + 0.3; B <= b.width / 2 - 0.29; B += (b.width - 0.6) / Math.max(2, Math.round(b.width / 2.2))) e.box(0.09, glassH + 0.05, 0.1, trim, B, 0.45, 0.06, o, false);
    if (e.box(b.width - 0.4, 0.12, 0.14, trim, 0, 0.45 + glassH, 0.06, o, false), e.box(b.width - 0.2, 0.9, 0.12, j.trim(b.trim ?? "#2b2a28"), 0, groundH - 0.95, 0.07, o), sf2.sign) {
      let sign = new THREE5.Mesh(new THREE5.PlaneGeometry(Math.min(b.width - 1.2, 8.5), 0.62), new THREE5.MeshStandardMaterial({
        map: sf2.sign,
        roughness: 0.55,
        emissive: "#ffffff",
        emissiveMap: sf2.sign,
        emissiveIntensity: 0
      }));
      sign.position.set(0, groundH - 0.5, 0.14), o.add(sign), e.signMats.push(sign.material);
    }
    if (sf2.door !== void 0 && (e.box(1.3, 2.4, 0.06, mat("#2a2522", 0.5), sf2.door, 0, 0.05, o, false), e.box(1, 1.6, 0.02, e.windowDark, sf2.door, 0.55, 0.09, o, false)), sf2.awning) {
      let awn = new THREE5.MeshStandardMaterial({ map: stripeTexture(sf2.awning, "#f3efe6", 12), roughness: 0.9, side: THREE5.DoubleSide }), a = new THREE5.Mesh(new THREE5.PlaneGeometry(b.width - 1, 1.3), awn);
      a.position.set(0, groundH - 1.55, 0.62), a.rotation.x = -Math.PI / 2 + 0.55, a.castShadow = true, o.add(a);
    }
  } else for (let h = 0; h < bays; h++) {
    let w = -b.width / 2 + bayW * (h + 0.5);
    e.box(Math.min(1.3, bayW * 0.55), 1.6, 0.04, e.windowDark, w, 1.1, 0.01, o, false), e.box(Math.min(1.3, bayW * 0.55) + 0.2, 0.07, 0.16, trim, w, 1.03, 0.06, o, false);
  }
  if (b.stoop) {
    let st = j.stone("#b8ad99");
    for (let k = 0; k < 4; k++) e.box(1.8, 0.18 * (k + 1), 0.32, st, 0, 0, 0.16 + (3 - k) * 0.32, o);
    e.box(1.4, 2.5, 0.08, mat("#3a2a20", 0.55), 0, 0.72, 0.02, o, false), e.box(0.05, 0.9, 1.3, j.iron(), -0.9, 0.72, 0.7, o, false), e.box(0.05, 0.9, 1.3, j.iron(), 0.9, 0.72, 0.7, o, false);
  }
  if (b.fireEscape && b.floors > 2) {
    let iron = j.iron(), fx = -b.width / 2 + bayW * 1;
    for (let B = 1; B < b.floors; B++) {
      let C = groundH + (B - 1) * floorH - 0.05;
      e.box(bayW * 1.6, 0.06, 1, iron, fx, C, 0.55, o, false), e.box(bayW * 1.6, 0.04, 0.04, iron, fx, C + 0.95, 1.03, o, false);
      for (let px = -bayW * 0.8; px <= bayW * 0.8; px += 0.35) e.box(0.025, 0.95, 0.025, iron, fx + px, C, 1.03, o, false);
      if (B < b.floors - 1) {
        let stair = e.box(0.6, 0.05, Math.hypot(floorH, bayW * 1.2), iron, fx, C + floorH / 2, 0.55, o, false);
        stair.rotation.set(0, Math.PI / 2, 0), stair.rotation.z = Math.atan2(floorH, bayW * 1.2), stair.position.y = C + floorH / 2;
      }
    }
  }
  return { group: o, height };
}
function Ot(w, x, z, A = 1, pit = true) {
  let trunk = mat("#5a4332", 0.95);
  w.cyl(0.1 * A, 0.17 * A, 2.6 * A, trunk, x, 0, z, w.scene, 9);
  let br = w.cyl(0.05 * A, 0.08 * A, 1.4 * A, trunk, x + 0.35 * A, 1.9 * A, z, w.scene, 7);
  br.rotation.z = -0.6;
  let br2 = w.cyl(0.05 * A, 0.08 * A, 1.2 * A, trunk, x - 0.3 * A, 2.1 * A, z + 0.2 * A, w.scene, 7);
  br2.rotation.z = 0.7;
  let seed = Math.abs(Math.round(x * 13 + z * 7)), crown = new THREE5.Group();
  w.scene.add(crown), w.crowns.push({ g: crown, x, y: 3.6 * A, z, r: 2.2 * A });
  for (let k = 0; k < 6; k++) {
    let a = k / 6 * Math.PI * 2 + seed, r = (k === 0 ? 0 : 0.85) * A, blob = new THREE5.Mesh(w.foliageGeo[(seed + k) % w.foliageGeo.length], w.foliage[(seed + k) % 3]);
    blob.position.set(x + Math.cos(a) * r, (3.3 + k % 3 * 0.35 + (k === 0 ? 0.6 : 0)) * A, z + Math.sin(a) * r), blob.scale.setScalar((k === 0 ? 1.25 : 0.95 + k % 2 * 0.2) * A), blob.rotation.y = a, blob.castShadow = true, blob.receiveShadow = true, crown.add(blob);
  }
  w.collider(x - 0.22, z - 0.22, x + 0.22, z + 0.22), pit && w.box(1.2, 0.04, 1.2, mat("#4b3a2c", 1), x, 0, z, w.scene, false);
}
function streetLamp(w, x, z, armDir, withLight = false) {
  let iron = j.iron();
  w.cyl(0.07, 0.11, 6.2, iron, x, 0, z, w.scene, 10), w.cyl(0.16, 0.18, 0.5, iron, x, 0, z, w.scene, 10);
  let arm = w.box(1.6, 0.07, 0.07, iron, x + armDir[0] * 0.8, 6.05, z + armDir[1] * 0.8, w.scene, false);
  arm.rotation.y = Math.atan2(-armDir[1], armDir[0]);
  let head = w.box(0.7, 0.14, 0.32, iron, x + armDir[0] * 1.55, 5.98, z + armDir[1] * 1.55);
  head.rotation.y = arm.rotation.y;
  let lens = w.box(0.55, 0.04, 0.24, w.bulbMat, x + armDir[0] * 1.55, 5.9, z + armDir[1] * 1.55, w.scene, false);
  if (lens.rotation.y = arm.rotation.y, w.collider(x - 0.14, z - 0.14, x + 0.14, z + 0.14), withLight) {
    let l = new THREE5.PointLight("#ffcf8a", 0, 16, 1.4);
    l.position.set(x + armDir[0] * 1.55, 5.7, z + armDir[1] * 1.55), w.scene.add(l), w.streetLights.push(l);
  }
}
function hydrant(w, x, z) {
  let red = mat("#b3261e", 0.5, 0.2);
  w.cyl(0.13, 0.15, 0.62, red, x, 0, z, w.scene, 12), w.cyl(0.16, 0.16, 0.08, red, x, 0.6, z, w.scene, 12);
  let cap = new THREE5.Mesh(new THREE5.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
  cap.position.set(x, 0.68, z), w.scene.add(cap);
  let nub = w.cyl(0.05, 0.05, 0.36, red, x, 0.4, z, w.scene, 8);
  nub.rotation.z = Math.PI / 2, w.collider(x - 0.18, z - 0.18, x + 0.18, z + 0.18);
}
function trashCan(w, x, z) {
  w.cyl(0.26, 0.24, 0.95, mat("#2f4a3a", 0.6, 0.3), x, 0, z, w.scene, 14), w.cyl(0.28, 0.28, 0.06, mat("#24382c", 0.5, 0.3), x, 0.95, z, w.scene, 14), w.collider(x - 0.28, z - 0.28, x + 0.28, z + 0.28);
}
function bench(w, x, z, h) {
  let g = new THREE5.Group();
  g.position.set(x, 0, z), g.rotation.y = h, w.scene.add(g);
  let wood = mat("#8a5a3a", 0.8), iron = j.iron();
  for (let k = 0; k < 3; k++) w.box(1.8, 0.04, 0.13, wood, 0, 0.44, -0.16 + k * 0.16, g);
  for (let i = 0; i < 2; i++) w.box(1.8, 0.11, 0.035, wood, 0, 0.58 + i * 0.15, -0.26, g);
  for (let lx of [-0.8, 0.8]) w.box(0.06, 0.44, 0.48, iron, lx, 0, 0, g), w.box(0.05, 0.45, 0.05, iron, lx, 0.44, -0.26, g);
  let cs = Math.abs(Math.sin(h)) > 0.5;
  return w.collider(x - (cs ? 0.3 : 0.95), z - (cs ? 0.95 : 0.3), x + (cs ? 0.3 : 0.95), z + (cs ? 0.95 : 0.3)), g;
}
function signPost(w, x, z, A, b) {
  let iron = j.iron();
  w.cyl(0.04, 0.05, 3.2, iron, x, 0, z, w.scene, 8);
  let green = (t, rot, y) => {
    let m = new THREE5.Mesh(new THREE5.BoxGeometry(1.1, 0.24, 0.03), [
      mat("#1f5c3a"),
      mat("#1f5c3a"),
      mat("#1f5c3a"),
      mat("#1f5c3a"),
      new THREE5.MeshStandardMaterial({ map: signTexture(t, "#1f5c3a", "#f4f2ea", { w: 512, h: 112 }) }),
      new THREE5.MeshStandardMaterial({ map: signTexture(t, "#1f5c3a", "#f4f2ea", { w: 512, h: 112 }) })
    ]);
    m.position.set(x, y, z), m.rotation.y = rot, w.scene.add(m);
  };
  green(A, 0, 3), green(b, Math.PI / 2, 2.72);
}
function signal(w, x, y, z, rotY, s) {
  let r = new THREE5.Group();
  r.position.set(x, y, z), r.rotation.y = rotY, w.scene.add(r), w.box(0.32, 0.95, 0.26, mat("#1d1f21", 0.5, 0.3), 0, 0, 0, r);
  let lens = (c2, yy) => {
    let m = new THREE5.MeshStandardMaterial({ color: "#202020", emissive: c2, emissiveIntensity: 0.05 }), l = new THREE5.Mesh(new THREE5.CircleGeometry(0.1, 16), m);
    return l.position.set(0, yy, 0.135), r.add(l), m;
  }, i = lens("#ff2a1a", 0.78), yl2 = lens("#ffb21a", 0.48), gn = lens("#2aff7a", 0.18);
  w.signals.push({ axis: s, r: i, y: yl2, g: gn });
  for (let yy of [0.78, 0.48, 0.18]) w.box(0.26, 0.03, 0.12, mat("#1d1f21", 0.5), 0, yy + 0.12, 0.17, r, false);
  return r;
}
function trafficPole(w, x, z, armX, armZ, len, heads) {
  let iron = mat("#5c6166", 0.4, 0.6);
  w.cyl(0.11, 0.14, 6.4, iron, x, 0, z, w.scene, 12);
  let arm = w.box(len, 0.12, 0.12, iron, x + armX * len / 2, 6, z + armZ * len / 2, w.scene, false);
  arm.rotation.y = Math.atan2(-armZ, armX), heads.forEach((h, i) => signal(w, x + armX * (len - 0.6 - i * 2.8), 5.35, z + armZ * (len - 0.6 - i * 2.8), h.rot, h.axis)), signal(w, x, 3, z, heads[0].rot, heads[0].axis), w.collider(x - 0.16, z - 0.16, x + 0.16, z + 0.16);
}
function parkedCar(w, x, z, rot, kind, color) {
  let car = makeCar(color, kind);
  car.group.position.set(x, z > 4 && z < 12 || x > 34 && x < 42 ? -0.12 : 0, z), car.group.rotation.y = rot, w.scene.add(car.group);
  let along = Math.abs(Math.cos(rot)) > 0.5, hl2 = car.length / 2, hw = 1;
  w.collider(x - (along ? hl2 : hw), z - (along ? hw : hl2), x + (along ? hl2 : hw), z + (along ? hw : hl2));
}
function hl(e) {
  let t = e.opts.location, o = (h) => t === "low" ? h : t === "average" ? h + 1 : h + 3, A = new THREE5.Mesh(new THREE5.PlaneGeometry(700, 700), mat("#7d8a6a", 1));
  A.rotation.x = -Math.PI / 2, A.position.y = -0.16, A.receiveShadow = true, e.scene.add(A);
  let a = j.slab(), s = [[-110, -80, 34, 4], [42, -80, 110, 4], [-110, 12, 34, 90], [42, 12, 110, 90]];
  for (let [h, w, B, C] of s) {
    let x = new THREE5.Mesh(uvBox(B - h, 0.16, C - w, rt.slab), a);
    x.position.set((h + B) / 2, -0.08, (w + C) / 2), x.receiveShadow = true, e.scene.add(x);
  }
  let r = j.asphalt(), n = (h, w, B, C) => {
    let x = new THREE5.Mesh(uvBox(B - h, 0.04, C - w, rt.asphalt), r);
    x.position.set((h + B) / 2, -0.14, (w + C) / 2), x.receiveShadow = true, e.scene.add(x), e.mapRects.push({ x0: h, z0: w, x1: B, z1: C, kind: "road" });
  };
  n(-110, 4, 110, 12), n(34, -80, 42, 4), n(34, 12, 42, 90);
  let i = mat("#a9a49a", 0.8), l = (h, w, B, C) => e.box(Math.max(0.18, B - h), 0.17, Math.max(0.18, C - w), i, (h + B) / 2, -0.15, (w + C) / 2, e.scene, false);
  l(-110, 3.9, 34, 4), l(42, 3.9, 110, 4), l(-110, 12, 34, 12.1), l(42, 12, 110, 12.1), l(33.9, -80, 34, 4), l(42, -80, 42.1, 4), l(33.9, 12, 34, 90), l(42, 12, 42.1, 90), e.mapRects.push({ x0: -110, z0: 1, x1: 110, z1: 4, kind: "walk" }, { x0: -110, z0: 12, x1: 110, z1: 15, kind: "walk" }, { x0: 31, z0: -80, x1: 34, z1: 90, kind: "walk" }, { x0: 42, z0: -80, x1: 45, z1: 90, kind: "walk" });
  let u = mat("#e2b93b", 0.6), f = mat("#eeeae0", 0.6);
  for (let [h, w] of [[-110, 30], [46, 110]]) e.box(w - h, 0.01, 0.1, u, (h + w) / 2, -0.115, 7.88, e.scene, false), e.box(w - h, 0.01, 0.1, u, (h + w) / 2, -0.115, 8.12, e.scene, false);
  for (let [h, w] of [[-80, 0], [16, 90]]) e.box(0.1, 0.01, w - h, u, 37.88, -0.115, (h + w) / 2, e.scene, false), e.box(0.1, 0.01, w - h, u, 38.12, -0.115, (h + w) / 2, e.scene, false);
  let g = (h, w, B, C) => {
    for (let x = -C / 2 + 0.3; x < C / 2; x += 0.9) e.box(B ? 0.5 : 2.6, 0.01, B ? 2.6 : 0.5, f, B ? h + x : h, -0.112, B ? w : w + x, e.scene, false);
  };
  g(9, 8, false, 7.6), g(32, 8, false, 7.6), g(44, 8, false, 7.6), g(38, 2.2, true, 7.6), g(38, 13.8, true, 7.6), e.box(0.35, 0.01, 3.8, f, 30.2, -0.112, 10, e.scene, false), e.box(0.35, 0.01, 3.8, f, 45.8, -0.112, 6, e.scene, false), e.box(3.8, 0.01, 0.35, f, 36, -0.112, 0.4, e.scene, false), e.box(3.8, 0.01, 0.35, f, 40, -0.112, 15.6, e.scene, false);
  for (let [h, w] of [[-30, 8], [18, 6.5], [38, -20], [60, 10]]) {
    let B = e.cyl(0.35, 0.35, 0.02, mat("#2a2b2c", 0.6, 0.6), h, -0.12, w, e.scene, 18);
    B.castShadow = false;
  }
  {
    let h = j.stone("#d8d0c0"), w = Re(e, {
      x: -55,
      z: -4,
      facing: "S",
      width: 22,
      depth: 16,
      floors: o(3),
      wall: "stone",
      color: "#d8d0c0",
      trim: "#cfc6b4",
      storefront: false,
      bays: 7,
      label: "City Hall"
    });
    for (let S = 0; S < 5; S++) e.box(14, 0.18 * (S + 1), 0.45, h, -55, 0, -0.35 - S * 0.45);
    e.box(14.4, 0.25, 3, h, -55, 0.9, -2.6);
    for (let S = 0; S < 6; S++) e.cyl(0.32, 0.36, 6.6, h, -61.25 + S * 2.5, 0.9, -1.6, e.scene, 18);
    e.box(14.6, 0.7, 3.2, h, -55, 7.5, -2.6);
    let B = new THREE5.Mesh(new THREE5.ExtrudeGeometry(new THREE5.Shape([new THREE5.Vector2(-7.3, 0), new THREE5.Vector2(7.3, 0), new THREE5.Vector2(0, 1.8)]), { depth: 3, bevelEnabled: false }), h);
    B.position.set(-55, 8.2, -4.1), B.castShadow = true, e.scene.add(B);
    let C = new THREE5.Mesh(new THREE5.PlaneGeometry(6.5, 0.5), new THREE5.MeshStandardMaterial({
      map: signTexture("CITY HALL", "#cfc6b4", "#4a4237", { w: 1024, h: 96 }),
      roughness: 0.8
    }));
    C.position.set(-55, 7.86, -0.99), e.scene.add(C), e.collider(-62, -2.6, -48, -0.1), e.cyl(0.05, 0.07, 9, mat("#c9cdd2", 0.3, 0.8), -46.5, 0, 0);
    let x = new THREE5.Mesh(new THREE5.PlaneGeometry(1.6, 1), new THREE5.MeshStandardMaterial({ map: stripeTexture("#2c4a7a", "#f2efe6", 6), side: THREE5.DoubleSide, roughness: 0.9 }));
    x.position.set(-45.7, 8.4, 0), e.scene.add(x), e.flags.push(x), e.collider(-46.6, -0.1, -46.4, 0.1);
    for (let S of [-63, -47]) e.box(1.2, 0.6, 1.2, h, S, 0, 0.2), e.collider(S - 0.6, -0.4, S + 0.6, 0.8);
    e.places.push({ id: "cityhall", name: "City Hall", x: -55, z: 1.5, h: Math.PI });
  }
  Re(e, {
    x: -32.5,
    z: -0.3,
    facing: "S",
    width: 19,
    depth: 14,
    floors: o(4) + 1,
    wall: "brick",
    color: "#8f4a38",
    trim: "#e2d8c6",
    storefront: false,
    fireEscape: true,
    stoop: true,
    label: "Apts",
    waterTower: t !== "low"
  }), e.box(19, 0.02, 1.3, j.slab(), -32.5, 0, 0.35, e.scene, false), e.places.push({ id: "apartments", name: "Okafor Apartments", x: -32.5, z: 2.6, h: Math.PI });
  {
    let h = Re(e, {
      x: -15,
      z: 1,
      facing: "S",
      width: 12,
      depth: 15,
      floors: o(2),
      wall: "stone",
      color: "#d3cab8",
      trim: "#c4b9a5",
      storefront: {
        sign: signTexture("CIVIC SAVINGS", "#22324a", "#e9dcb8", { sub: "Loans \xB7 Deposits" }),
        door: 0,
        dark: true
      },
      label: "Bank"
    }), w = j.stone("#d3cab8");
    for (let B of [-19.5, -17.2, -12.8, -10.5]) e.cyl(0.26, 0.3, 3.5, w, B, 0, 1.45, e.scene, 16);
    e.box(11.6, 0.3, 1.4, w, -15, 3.5, 1.4), e.collider(-20, 1, -16.4, 1.8), e.collider(-13.6, 1, -10, 1.8), e.anchors.bank = { x: -15, z: 2.3, r: 1.5 }, e.places.push({ id: "bank", name: "Civic Savings", x: -15, z: 2.9, h: Math.PI });
  }
  for (let [h, w] of [[-44, -42], [-23, -21], [21, 23]]) e.box(w - h, 2.6, 0.25, j.brick("#7a4c3c"), (h + w) / 2, 0, 0.6), e.collider(h, -14.5, w, 0.75), e.box(1.5, 1.1, 0.9, mat("#3f6b4f", 0.6, 0.3), (h + w) / 2, 0, -0.2);
  Re(e, {
    x: 15,
    z: 1,
    facing: "S",
    width: 12,
    depth: 15,
    floors: o(2),
    wall: "brick",
    color: "#55595c",
    trim: "#1f2428",
    storefront: {
      sign: signTexture("IRON & OAK GYM", "#1f2428", "#f2b632", { sub: "Open 5am \u2013 11pm" }),
      door: 2
    },
    label: "Gym"
  }), e.places.push({ id: "gym", name: "Iron & Oak Gym", x: 15, z: 2.9, h: Math.PI }), Re(e, {
    x: 27,
    z: 1,
    facing: "S",
    width: 8,
    depth: 15,
    floors: o(3),
    wall: "plaster",
    color: "#e5d6bf",
    trim: "#5b3d4a",
    storefront: {
      sign: signTexture("BLOOM CAF\xC9", "#5b3d4a", "#f6e7cf", { sub: "Espresso \xB7 Pastry" }),
      awning: "#5b3d4a",
      door: -2.5
    },
    label: "Caf\xE9",
    cornice: true
  });
  for (let h of [24.6, 28.6]) {
    e.cyl(0.35, 0.35, 0.04, mat("#f1efe8", 0.4), h, 0.72, 3.25, e.scene, 16), e.cyl(0.04, 0.06, 0.72, j.iron(), h, 0, 3.25, e.scene, 8), e.cyl(0.03, 0.03, 2.2, j.iron(), h, 0.72, 3.25, e.scene, 6);
    let w = new THREE5.Mesh(new THREE5.ConeGeometry(1.2, 0.5, 12, 1, true), new THREE5.MeshStandardMaterial({ map: stripeTexture("#5b3d4a", "#f3efe6", 12), side: THREE5.DoubleSide, roughness: 0.9 }));
    w.position.set(h, 2.8, 3.25), w.castShadow = true, e.scene.add(w), e.collider(h - 0.4, 2.85, h + 0.4, 3.65);
  }
  e.places.push({ id: "cafe", name: "Bloom Caf\xE9", x: 26.5, z: 2.4, h: Math.PI });
  {
    let h = j.plaster("#9aa3a6"), w = local(e, 55.5, 1, "S");
    e.box(21, 7.5, 21, h, 0, 0, -10.5, w);
    for (let C = -10; C <= 10; C += 0.5) e.box(0.06, 7.5, 0.06, mat("#8a9396", 0.5, 0.4), C, 0, 0, w, false);
    for (let C of [-6, 0, 6]) {
      e.box(4.2, 4.4, 0.08, mat("#c9ccc8", 0.5, 0.4), C, 1.2, 0.05, w, false);
      for (let x = 1.4; x < 5.5; x += 0.3) e.box(4.1, 0.03, 0.1, mat("#a9adaa", 0.5, 0.4), C, x, 0.08, w, false);
    }
    e.box(21, 1.2, 1.4, j.stone("#b0aa9e"), 0, 0, 0.7, w);
    let B = new THREE5.Mesh(new THREE5.PlaneGeometry(10, 1), new THREE5.MeshStandardMaterial({
      map: signTexture("METRO FOOD SUPPLY", "#c23b22", "#ffffff", { sub: "Wholesale \xB7 Est. 1974" }),
      roughness: 0.6
    }));
    B.position.set(0, 6.4, 0.1), w.add(B), e.collider(45, -20, 66, 2.4), e.occluders.push({ x0: 45, z0: -20, x1: 66, z1: 1, h: 7.6 }), e.mapRects.push({ x0: 45, z0: -20, x1: 66, z1: 1, kind: "building", label: "Depot" });
    for (let C = 0; C < 3; C++) e.box(1.1, 0.14, 1.1, mat("#9a7a52", 0.9), 50 + C * 1.3, 1.2, 1.3);
    e.places.push({ id: "depot", name: "Metro Food Supply", x: 54, z: 3.2, h: Math.PI });
  }
  let c = ["#8f4a38", "#6f3f33", "#a8653f", "#7b5a44", "#93533f", "#5f4a3f"];
  for (let h = 0; h < 5; h++) Re(e, {
    x: 29.5,
    z: -17 - h * 6,
    facing: "E",
    width: 6,
    depth: 9,
    floors: 3,
    groundH: 3.4,
    wall: "brick",
    color: c[h % c.length],
    trim: "#e2d8c6",
    storefront: false,
    stoop: true,
    bays: 2,
    cornice: true
  }), e.box(0.06, 0.8, 5, j.iron(), 31, 0, -17 - h * 6 - 0.2, e.scene, false);
  e.collider(29.4, -44.5, 31.05, -14);
  for (let h = 0; h < 4; h++) Re(e, {
    x: 46.5,
    z: -23 - h * 6,
    facing: "W",
    width: 6,
    depth: 9,
    floors: 3,
    groundH: 3.4,
    wall: "brick",
    color: c[(h + 3) % c.length],
    trim: "#e9e3d6",
    storefront: false,
    stoop: true,
    bays: 2
  });
  e.collider(44.95, -44.5, 46.6, -20), e.places.push({ id: "homes", name: "Oak Ave homes", x: 32.6, z: -28, h: 0 }), e.box(14, 0.06, 4, j.grass(), 38, -0.06, -46.5, e.scene);
  for (let h of [32, 44]) Ot(e, h, -45.5, 1.1, false);
  e.box(14, 1, 0.8, e.hedgeMat, 38, 0, -48.2);
  {
    let h = mat("#8b7356", 1);
    e.box(40, 0.05, 22, h, -46, -0.03, 26.5, e.scene, false);
    let w = j.iron(), B = new THREE5.MeshStandardMaterial({
      color: "#9aa0a5",
      roughness: 0.6,
      metalness: 0.4,
      transparent: true,
      opacity: 0.35,
      side: THREE5.DoubleSide,
      depthWrite: false
    }), C = (b, k, z, L) => {
      let ee = Math.hypot(z - b, L - k), U = new THREE5.Mesh(new THREE5.PlaneGeometry(ee, 2.2), B);
      U.position.set((b + z) / 2, 1.1, (k + L) / 2), U.rotation.y = -Math.atan2(L - k, z - b), e.scene.add(U);
      for (let Y = 0; Y <= ee; Y += 2.5) e.cyl(0.04, 0.04, 2.3, w, b + (z - b) * Y / ee, 0, k + (L - k) * Y / ee, e.scene, 6);
      e.collider(Math.min(b, z) - 0.08, Math.min(k, L) - 0.08, Math.max(b, z) + 0.08, Math.max(k, L) + 0.08);
    };
    C(-66, 15.5, -45.5, 15.5), C(-40.5, 15.5, -26, 15.5), C(-66, 15.5, -66, 37.5), C(-26, 15.5, -26, 37.5), C(-66, 37.5, -26, 37.5);
    let x = new THREE5.Mesh(new THREE5.PlaneGeometry(4, 1.6), new THREE5.MeshStandardMaterial({
      map: signTexture("DEE BUILDS", "#f2b632", "#1d1f21", { sub: "Hard hats beyond this point", w: 1024, h: 400 }),
      roughness: 0.8
    }));
    x.position.set(-50, 1.3, 15.42), x.rotation.y = Math.PI, e.scene.add(x), e.box(18, 0.4, 12, mat("#a9a7a2", 0.9), -50, 0, 28.5), e.collider(-59, 22.5, -41, 34.5);
    let S = mat("#8a4b2a", 0.6, 0.5);
    for (let b = 0; b < 3; b++) {
      let k = 0.4 + b * 3.6;
      for (let z = 0; z <= 4; z++) for (let L = 0; L <= 2; L++) e.box(0.25, 3.6, 0.25, S, -58.5 + z * 4.25, k, 23 + L * 5.5);
      for (let z = 0; z <= 2; z++) e.box(17.2, 0.3, 0.2, S, -50, k + 3.45, 23 + z * 5.5);
      for (let z = 0; z <= 4; z++) e.box(0.2, 0.3, 11.2, S, -58.5 + z * 4.25, k + 3.45, 28.5);
      b < 2 && e.box(17.2, 0.15, 11.2, mat("#b5b2ab", 0.9), -50, k + 3.6, 28.5, e.scene);
    }
    let X = mat("#c9ccd0", 0.4, 0.7);
    for (let b = 0; b < 6; b++) e.box(0.06, 9, 0.06, X, -58.5 + b * 3.4, 0.4, 21.6, e.scene, false);
    for (let b = 2; b < 10; b += 2.2) e.box(17.2, 0.05, 0.06, X, -50, b, 21.6, e.scene, false), e.box(17.2, 0.06, 0.9, mat("#8a6a42", 0.9), -50, b - 0.1, 21.15, e.scene, false);
    let R = mat("#f2b632", 0.5, 0.3);
    e.box(1.2, 26, 1.2, R, -33, 0, 32), e.box(24, 0.9, 0.9, R, -42, 26, 32), e.box(6, 0.9, 0.9, R, -27, 26, 32), e.box(2.4, 2, 1.6, mat("#7b7f83", 0.6), -25.5, 24, 32), e.box(1.6, 1.4, 1.4, mat("#2b2e31", 0.5), -33, 26.9, 32), e.cyl(0.02, 0.02, 14, mat("#222", 0.4), -50, 12, 32, e.scene, 4), e.collider(-33.8, 31.2, -32.2, 32.8);
    for (let b = 0; b < 4; b++) e.box(1.2, 0.8, 1.2, mat("#a5523e", 0.9), -38 + b * 1.5, 0, 19.5);
    e.collider(-38.8, 18.8, -32.8, 20.2);
    for (let b = 0; b < 5; b++) {
      let k = e.cyl(0.2, 0.2, 5, mat("#5b6066", 0.4, 0.6), -34, 0.2 + b * 0.4 % 0.8, 24 + b % 3 * 0.42, e.scene, 12);
      k.rotation.x = Math.PI / 2;
    }
    e.collider(-34.3, 21.5, -33.7, 26.5), e.box(1.3, 2.3, 1.3, mat("#2f6fb3", 0.5), -29, 0, 35.5), e.collider(-29.7, 34.8, -28.3, 36.2), e.box(7, 2.6, 2.6, mat("#e7e3d9", 0.6), -61, 0, 19), e.collider(-64.5, 17.7, -57.5, 20.3);
    for (let [b, k] of [[-46, 15.9], [-40, 15.9]]) {
      let z = new THREE5.Mesh(new THREE5.ConeGeometry(0.2, 0.6, 12), mat("#ff6a1f", 0.6));
      z.position.set(b, 0.3, k), z.castShadow = true, e.scene.add(z);
    }
    e.mapRects.push({ x0: -66, z0: 15.5, x1: -26, z1: 37.5, kind: "site", label: "Construction" }), e.places.push({ id: "site", name: "Construction site", x: -43, z: 17.5, h: 0 });
  }
  Re(e, {
    x: -15,
    z: 15,
    facing: "N",
    width: 12,
    depth: 13,
    floors: o(2),
    wall: "plaster",
    color: "#9fc4cf",
    trim: "#2f6f7a",
    storefront: {
      sign: signTexture("SUDS LAUNDRY", "#f2efe8", "#2f6f7a", { sub: "Wash \xB7 Dry \xB7 Fold" }),
      door: 3
    },
    label: "Laundry"
  }), e.box(3, 2.6, 0.2, j.brick("#7a4c3c"), -22.5, 0, 15.1), e.collider(-26.1, 15, -21, 28.1), e.box(2, 2.6, 0.2, j.brick("#7a4c3c"), -8, 0, 15.1), e.collider(-9, 15, -7, 28.1), e.box(2, 2.6, 0.2, j.brick("#7a4c3c"), 8, 0, 15.1), e.collider(7, 15, 9, 28.1);
  let v = Re(e, {
    x: 0,
    z: 15,
    facing: "N",
    width: 14,
    depth: 13,
    floors: o(2),
    wall: "brick",
    color: "#a35d48",
    trim: "#2c2a28",
    storefront: false,
    label: "Rival"
  });
  e.places.push({ id: "rival", name: "Across the street", x: 0, z: 13.2, h: 0 });
  {
    let h = j.grass(), w = new THREE5.Mesh(uvBox(17, 0.06, 12.5, rt.grass), h);
    w.position.set(17.5, -0.02, 21.4), w.receiveShadow = true, e.scene.add(w), e.mapRects.push({ x0: 9, z0: 15, x1: 26, z1: 28, kind: "park", label: "Market Sq" });
    let B = j.stone("#d8cdb5"), C = new THREE5.Mesh(uvBox(3, 0.08, 12.5, rt.stone), B);
    C.position.set(17.5, -0.01, 21.4), C.receiveShadow = true, e.scene.add(C);
    let x = new THREE5.Mesh(uvBox(17, 0.08, 2.4, rt.stone), B);
    x.position.set(17.5, -0.01, 22), x.receiveShadow = true, e.scene.add(x);
    let S = j.stone("#bdb5a6");
    e.cyl(2, 2.1, 0.55, S, 17.5, 0, 22, e.scene, 32), e.collider(15.6, 20.1, 19.4, 23.9);
    let X = new THREE5.Mesh(new THREE5.CylinderGeometry(1.8, 1.8, 0.05, 32), new THREE5.MeshStandardMaterial({ color: "#3f7f9e", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.88 }));
    X.position.set(17.5, 0.5, 22), X.userData.keep = true, e.scene.add(X), e.cyl(0.25, 0.35, 1.3, S, 17.5, 0.5, 22, e.scene, 16), e.cyl(0.7, 0.5, 0.15, S, 17.5, 1.8, 22, e.scene, 20), bench(e, 13.2, 19, Math.PI / 2);
    let R = bench(e, 13.2, 25, Math.PI / 2);
    bench(e, 21.8, 25.6, -Math.PI / 2), e.anchors.june = { x: 13.95, z: 19, r: 1.4 }, e.anchors.bench = { x: 13.9, z: 25, r: 1.3, mesh: R }, e.seats.push({
      x: 13.4,
      z: 25,
      h: Math.PI / 2,
      y: 0.47,
      sit: true,
      taken: true,
      approach: { x: 14.2, z: 25 }
    });
    let b = (z, L, ee, U) => {
      let Y = new THREE5.Group();
      Y.position.set(z, 0, L), e.scene.add(Y);
      let q = mat("#9a7448", 0.8);
      e.box(2.4, 0.9, 1, q, 0, 0, 0, Y);
      for (let [W, se] of [[-1.15, -0.45], [1.15, -0.45], [-1.15, 0.45], [1.15, 0.45]]) e.box(0.08, 2.4, 0.08, q, W, 0, se, Y, false);
      let te = new THREE5.Mesh(new THREE5.PlaneGeometry(2.7, 1.5), new THREE5.MeshStandardMaterial({ map: stripeTexture(ee, "#f6f1e6", 8), side: THREE5.DoubleSide, roughness: 0.9 }));
      return te.position.set(0, 2.45, 0), te.rotation.x = -Math.PI / 2 + 0.25, te.castShadow = true, Y.add(te), U.forEach((W, se) => {
        let De = new THREE5.Mesh(new THREE5.SphereGeometry(0.1, 10, 8), mat(W, 0.55));
        De.position.set(-0.9 + se % 9 * 0.22, 0.98, -0.2 + Math.floor(se / 9) * 0.22), Y.add(De);
      }), e.box(0.5, 0.3, 0.4, mat("#a5794c", 0.9), 0.8, 0.9, 0.2, Y), e.collider(z - 1.25, L - 0.55, z + 1.25, L + 0.55), Y;
    }, k = b(23, 18, "#3f7a5a", Array.from({ length: 18 }, (z, L) => ["#d94a3a", "#f0c23c", "#ff8a3d", "#6fae4a"][L % 4]));
    b(23, 21.4, "#b23a2e", Array.from({ length: 18 }, (z, L) => ["#e8d9b0", "#c99a63", "#8a5a3a"][L % 3])), e.anchors.market = { x: 21.2, z: 19.7, r: 2, mesh: k }, e.clickables.push(k), e.box(17, 1.1, 0.8, e.hedgeMat, 17.5, 0, 27.6), e.collider(9, 27.2, 26, 28);
    for (let [z, L] of [[10.5, 16.5], [10.5, 26], [25, 16.2], [25, 26.5], [14.5, 16.2], [20.5, 26.5]]) Ot(e, z, L, 1.1, false);
    e.places.push({ id: "market", name: "Market Square", x: 17.5, z: 17.2, h: 0 });
  }
  {
    // The pavement around the court tops out at y = 0. The old court slab did too, so the two surfaces fought each
    // other and flickered black and grey. Now the slab sits 3 cm higher (and wins ties), and the court is painted on top.
    let slabMat = j.asphalt().clone();
    slabMat.polygonOffset = true, slabMat.polygonOffsetFactor = -1, slabMat.polygonOffsetUnits = -1;
    let h = new THREE5.Mesh(uvBox(15, 0.06, 13, rt.asphalt), slabMat);
    h.position.set(19, 0, 38), h.receiveShadow = true, e.scene.add(h);
    let paint = new THREE5.Mesh(new THREE5.PlaneGeometry(14, 12.8), new THREE5.MeshStandardMaterial({ map: courtTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    paint.rotation.x = -Math.PI / 2, paint.position.set(19, 0.04, 38), paint.receiveShadow = true, e.scene.add(paint);
    for (let C of [32.2, 43.8]) {
      e.cyl(0.08, 0.08, 3.2, j.iron(), 19, 0, C + (C < 38 ? -0.9 : 0.9), e.scene, 8), e.box(1.2, 0.8, 0.05, mat("#f4f4f2", 0.4), 19, 2.9, C, e.scene, false);
      let x = new THREE5.Mesh(new THREE5.TorusGeometry(0.23, 0.02, 6, 16), mat("#e05a1f", 0.5, 0.4));
      x.rotation.x = Math.PI / 2, x.position.set(19, 3.05, C + (C < 38 ? 0.3 : -0.3)), e.scene.add(x);
    }
    e.mapRects.push({ x0: 11.5, z0: 31.5, x1: 26.5, z1: 44.5, kind: "lot", label: "Court" });
    let B = j.iron();
    for (let [C, x, S, X] of [[9, 28, 9, 50], [9, 50, 31, 50]]) {
      let R = Math.hypot(S - C, X - x);
      for (let b = 0; b <= R; b += 0.25) e.box(0.03, 1.4, 0.03, B, C + (S - C) * b / R, 0, x + (X - x) * b / R, e.scene, false);
      e.box(Math.max(0.05, S - C), 0.05, Math.max(0.05, X - x), B, (C + S) / 2, 1.4, (x + X) / 2, e.scene, false), e.collider(Math.min(C, S) - 0.1, Math.min(x, X) - 0.1, Math.max(C, S) + 0.1, Math.max(x, X) + 0.1);
    }
    for (let [C, x] of [[11, 30], [28, 30], [28, 47], [11, 47]]) Ot(e, C, x, 1, false);
    bench(e, 28.5, 38, -Math.PI / 2), e.places.push({ id: "court", name: "The court", x: 29.4, z: 34, h: -Math.PI / 2 });
  }
  {
    Re(e, {
      x: 55.5,
      z: 15,
      facing: "N",
      width: 14,
      depth: 10,
      floors: 1,
      groundH: 4.2,
      wall: "plaster",
      color: "#d9e2e4",
      trim: "#b23a2e",
      storefront: {
        sign: signTexture("HARBOR DINER", "#b23a2e", "#fff6e8", { sub: "Open 24 hours" }),
        door: -3
      },
      label: "Diner",
      cornice: false
    });
    // Same fix as the court: the lot's asphalt used to share its top surface (y = 0) with the pavement under it and flickered.
    let lotMat = j.asphalt().clone();
    lotMat.polygonOffset = true, lotMat.polygonOffsetFactor = -1, lotMat.polygonOffsetUnits = -1;
    let h = new THREE5.Mesh(uvBox(21, 0.06, 16, rt.asphalt), lotMat);
    h.position.set(55.5, 0, 33), h.receiveShadow = true, e.scene.add(h);
    let stripe = mat("#eeeae0", 0.6);
    for (let row of [29, 37.5]) {
      for (let w = 0; w < 7; w++) e.box(0.1, 0.01, 4.5, stripe, 46.5 + w * 3, 0.035, row, e.scene, false);
      e.box(18.1, 0.01, 0.1, stripe, 55.5, 0.035, row + (row < 33 ? -2.25 : 2.25), e.scene, false);
    }
    for (let w = 0; w < 6; w += 2) parkedCar(e, 48 + w * 3, 29, Math.PI / 2, ["sedan", "suv", "hatch"][w % 3], CAR_COLORS[(w + 2) % CAR_COLORS.length]);
    e.mapRects.push({ x0: 45, z0: 25, x1: 66, z1: 41, kind: "lot", label: "Lot" }), e.collider(45, 41, 66, 42), e.collider(66, 15, 67, 42), e.box(21, 1, 0.6, e.hedgeMat, 55.5, 0, 41.3), e.places.push({ id: "diner", name: "Harbor Diner", x: 52, z: 13.6, h: Math.PI });
  }
  for (let h = 0; h < 3; h++) Re(e, {
    x: 46.5,
    z: 46 + h * 6,
    facing: "W",
    width: 6,
    depth: 9,
    floors: 3,
    groundH: 3.4,
    wall: "brick",
    color: c[(h + 4) % c.length],
    trim: "#e9e3d6",
    storefront: false,
    stoop: true,
    bays: 2
  });
  let m = [[-80, 1, 22, "S", 4], [80, 1, 22, "S", 5], [-80, 15, 22, "N", 3], [80, 15, 22, "N", 4]];
  for (let [h, w, B, C, x] of m) Re(e, {
    x: h,
    z: w,
    facing: C,
    width: B,
    depth: 14,
    floors: o(x),
    wall: "brick",
    color: ["#9a5b4a", "#7b6a5c", "#a8653f", "#6d5a4a"][Math.abs(h + w) % 4],
    storefront: { door: 0 }
  });
  if (t === "high") for (let h = 0; h < 8; h++) {
    let w = -90 + h * 26;
    Re(e, {
      x: w,
      z: -24,
      facing: "S",
      width: 18,
      depth: 14,
      floors: 9 + h * 5 % 7,
      wall: h % 2 ? "stone" : "brick",
      color: ["#8a8f94", "#a89a86", "#6e7680"][h % 3],
      storefront: false,
      cornice: h % 2 === 0,
      waterTower: h % 3 === 0
    });
  }
  for (let h of [-60, -40, -20, 9.8, 20, 52]) streetLamp(e, h, 3.75, [0, 1], h === 9.8);
  for (let h of [-50, -30, -2, 20, 50]) streetLamp(e, h, 12.25, [0, -1], false);
  for (let h of [-40, -24]) streetLamp(e, 33.75, h, [1, 0]), streetLamp(e, 42.25, h + 8, [-1, 0]);
  for (let h of [26, 44]) streetLamp(e, 42.25, h, [-1, 0]);
  for (let h of [-44, -26, -11.5, 11.5, 22, 50, 62]) Ot(e, h, 3.5, 0.95);
  for (let h of [-18, -4.5, 4.5, 50]) Ot(e, h, 12.5, 0.95);
  for (let h of [-36, -30, -24]) Ot(e, 33.4, h, 0.9);
  for (let h of [26, 34]) Ot(e, 33.4, h, 0.9);
  hydrant(e, -24.5, 3.5), hydrant(e, 8, 3.5), hydrant(e, 44.6, 14.6), hydrant(e, 33.4, -10), trashCan(e, -8.2, 3.4), trashCan(e, 21.6, 3.4), trashCan(e, -24.5, 14.6), trashCan(e, 30.5, 14.6), signPost(e, 33.6, 3.6, "MAIN ST", "OAK AVE"), e.box(0.5, 1.05, 0.45, mat("#21407a", 0.5, 0.2), -6.2, 0, 3.45), e.collider(-6.45, 3.22, -5.95, 3.68), e.box(0.45, 1, 0.4, mat("#c8312e", 0.5), -5.5, 0, 3.5), e.collider(-5.73, 3.3, -5.27, 3.7);
  {
    let h = mat("#2b2e31", 0.4, 0.5);
    e.box(3.2, 0.1, 1.3, h, -16, 2.5, 13.9);
    let w = new THREE5.Mesh(new THREE5.BoxGeometry(3.2, 2, 0.04), e.glass);
    w.position.set(-16, 1.4, 14.5), e.scene.add(w);
    for (let B of [-17.55, -14.45]) e.box(0.06, 2.5, 0.06, h, B, 0, 14.5, e.scene, false);
    e.box(2.4, 0.06, 0.4, mat("#8a5a3a", 0.8), -16, 0.46, 14.2), e.collider(-17.6, 14, -14.4, 14.6);
  }
  {
    let h = e.cyl(0.55, 0.55, 2.6, new THREE5.MeshStandardMaterial({
      map: signTexture("ADVERTISE HERE", "#efe6c8", "#b23a2e", { w: 512, h: 512, sub: "Local \xB7 Citywide" }),
      roughness: 0.8
    }), -11.5, 0, 14.5, e.scene, 24);
    e.cyl(0.62, 0.62, 0.25, mat("#2f4a3f", 0.6), -11.5, 2.6, 14.5), e.collider(-12.1, 13.95, -10.9, 15.1), e.anchors.ads = { x: -11.5, z: 13.2, r: 1.3, mesh: h }, e.clickables.push(h);
  }
  trafficPole(e, 33.4, 12.6, 0, -1, 7.5, [{ axis: "main", rot: -Math.PI / 2 }]), trafficPole(e, 42.6, 3.4, 0, 1, 7.5, [{ axis: "main", rot: Math.PI / 2 }]), trafficPole(e, 33.4, 3.4, 1, 0, 7.5, [{ axis: "oak", rot: Math.PI }]), trafficPole(e, 42.6, 12.6, -1, 0, 7.5, [{ axis: "oak", rot: 0 }]);
  let P = ["sedan", "hatch", "suv"];
  [[-32, 0], [-26, 1], [-14, 2], [22, 0], [28, 1], [38, 2]].forEach(([h, w], B) => parkedCar(e, 34.95, h, (B % 2, Math.PI / 2), P[w], CAR_COLORS[B * 3 % CAR_COLORS.length])), [[-38, 1], [-30, 0], [26, 2], [44, 0]].forEach(([h, w], B) => parkedCar(e, 41.05, h, -Math.PI / 2, P[w], CAR_COLORS[(B * 5 + 1) % CAR_COLORS.length])), parkedCar(e, 41, -11, -Math.PI / 2, "truck", "#c23b22");
}
var SHOP = { x0: -7, x1: 7, z0: -13, z1: 1 }, BOUNDS = { x0: -66, x1: 66, z0: -45, z1: 51 };
function groundY(x, z) {
  return z > 4.15 && z < 11.85 || x > 34.15 && x < 41.85 ? -0.12 : 0;
}
function insideShop(x, z) {
  return x > SHOP.x0 && x < SHOP.x1 && z > SHOP.z0 && z < SHOP.z1 - 0.15;
}
var FACADE = {
  restaurant: { wall: "#8c4a3b", trim: "#2d2a26", paint: "#efe3d3", wainscot: "#5a3b2b", brick: true },
  coffee: { wall: "#2f4a3f", trim: "#c9b48a", paint: "#ebe4d8", wainscot: "#2f4a3f", brick: false },
  bakery: { wall: "#e8d6b8", trim: "#8a5a3a", paint: "#f7eddd", wainscot: "#d9b89a", brick: false },
  convenience: { wall: "#e3e6e8", trim: "#2c5d9c", paint: "#f4f5f3", wainscot: "#c8ced4", brick: false },
  barber: { wall: "#27334a", trim: "#c8a24a", paint: "#ece7df", wainscot: "#27334a", brick: false }
}, HOMES = {
  accountant: { x: 4.4, z: -9.45, h: Math.PI, sit: true, sitY: 0.47 },
  manager: { x: -5.3, z: -8.2, h: 0.4 },
  neighbor: { x: 16.4, z: 3.3, h: -2.6 },
  regular: { x: 13.45, z: 19, h: Math.PI / 2, sit: true, sitY: 0.47 },
  banker: { x: -12.7, z: 3.3, h: 2.6 },
  supplier: { x: 53.5, z: 3.3, h: Math.PI },
  contractor: { x: -43, z: 18.6, h: 0 },
  inspector: { x: -52.5, z: 0.6, h: 0.3 },
  landlord: { x: -31.2, z: 1.3, h: 0.2 },
  influencer: { x: 25.35, z: 3.25, h: -Math.PI / 2, sit: true, sitY: 0.47 },
  rival: { x: 52, z: 14.6, h: 0.3 }
}, cl = class {
  constructor(e) {
    this.scene = new THREE6.Scene(), this.colliders = [], this.walls = [], this.roofParts = [], this.ceiling = [], this.clickables = [], this.anchors = {}, this.spots = { street: [], inside: [], back: [], office: [] }, this.seats = [], this.queue = [], this.staffSpots = [], this.backStaffSpots = [], this.mapRects = [], this.occluders = [], this.places = [], this.signals = [], this.signMats = [], this.flags = [], this.crowns = [], this.door = { out: { x: 0, z: 2.2 }, in: { x: 0, z: -0.4 } }, this.envMaps = [], this.interiorLights = [], this.streetLights = [], this.bulbMat = new THREE6.MeshStandardMaterial({ color: "#fff2d0", emissive: "#ffcc80", emissiveIntensity: 0 }), this.windowLit = new THREE6.MeshStandardMaterial({
      color: "#58697a",
      roughness: 0.12,
      metalness: 0.2,
      emissive: "#ffc77a",
      emissiveIntensity: 0
    }), this.windowDark = new THREE6.MeshStandardMaterial({ color: "#4a5a69", roughness: 0.1, metalness: 0.3 }), this.shopGlassOut = new THREE6.MeshStandardMaterial({
      color: "#5c6f7e",
      roughness: 0.08,
      metalness: 0.2,
      emissive: "#ffd9a0",
      emissiveIntensity: 0
    }), this.glass = new THREE6.MeshStandardMaterial({
      color: "#b8d4e3",
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    }), this.foliage = [], this.foliageGeo = [], this.hedgeMat = new THREE6.MeshStandardMaterial({ color: "#4d7a3f", roughness: 1 }), this.snow = null, this.renoProps = new THREE6.Group(), this.t = 0, this.cutaway = false, this.clock = 0, this.userSign = null, this.shopOccluder = { x0: -7, z0: -13, x1: 7, z1: 1, h: 3.7 }, this.firstPerson = false, this.HOMES = HOMES, this.sunEl = 1, this.sunAz = 0, this.envIntensity = 1, this.opts = e, this.floors = e.location === "low" ? 0 : e.location === "average" ? 1 : 3;
    let t = this.scene;
    t.fog = new THREE6.Fog("#dfe7ec", 70, 260), this.skyMat = skyMaterial(), this.sky = new THREE6.Mesh(new THREE6.SphereGeometry(500, 32, 16), this.skyMat), this.sky.frustumCulled = false, t.add(this.sky), this.hemi = new THREE6.HemisphereLight("#cfe3ff", "#8c7b62", 0.35), t.add(this.hemi), this.sun = new THREE6.DirectionalLight("#fff1dc", 2.8), this.sun.castShadow = true, this.sun.shadow.mapSize.set(2048, 2048);
    let o = this.sun.shadow.camera;
    o.left = -32, o.right = 32, o.top = 32, o.bottom = -32, o.near = 1, o.far = 160, this.sun.shadow.bias = -3e-4, this.sun.shadow.normalBias = 0.035, t.add(this.sun, this.sun.target);
    for (let a of ["#56813e", "#6a9248", "#4c7438"]) this.foliage.push(new THREE6.MeshStandardMaterial({ color: a, roughness: 0.9 }));
    for (let a = 0; a < 4; a++) {
      let s = new THREE6.IcosahedronGeometry(1, 3), r = s.attributes.position, n = new THREE6.Vector3();
      for (let i = 0; i < r.count; i++) {
        n.fromBufferAttribute(r, i);
        let l = 1 + 0.18 * Math.sin(n.x * 4.1 + a) * Math.sin(n.y * 3.7 + a * 2) * Math.sin(n.z * 4.3) + 0.08 * Math.sin(n.x * 11 + n.z * 9 + a);
        n.multiplyScalar(l), r.setXYZ(i, n.x, n.y * 0.85, n.z);
      }
      s.computeVertexNormals(), this.foliageGeo.push(s);
    }
    this.buildShop(), this.buildRivalFront(), hl(this), this.places.unshift({ id: "floor", name: "Your shop \xB7 floor", x: 0.3, z: -1.9, h: -2.3 }, { id: "back", name: "Your shop \xB7 back room", x: -2.6, z: -7.6, h: Math.PI }, { id: "office", name: "Your shop \xB7 office", x: 3.2, z: -7.6, h: Math.PI }, { id: "street", name: "Main Street", x: 0, z: 2.8, h: Math.PI }), this.collider(BOUNDS.x0 - 1, BOUNDS.z0 - 1, BOUNDS.x0, BOUNDS.z1 + 1), this.collider(BOUNDS.x1, BOUNDS.z0 - 1, BOUNDS.x1 + 1, BOUNDS.z1 + 1), this.collider(BOUNDS.x0, BOUNDS.z1, BOUNDS.x1, BOUNDS.z1 + 1), this.collider(BOUNDS.x0, BOUNDS.z0 - 1, BOUNDS.x1, BOUNDS.z0), this.nav = new Wi(BOUNDS.x0, BOUNDS.z0, BOUNDS.x1, BOUNDS.z1, 0.3);
    for (let a of this.colliders) this.nav.addBox(a, 0.3);
    this.nav.labelAreas(), t.add(this.renoProps);
    let A = /* @__PURE__ */ new Set([
      this.sky,
      this.renoProps,
      this.rivalInterior,
      this.rivalLease,
      this.rivalSign,
      this.menuBoard,
      ...this.roofParts,
      ...this.ceiling,
      ...this.clickables,
      ...this.flags,
      ...this.crowns.map((a) => a.g)
    ]);
    for (let a of this.walls) A.add(a.full), a.short && A.add(a.short);
    batch(t, A);
    for (let a of [...this.roofParts, ...this.ceiling]) a.isMesh || batch(a);
    for (let a of this.crowns) batch(a.g);
    this.setTime(0);
  }
  initEnv(e) {
    let t = new THREE6.PMREMGenerator(e), o = new THREE6.Scene(), A = skyMaterial(), a = new THREE6.Mesh(new THREE6.SphereGeometry(100, 32, 16), A);
    o.add(a);
    let s = new THREE6.Mesh(new THREE6.CircleGeometry(90, 24).rotateX(-Math.PI / 2), new THREE6.MeshBasicMaterial({ color: "#77715f" }));
    s.position.y = -2, o.add(s);
    for (let r of [0, 0.45, 0.8, 1]) {
      this.setTime(r);
      for (let i of ["top", "bottom", "sunColor", "sunDir", "cover"]) {
        let l = this.skyMat.uniforms[i].value;
        A.uniforms[i].value = l.clone ? l.clone() : l;
      }
      s.material.color.set(r > 0.9 ? "#3a3530" : "#6f6a5a");
      let n = t.fromScene(o, 0.02);
      this.envMaps.push({ t: r, tex: n.texture, rt: n });
    }
    t.dispose(), a.geometry.dispose(), A.dispose(), s.geometry.dispose(), s.material.dispose(), this.setTime(this.t);
  }
  dispose() {
    let e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
    this.scene.traverse((A) => {
      let a = A;
      a.geometry && e.add(a.geometry);
      let s = Array.isArray(a.material) ? a.material : a.material ? [a.material] : [];
      for (let r of s) {
        t.add(r);
        for (let n of Object.values(r)) n && n.isTexture && o.add(n);
      }
    });
    for (let A of this.envMaps) A.rt.dispose();
    this.sun.shadow.dispose(), this.envMaps = [], this.scene.environment = null, e.forEach((A) => A.dispose()), t.forEach((A) => A.dispose()), o.forEach((A) => A.dispose()), this.scene.clear();
  }
  collider(e, t, o, A) {
    this.colliders.push({ x0: Math.min(e, o), z0: Math.min(t, A), x1: Math.max(e, o), z1: Math.max(t, A) });
  }
  box(e, t, o, A, a, s, r, n = this.scene, i = true) {
    let l = new THREE6.Mesh(new THREE6.BoxGeometry(e, t, o), typeof A == "string" ? mat(A) : A);
    return l.position.set(a, s + t / 2, r), l.castShadow = i, l.receiveShadow = true, n.add(l), l;
  }
  cyl(e, t, o, A, a, s, r, n = this.scene, i = 16) {
    let l = new THREE6.Mesh(new THREE6.CylinderGeometry(e, t, o, i), typeof A == "string" ? mat(A) : A);
    return l.position.set(a, s + o / 2, r), l.castShadow = true, l.receiveShadow = true, n.add(l), l;
  }
  solid(e, t, o, A, a, s, r = 0, n = this.scene) {
    return this.collider(a - e / 2, s - o / 2, a + e / 2, s + o / 2), this.box(e, t, o, A, a, r, s, n);
  }
  plane(e, t, o, A, a, s) {
    let r = new THREE6.Mesh(new THREE6.PlaneGeometry(e, t), o);
    return r.rotation.x = -Math.PI / 2, r.position.set(A, a, s), r.receiveShadow = true, this.scene.add(r), r;
  }
  wall(e, t, o, A, a, s, r, n = 0.2, i = 0) {
    let l = Math.abs(o - e) > Math.abs(A - t), u = Math.abs(l ? o - e : A - t), f = (e + o) / 2, g = (t + A) / 2, c = l ? u : n, v = l ? n : u, m = typeof s == "string" ? mat(s) : s, P = new THREE6.Mesh(i ? uvBox(c, a, v, i) : new THREE6.BoxGeometry(c, a, v), m);
    P.position.set(f, a / 2, g), P.castShadow = P.receiveShadow = true, this.scene.add(P);
    let h = this.box(c, 0.32, v, m, f, 0, g);
    return h.visible = false, this.collider(f - c / 2, g - v / 2, f + c / 2, g + v / 2), this.walls.push({ full: P, short: h, px: f, pz: g, nx: r[0], nz: r[1] }), P;
  }
  buildShop() {
    let e = this.opts, t = FACADE[e.business], o = 3.4, A = t.brick ? j.brick(t.wall) : j.plaster(t.wall), a = t.brick ? 1.75 : 2.2, s = new THREE6.MeshStandardMaterial({ color: t.paint, roughness: 0.9 }), r = mat(t.trim, 0.55), n = {
      restaurant: pbr(qs("#8a5a3a"), [5, 2.5], { rough: 0.55 }),
      coffee: pbr(qs("#6f4a32"), [5, 2.5], { rough: 0.6 }),
      bakery: pbr(mo("#f1e3cf", "#e0c6a3", 8), [3.5, 1.75], { rough: 0.45 }),
      convenience: pbr(mo("#eceeeb", "#dfe2de", 8), [3.5, 1.75], { rough: 0.35 }),
      barber: pbr(mo("#f2f2ef", "#262626", 8), [3.5, 1.75], { rough: 0.3 })
    }[e.business];
    this.plane(14, 7, n, 0, 5e-3, -2.5), this.plane(8.5, 7, pbr(mo("#c9ccc9", "#bec2bf", 8), [2.2, 1.8], { rough: 0.4 }), -2.75, 5e-3, -9.5), this.plane(5.5, 7, pbr(ll("#53626e"), [3, 3], { rough: 1 }), 4.25, 5e-3, -9.5), this.mapRects.push({ x0: -7, z0: -13, x1: 7, z1: 1, kind: "shop", label: "Your shop" }), this.shopOccluder = { x0: -7, z0: -13, x1: 7, z1: 1, h: 3.7 + this.floors * 3.1 };
    let i = (b, k) => {
      this.wall(b, -13, b, 1, o, A, [k, 0], 0.12, a);
      let z = this.box(0.08, o - 0.05, 14, s, b + k * 0.1, 0, -6);
      this.walls[this.walls.length - 1].full = groupOf(this.walls[this.walls.length - 1].full, z);
    };
    i(-7, 1), i(7, -1), this.wall(-7, -13, 7, -13, o, A, [0, 1], 0.12, a);
    let l = this.box(14, o - 0.05, 0.08, s, 0, 0, -12.9);
    this.walls[this.walls.length - 1].full = groupOf(this.walls[this.walls.length - 1].full, l);
    let u = mat(t.wainscot, 0.7);
    this.box(0.04, 0.9, 7, u, -6.84, 0, -2.5), this.box(0.04, 0.9, 7, u, 6.84, 0, -2.5);
    for (let [b, k, z, L] of [[-6.85, -9.5, 0.03, 7], [6.85, -9.5, 0.03, 7], [0, -12.85, 14, 0.03]]) this.box(z, 0.1, L, mat("#3a3330", 0.6), b, 0, k, this.scene, false);
    let f = new THREE6.Group();
    this.scene.add(f);
    let g = (b, k) => this.box(k - b, 0.55, 0.22, r, (b + k) / 2, 0, 0.9);
    g(-7, -1), g(1, 7), this.collider(-7, 0.79, -1, 1.01), this.collider(1, 0.79, 7, 1.01);
    for (let [b, k] of [[-7, -1], [1, 7]]) {
      let z = new THREE6.Mesh(new THREE6.BoxGeometry(k - b, 2.15, 0.04), this.glass);
      z.position.set((b + k) / 2, 0.55 + 1.075, 0.9), f.add(z);
      for (let L = b; L <= k + 0.01; L += (k - b) / 3) this.box(0.1, 2.2, 0.16, r, L, 0.55, 0.9, f);
      this.box(k - b, 0.08, 0.2, r, (b + k) / 2, 2.65, 0.9, f);
    }
    this.box(0.14, 2.75, 0.24, r, -1, 0, 0.9, f), this.box(0.14, 2.75, 0.24, r, 1, 0, 0.9, f);
    let c = new THREE6.Group();
    c.position.set(-0.93, 0, 0.82), c.rotation.y = -1.35, this.box(0.9, 2.3, 0.05, this.glass, 0.45, 0.05, 0, c), this.box(0.9, 0.12, 0.07, r, 0.45, 0.05, 0, c), this.box(0.9, 0.12, 0.07, r, 0.45, 2.25, 0, c), this.box(0.05, 0.3, 0.05, mat("#c9b48a", 0.3, 0.8), 0.8, 1.05, 0.05, c), f.add(c);
    let v = new THREE6.Mesh(uvBox(14.2, o - 2.73, 0.26, a), A);
    v.position.set(0, 2.73 + (o - 2.73) / 2, 0.92), v.castShadow = true, f.add(v);
    let m = signTexture(e.shopName, e.accent, "#fffaf0", { sub: e.tagline }), P = new THREE6.Mesh(new THREE6.PlaneGeometry(9, 0.62), new THREE6.MeshStandardMaterial({ map: m, roughness: 0.5, emissive: "#ffffff", emissiveMap: m, emissiveIntensity: 0 }));
    P.position.set(0, 3.06, 1.07), f.add(P), this.userSign = P.material;
    let h = new THREE6.MeshStandardMaterial({ map: stripeTexture(e.accent, "#f6f1e6", 10), roughness: 0.9, side: THREE6.DoubleSide });
    for (let b of [-4, 4]) {
      let k = new THREE6.Mesh(new THREE6.PlaneGeometry(5.6, 1.5), h);
      k.position.set(b, 2.42, 1.62), k.rotation.x = -Math.PI / 2 + 0.55, k.castShadow = true, f.add(k);
    }
    this.walls.push({ full: f, px: 0, pz: 0.9, nx: 0, nz: -1 });
    let w = 3.2;
    this.wall(-7, -6, -2.2, -6, w, s, [0, 1], 0.16), this.wall(-0.7, -6, 3.5, -6, w, s, [0, 1], 0.16), this.wall(5, -6, 7, -6, w, s, [0, 1], 0.16), this.wall(1.5, -13, 1.5, -6, w, s, [1, 0], 0.16);
    let B = new THREE6.Group();
    this.scene.add(B), this.box(1.5, w - 2.4, 0.16, s, -1.45, 2.4, -6, B), this.box(1.5, w - 2.4, 0.16, s, 4.25, 2.4, -6, B);
    let C = mat("#9aa3aa", 0.35, 0.6);
    this.box(0.7, 1.3, 0.04, C, -1.82, 0.5, -6.25, B).rotation.y = 0.9, this.box(0.7, 1.3, 0.04, C, -1.08, 0.5, -6.25, B).rotation.y = -0.9, this.walls.push({ full: B, px: 0, pz: -6, nx: 0, nz: 1 });
    let x = new THREE6.Group();
    this.scene.add(x);
    let S = new THREE6.MeshStandardMaterial({ color: "#f2efe8", roughness: 0.95, side: THREE6.DoubleSide }), X = new THREE6.Mesh(new THREE6.PlaneGeometry(14, 14), S);
    X.rotation.x = Math.PI / 2, X.position.set(0, o - 0.02, -6), x.add(X);
    for (let [b, k] of [[-3.5, -2.5], [3.5, -2.5], [-3, -9.5], [4.2, -9.5], [0, -0.5]]) {
      let z = new THREE6.Mesh(new THREE6.CylinderGeometry(0.25, 0.25, 0.04, 16), this.bulbMat);
      z.position.set(b, o - 0.05, k), x.add(z);
    }
    if (e.business === "restaurant" || e.business === "coffee" || e.business === "bakery") for (let [b, k] of [[2.4, -4.3], [4.8, -4.3], [2.4, -1.8], [4.8, -1.8]]) {
      let z = new THREE6.Mesh(new THREE6.CylinderGeometry(8e-3, 8e-3, 1, 4), mat("#222", 0.5));
      z.position.set(b, o - 0.5, k), x.add(z);
      let L = new THREE6.Mesh(new THREE6.ConeGeometry(0.22, 0.25, 16, 1, true), new THREE6.MeshStandardMaterial({ color: "#2b2b2b", roughness: 0.5, metalness: 0.5, side: THREE6.DoubleSide }));
      L.position.set(b, o - 1.1, k), x.add(L);
      let ee = new THREE6.Mesh(new THREE6.SphereGeometry(0.06, 10, 8), this.bulbMat);
      ee.position.set(b, o - 1.18, k), x.add(ee);
    }
    this.ceiling.push(x);
    let R = new THREE6.Group();
    if (this.scene.add(R), this.box(14.4, 0.3, 14.4, mat("#5f5b56", 0.95), 0, o, -6, R), this.floors > 0) {
      let b = this.floors * 3.1, k = new THREE6.Mesh(uvBox(14.2, b, 14.2, a), A);
      k.position.set(0, o + 0.3 + b / 2, -6), k.castShadow = k.receiveShadow = true, R.add(k);
      let z = mat("#e9e3d6", 0.6);
      for (let L = 0; L < this.floors; L++) for (let ee = 0; ee < 4; ee++) {
        let U = -5.1 + ee * 3.4, Y = (ee + L) % 3 === 0, q = o + 0.95 + L * 3.1;
        this.box(1.3, 1.65, 0.04, Y ? this.windowLit : this.windowDark, U, q, 1.11, R, false), this.box(1.5, 0.08, 0.1, z, U, q + 1.65, 1.14, R, false), this.box(1.55, 0.07, 0.18, z, U, q - 0.07, 1.16, R, false), this.box(0.07, 1.65, 0.08, z, U - 0.68, q, 1.13, R, false), this.box(0.07, 1.65, 0.08, z, U + 0.68, q, 1.13, R, false);
      }
      this.box(14.6, 0.35, 14.6, mat("#e9e3d6", 0.6), 0, o + 0.3 + b, -6, R);
    } else {
      let b = new THREE6.Mesh(uvBox(14.4, 0.6, 0.25, a), A);
      b.position.set(0, o + 0.6, 1.08), R.add(b), this.box(2.2, 1, 1.6, mat("#a4a8ab", 0.45, 0.5), 3.5, o + 0.3, -9, R);
    }
    this.roofParts.push(R), this.buildFrontOfHouse(r), this.buildBackOfHouse(), this.buildOffice();
    for (let [b, k, z] of [[-1, -2.8, 1], [4.2, -9.5, 1]]) {
      let L = new THREE6.PointLight("#ffd8a8", 0, 12, 1.5);
      L.visible = !!z, L.position.set(b, 3, k), this.scene.add(L), this.interiorLights.push(L);
    }
    for (let b of [-8, 8]) this.box(2, 2.6, 0.3, j.brick("#7a4c3c"), b, 0, 0.6), this.collider(b - 1, -14.5, b + 1, 0.75), this.box(1.6, 1.1, 0.9, mat("#3f6b4f", 0.55, 0.3), b, 0, -0.3);
    this.anchors.door = { x: 0, z: 1.4, r: 1.2 }, this.spots.street.push({ x: -4.2, z: 3.25, h: 0 }, { x: 4.2, z: 3.25, h: 0 }, { x: -2.4, z: 3.35, h: 0 }, { x: 2.4, z: 3.35, h: 0 }), this.spots.inside.push({ x: 0.3, z: -1.6, h: Math.PI }, { x: -0.8, z: -4.8, h: 0.4 }, { x: 0.6, z: -3.4, h: -0.6 }, { x: -1.3, z: -0.5, h: 2.6 }), this.spots.back.push({ x: -0.8, z: -8, h: 2.4 }, { x: -5.3, z: -10, h: Math.PI }, { x: -0.7, z: -10.9, h: -2.2 }, { x: -4.6, z: -7.4, h: 2.8 }), this.spots.office.push({ x: 2.5, z: -8, h: 2.6 }, { x: 6.1, z: -7.5, h: -2.6 }, { x: 2.4, z: -11.2, h: 1.6 }, { x: 6.2, z: -12, h: -1.2 });
  }
  buildRivalFront() {
    let e = mat("#2c2a28", 0.6);
    this.box(13, 0.5, 0.2, e, 0, 0, 14.9);
    let t = new THREE6.Mesh(new THREE6.BoxGeometry(12.6, 2.2, 0.05), this.glass);
    t.position.set(0, 1.6, 14.92), this.scene.add(t);
    for (let a = -6.3; a <= 6.31; a += 2.1) this.box(0.09, 2.3, 0.1, e, a, 0.5, 14.92);
    this.box(13.4, 0.9, 0.14, e, 0, 2.75, 14.93), this.rivalInterior = new THREE6.Group(), this.scene.add(this.rivalInterior), this.box(13.4, 0.02, 3, mat("#d9cfbf", 0.8), 0, 0.01, 16.6, this.rivalInterior, false);
    let o = mat("#3a3a3a", 0.5);
    for (let a of [-4, 0, 4]) this.box(1.2, 0.9, 0.7, o, a, 0, 16.5, this.rivalInterior);
    this.rivalSign = new THREE6.Mesh(new THREE6.PlaneGeometry(9, 0.66), new THREE6.MeshStandardMaterial({ roughness: 0.6 })), this.rivalSign.position.set(0, 3.2, 14.84), this.rivalSign.rotation.y = Math.PI, this.scene.add(this.rivalSign), this.rivalLease = new THREE6.Group(), this.scene.add(this.rivalLease);
    let A = new THREE6.MeshStandardMaterial({ map: paperTexture("FOR LEASE", "Call 555-0142"), roughness: 0.9 });
    for (let a of [-3.5, 3.5]) {
      let s = new THREE6.Mesh(new THREE6.PlaneGeometry(1.2, 1.2), A);
      s.position.set(a, 1.6, 14.88), s.rotation.y = Math.PI, this.rivalLease.add(s);
    }
    this.anchors.rival = { x: 0, z: 13.4, r: 2, mesh: t }, this.clickables.push(t), this.setRival(null);
  }
  buildFrontOfHouse(e) {
    let t = this.opts, o = t.business, A = mat(o === "convenience" ? "#e8e9ea" : o === "barber" ? "#2b2b2e" : "#6b4a33", 0.7), a = mat(o === "convenience" ? "#cfd3d6" : o === "barber" ? "#d8d2c6" : "#d8c7a6", 0.5);
    if (o === "bakery") {
      this.solid(4.2, 0.55, 0.8, A, -4.5, -4);
      let g = new THREE6.Mesh(new THREE6.BoxGeometry(4.1, 0.55, 0.75), this.glass);
      g.position.set(-4.5, 0.55 + 0.275, -4), this.scene.add(g), this.box(4.2, 0.05, 0.8, a, -4.5, 1.1, -4);
      let c = ["#d9a066", "#c47b3e", "#f0d7a8", "#8b4a2b", "#e8b86a", "#f3e2c4"];
      for (let v = 0; v < 14; v++) {
        let m = mat(c[v % c.length], 0.7), P = new THREE6.Mesh(new THREE6.SphereGeometry(0.09, 10, 8), m);
        P.scale.y = 0.6, P.position.set(-6.3 + v % 7 * 0.55, 0.62 + Math.floor(v / 7) * 0.25, -4 + v % 2 * 0.15), this.scene.add(P);
      }
    } else this.solid(4.2, 1, 0.8, A, -4.5, -4), this.box(4.36, 0.07, 0.92, a, -4.5, 1, -4);
    this.box(0.45, 0.22, 0.38, mat("#2c2f33", 0.4, 0.3), -2.95, 1.07, -4.05);
    let s = this.box(0.36, 0.26, 0.04, mat("#1b2836", 0.2, 0.2), -2.95, 1.3, -4.2);
    s.material = new THREE6.MeshStandardMaterial({ color: "#2a4a63", emissive: "#4f8fc0", emissiveIntensity: 0.5 }), this.anchors.register = { x: -2.7, z: -3.6, r: 1.25, mesh: s }, this.clickables.push(s);
    let r = mat("#7a5a40", 0.8);
    this.solid(4.2, 1.8, 0.4, r, -4.5, -5.7);
    let n = ["#c9463d", "#e0b04a", "#4a8bc9", "#59a36b", "#e7e2d6", "#8a5a3a", "#d77b4a"];
    for (let g = 0; g < 3; g++) for (let c = 0; c < 9; c++) this.box(0.3, 0.32, 0.25, n[(c * 3 + g) % n.length], -6.3 + c * 0.45, 0.25 + g * 0.55, -5.62, this.scene, false);
    if (this.menuBoard = new THREE6.Mesh(new THREE6.PlaneGeometry(3.6, 1.8), new THREE6.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 })), this.menuBoard.position.set(-4.5, 2.65, -5.88), this.scene.add(this.menuBoard), this.anchors.menu = { x: -4.6, z: -2.9, r: 1, mesh: this.menuBoard }, this.clickables.push(this.menuBoard), o === "coffee") {
      let g = this.box(0.7, 0.5, 0.45, mat("#b9bdc1", 0.25, 0.8), -5.6, 1.07, -4.05);
      this.box(0.2, 0.08, 0.2, "#1e1e1e", -5.6, 1.57, -4.05, this.scene, false);
    }
    this.staffSpots.push({ x: -5.6, z: -4.95, h: 0 }, { x: -4.2, z: -4.95, h: 0 }, { x: -3, z: -4.95, h: 0 });
    for (let g = 0; g < 4; g++) this.queue.push({ x: -2.95, z: -3 + g * 0.8 });
    let i = (g, c, v, m = 0.47, P = true) => {
      let h = g + Math.sin(v) * -0.7, w = c + Math.cos(v) * -0.7;
      this.seats.push({ x: g, z: c, h: v, y: m, sit: P, taken: false, approach: { x: h, z: w } });
    }, l = (g, c, v, m) => {
      let P = new THREE6.Group();
      P.position.set(g, 0, c), P.rotation.y = v, this.scene.add(P);
      let h = mat(m, 0.7);
      this.box(0.46, 0.06, 0.46, h, 0, 0.44, 0, P), this.box(0.46, 0.5, 0.06, h, 0, 0.48, -0.22, P);
      for (let [w, B] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) this.box(0.05, 0.44, 0.05, h, w, 0, B, P, false);
    };
    if (o === "restaurant" || o === "bakery" || o === "coffee") {
      let g = o === "restaurant" ? [[2.4, -4.3], [5.3, -4.3], [2.4, -1.6], [5.3, -1.6]] : o === "bakery" ? [[2.6, -4.2], [5.2, -4.2], [3.9, -1.5]] : [[2.2, -4.4], [4.6, -4.4], [2.2, -2], [4.6, -2]], c = mat(o === "restaurant" ? "#f4efe6" : "#e9e3d8", 0.9);
      for (let [v, m] of g) {
        o === "restaurant" ? (this.solid(1, 0.74, 1, mat("#5a3b2b", 0.7), v, m), this.box(1.1, 0.04, 1.1, c, v, 0.74, m), this.cyl(0.04, 0.05, 0.22, mat(t.accent, 0.5), v, 0.78, m)) : (this.collider(v - 0.4, m - 0.4, v + 0.4, m + 0.4), this.cyl(0.45, 0.45, 0.05, a, v, 0.72, m), this.cyl(0.06, 0.08, 0.72, mat("#2c2c2c", 0.5, 0.4), v, 0, m, this.scene, 10), this.cyl(0.05, 0.04, 0.1, "#f2efe8", v + 0.12, 0.77, m, this.scene, 10));
        let P = o === "restaurant" ? "#6b4a33" : o === "coffee" ? "#3c3c3c" : "#c9a27a";
        l(v - 0.78, m, Math.PI / 2, P), l(v + 0.78, m, -Math.PI / 2, P), i(v - 0.72, m, Math.PI / 2), i(v + 0.72, m, -Math.PI / 2);
      }
      if (o === "coffee") {
        let v = mat("#8a4f3a", 0.95);
        this.solid(0.8, 0.45, 2.6, v, 6.35, -0.9), this.box(0.25, 0.85, 2.6, v, 6.65, 0, -0.9), i(6.2, -1.5, -Math.PI / 2, 0.5), i(6.2, -0.3, -Math.PI / 2, 0.5);
      }
    } else if (o === "convenience") {
      let g = mat("#dfe3e6", 0.6, 0.2), c = ["#d94a3a", "#f0c23c", "#3d8fd6", "#4caf6a", "#ffffff", "#ff8a3d", "#8a4fbf", "#2b2b2b"];
      for (let m of [2, 4]) {
        this.solid(0.7, 1.55, 3.6, g, m, -3.2);
        for (let P = 0; P < 3; P++) for (let h = 0; h < 7; h++) for (let w of [-0.36, 0.36]) this.box(0.08, 0.3, 0.4, c[(h + P * 2 + (w > 0 ? 3 : 0)) % c.length], m + w, 0.2 + P * 0.48, -4.7 + h * 0.5, this.scene, false);
      }
      let v = new THREE6.MeshStandardMaterial({ color: "#dbe9f2", emissive: "#bfe3ff", emissiveIntensity: 0.35, roughness: 0.2 });
      this.solid(0.6, 2.2, 5, mat("#cfd5da", 0.5, 0.3), 6.6, -3), this.box(0.04, 1.9, 4.8, v, 6.28, 0.15, -3, this.scene, false);
      for (let m of [-4.7, -3, -1.3]) this.seats.push({
        x: 5.6,
        z: m,
        h: Math.PI / 2,
        y: 0,
        sit: false,
        taken: false,
        approach: { x: 5.4, z: m }
      });
      for (let m of [-4.2, -2.4]) for (let P of [3, 1]) this.seats.push({
        x: P,
        z: m,
        h: P === 3 ? Math.PI / 2 : -Math.PI / 2,
        y: 0,
        sit: false,
        taken: false,
        approach: { x: P, z: m }
      });
    } else if (o === "barber") {
      let g = new THREE6.MeshStandardMaterial({ color: "#d6e2ea", roughness: 0.05, metalness: 0.9 });
      for (let v of [-4.8, -2.9, -1]) {
        let m = new THREE6.Group();
        m.position.set(5.7, 0, v), m.rotation.y = Math.PI / 2, this.scene.add(m), this.cyl(0.25, 0.32, 0.4, mat("#9ea4a9", 0.3, 0.8), 0, 0, 0, m), this.box(0.62, 0.14, 0.62, mat("#7a1f24", 0.5), 0, 0.42, 0, m), this.box(0.62, 0.7, 0.12, mat("#7a1f24", 0.5), 0, 0.5, -0.3, m), this.collider(5.45, v - 0.3, 5.95, v + 0.3), this.box(0.04, 1.3, 1.1, g, 6.86, 1, v, this.scene, false), this.box(0.3, 0.06, 1.2, mat("#2b2b2e", 0.5), 6.75, 0.95, v), this.seats.push({
          x: 5.7,
          z: v,
          h: Math.PI / 2,
          y: 0.56,
          sit: true,
          taken: false,
          approach: { x: 5, z: v }
        });
      }
      let c = new THREE6.MeshStandardMaterial({ map: stripeTexture("#c8312e", "#f6f1e6", 6), roughness: 0.4 });
      c.map.rotation = 0.6, this.cyl(0.12, 0.12, 0.9, c, 1.4, 1.2, 1.15), this.solid(2.6, 0.45, 0.55, mat("#3b3b3f", 0.6), 3, 0.2), this.seats.push({
        x: 2.4,
        z: 0.2,
        h: Math.PI,
        y: 0.48,
        sit: true,
        taken: false,
        approach: { x: 2.4, z: -0.5 }
      }), this.seats.push({
        x: 3.6,
        z: 0.2,
        h: Math.PI,
        y: 0.48,
        sit: true,
        taken: false,
        approach: { x: 3.6, z: -0.5 }
      });
    }
    let u = mat("#b4673f", 0.8), f = new THREE6.MeshStandardMaterial({ color: "#4f8a4a", roughness: 0.9, flatShading: true });
    for (let [g, c] of [[-6.4, 0.2], [6.4, 0.25]]) {
      if (o === "barber" && g > 0) continue;
      this.cyl(0.22, 0.17, 0.42, u, g, 0, c);
      let v = new THREE6.Mesh(new THREE6.IcosahedronGeometry(0.42, 0), f);
      v.position.set(g, 0.8, c), v.castShadow = true, this.scene.add(v), this.collider(g - 0.25, c - 0.25, g + 0.25, c + 0.25);
    }
  }
  buildBackOfHouse() {
    let e = this.opts.business, t = mat("#b3b9bf", 0.35, 0.6);
    if (this.solid(8, 0.92, 0.7, t, -2.8, -12.5), e === "restaurant" || e === "coffee") {
      this.box(1.4, 0.95, 0.72, mat("#2d3034", 0.5, 0.4), -5.6, 0, -12.5);
      for (let [r, n] of [[-0.35, -0.15], [0.35, -0.15], [-0.35, 0.15], [0.35, 0.15]]) this.cyl(0.14, 0.14, 0.03, "#141414", -5.6 + r, 0.95, -12.5 + n, this.scene, 12);
      this.box(1.6, 0.6, 0.9, t, -5.6, 2.3, -12.45), this.cyl(0.18, 0.2, 0.3, mat("#9aa0a6", 0.3, 0.8), -5.25, 0.98, -12.4, this.scene, 12);
    } else if (e === "bakery") {
      this.box(2, 1.9, 0.9, mat("#3a3b3e", 0.5, 0.4), -5.5, 0, -12.4);
      for (let r of [0.5, 1.1]) this.box(1.6, 0.36, 0.05, new THREE6.MeshStandardMaterial({ color: "#ff9a4a", emissive: "#ff7a2a", emissiveIntensity: 0.8 }), -5.5, r, -11.94, this.scene, false);
    } else e === "barber" && (this.box(0.8, 0.9, 0.7, mat("#eeeeee", 0.4), -5.8, 0, -12.5), this.box(0.8, 0.9, 0.7, mat("#eeeeee", 0.4), -4.9, 0, -12.5));
    this.box(1, 0.06, 0.55, mat("#6f767c", 0.2, 0.7), -1.8, 0.89, -12.45, this.scene, false);
    let o = this.cyl(0.03, 0.03, 0.35, mat("#c9cdd2", 0.2, 0.9), -1.8, 0.92, -12.72);
    this.anchors.sink = { x: -1.8, z: -11.6, r: 1.25, mesh: o }, this.clickables.push(o);
    let A = this.solid(1.9, 0.92, 0.95, t, -3, -9.3);
    this.box(0.5, 0.04, 0.35, mat("#c99a63", 0.7), -3.4, 0.92, -9.3), this.box(0.35, 0.18, 0.35, mat("#e6e2d8", 0.6), -2.6, 0.92, -9.2), this.anchors.prep = { x: -3, z: -9.3, r: 1.6, mesh: A }, this.clickables.push(A);
    let a = mat("#8d949a", 0.5, 0.5);
    this.solid(0.5, 2.1, 4, a, -6.65, -9);
    let s = ["#c8a77a", "#b8946a", "#d4b98e", "#a98a63"];
    for (let r = 0; r < 4; r++) for (let n = 0; n < 6; n++) this.box(0.38, 0.32, 0.5, s[(r + n) % 4], -6.62, 0.1 + r * 0.52, -10.6 + n * 0.62, this.scene, false);
    this.solid(1.1, 2.1, 0.8, mat("#d9dde0", 0.3, 0.4), 0.7, -6.7), this.backStaffSpots.push({ x: -3, z: -10.4, h: 0 }, { x: -5, z: -11.6, h: Math.PI });
  }
  buildOffice() {
    let e = mat("#7a5638", 0.6), t = this.solid(2, 0.76, 0.85, e, 4.4, -10.6);
    this.box(0.7, 0.45, 0.05, mat("#1f2328", 0.3), 4.4, 0.8, -10.35);
    let o = this.box(0.62, 0.36, 0.02, new THREE6.MeshStandardMaterial({ color: "#203040", emissive: "#3d7bb0", emissiveIntensity: 0.6 }), 4.4, 0.86, -10.39);
    o.rotation.y = Math.PI, this.box(0.5, 0.03, 0.18, "#2a2a2a", 4.4, 0.77, -10.75, this.scene, false), this.anchors.desk = { x: 4.4, z: -11.3, r: 1.3, mesh: t }, this.clickables.push(t), this.cyl(0.26, 0.26, 0.1, "#2c2c30", 4.4, 0.42, -11.55), this.box(0.5, 0.6, 0.08, mat("#2c2c30", 0.6), 4.4, 0.5, -11.85), this.cyl(0.24, 0.24, 0.08, mat("#3a6670", 0.8), 4.4, 0.42, -9.45), this.anchors.priya = { x: 4.4, z: -9.4, r: 1.3 }, this.solid(0.6, 1.3, 1.2, mat("#7c8a93", 0.5, 0.4), 6.6, -12.3), this.solid(0.4, 2, 2.2, e, 6.75, -9);
    for (let n = 0; n < 4; n++) for (let i = 0; i < 6; i++) this.box(0.25, 0.32, 0.1, ["#9b3d3d", "#3b5f8c", "#d1c4a8", "#3f7a5a"][(n + i) % 4], 6.65, 0.15 + n * 0.48, -9.9 + i * 0.33, this.scene, false);
    this.solid(0.6, 0.7, 0.6, mat("#3a3d42", 0.4, 0.7), 2.1, -12.4);
    let A = new THREE6.MeshStandardMaterial({ color: "#4f8a4a", roughness: 0.9, flatShading: true });
    this.cyl(0.2, 0.15, 0.4, mat("#b4673f", 0.8), 2.1, 0, -6.6);
    let a = new THREE6.Mesh(new THREE6.IcosahedronGeometry(0.38, 0), A);
    a.position.set(2.1, 0.75, -6.6), this.scene.add(a);
    let s = new THREE6.Mesh(new THREE6.PlaneGeometry(2.2, 1.2), new THREE6.MeshStandardMaterial({ color: "#8fb8d6", emissive: "#6f9fc4", emissiveIntensity: 0.25, roughness: 0.2 }));
    s.position.set(4.4, 1.9, -12.84), this.scene.add(s);
    let r = mat("#f4f1ea", 0.6);
    this.box(2.4, 0.1, 0.06, r, 4.4, 1.25, -12.83, this.scene, false), this.box(2.4, 0.1, 0.06, r, 4.4, 2.5, -12.83, this.scene, false), this.box(0.08, 1.3, 0.06, r, 4.4, 1.25, -12.82, this.scene, false), this.box(0.1, 1.35, 0.06, r, 3.2, 1.22, -12.83, this.scene, false), this.box(0.1, 1.35, 0.06, r, 5.6, 1.22, -12.83, this.scene, false), this.box(0.5, 0.36, 0.03, mat("#2b2b2b", 0.5), 2.8, 1.8, -12.84, this.scene, false), this.box(0.4, 0.26, 0.02, mat("#8fb38a", 0.8), 2.8, 1.85, -12.82, this.scene, false);
  }
  setShopName(e) {
    let t = this.userSign;
    if (!t) return;
    t.map?.dispose();
    let o = signTexture(e, this.opts.accent, "#fffaf0", { sub: this.opts.tagline });
    t.map = o, t.emissiveMap = o, t.needsUpdate = true;
  }
  setRival(e) {
    let t = this.rivalSign.material;
    t.map?.dispose(), t.map = e ? signTexture(e, "#3a1f22", "#f2d7a0", { sub: "Now open" }) : signTexture("", "#2c2a28", "#2c2a28"), t.needsUpdate = true, this.rivalLease.visible = !e, this.rivalInterior.visible = !!e;
  }
  setMenu(e, t, o) {
    let A = this.menuBoard.material;
    A.map?.dispose(), A.map = menuBoardTexture(e, t, o, this.opts.accent === "#3d9be9" ? "#7cc4ff" : "#f2c86b"), A.needsUpdate = true;
  }
  setRenovating(e) {
    if (this.renoProps.clear(), !e) return;
    let t = mat("#ff7a2a", 0.6);
    for (let A of [-5.5, -3, 3, 5.5]) {
      let a = new THREE6.Mesh(new THREE6.ConeGeometry(0.2, 0.6, 14), t);
      a.position.set(A, 0.3, 3.3), a.castShadow = true, this.renoProps.add(a);
    }
    let o = new THREE6.Mesh(new THREE6.PlaneGeometry(1.4, 0.9), new THREE6.MeshStandardMaterial({ map: paperTexture("PARDON", "our dust \xB7 reno"), roughness: 0.9 }));
    o.position.set(-2.2, 1.2, 3), this.renoProps.add(o), this.box(0.08, 0.8, 0.08, "#6b4a33", -2.2, 0, 2.98, this.renoProps);
  }
  setSeason(e) {
    let t = e === 12 || e <= 2 ? "winter" : e <= 5 ? "spring" : e <= 8 ? "summer" : "autumn", o = {
      spring: ["#6aa04e", "#86b45a", "#d99ab0"],
      summer: ["#4f8a3c", "#5f9a45", "#467d36"],
      autumn: ["#c9772f", "#b8452c", "#d9a23a"],
      winter: ["#8c9a8c", "#a7b2ab", "#7f8a83"]
    };
    if (this.foliage.forEach((A, a) => A.color.set(o[t][a % 3])), this.hedgeMat.color.set(t === "winter" ? "#6f7f6a" : t === "autumn" ? "#6b7a3a" : "#4d7a3f"), j.grass().color.set(t === "winter" ? "#d9dfe0" : t === "autumn" ? "#c9b98a" : "#ffffff"), this.skyMat.uniforms.cover.value = t === "winter" ? 0.62 : t === "autumn" ? 0.5 : 0.4, this.snow && (this.snow.removeFromParent(), this.snow = null), t === "winter") {
      let A = new Float32Array(6600);
      for (let s = 0; s < 2200; s++) A[s * 3] = (Math.random() - 0.5) * 70, A[s * 3 + 1] = Math.random() * 20, A[s * 3 + 2] = (Math.random() - 0.5) * 70;
      let a = new THREE6.BufferGeometry();
      a.setAttribute("position", new THREE6.BufferAttribute(A, 3)), this.snow = new THREE6.Points(a, new THREE6.PointsMaterial({ color: "#ffffff", size: 0.07, transparent: true, opacity: 0.85, depthWrite: false })), this.snow.frustumCulled = false, this.scene.add(this.snow);
    }
  }
  setTime(e) {
    this.t = e;
    let t = [
      {
        t: 0,
        top: "#7fb0e2",
        bottom: "#f2e2cf",
        sun: "#ffd9ae",
        si: 2.6,
        hemi: 0.35,
        el: 0.38,
        az: 1.05,
        env: 0.85
      },
      {
        t: 0.45,
        top: "#4f8fd8",
        bottom: "#d9e7f1",
        sun: "#fff4e4",
        si: 3.4,
        hemi: 0.4,
        el: 0.95,
        az: 0.15,
        env: 1
      },
      {
        t: 0.8,
        top: "#6787bf",
        bottom: "#f0c49a",
        sun: "#ffc08a",
        si: 2.6,
        hemi: 0.32,
        el: 0.42,
        az: -0.75,
        env: 0.85
      },
      {
        t: 1,
        top: "#1f2d55",
        bottom: "#e48f62",
        sun: "#ff8c52",
        si: 1.3,
        hemi: 0.18,
        el: 0.12,
        az: -1.1,
        env: 0.55
      }
    ], o = 0;
    for (; o < t.length - 2 && e > t[o + 1].t; ) o++;
    let A = t[o], a = t[o + 1], s = Math.max(0, Math.min(1, (e - A.t) / (a.t - A.t))), r = (u, f) => u + (f - u) * s, n = (u, f) => new THREE6.Color(u).lerp(new THREE6.Color(f), s), i = this.skyMat.uniforms;
    if (i.top.value.copy(n(A.top, a.top)), i.bottom.value.copy(n(A.bottom, a.bottom)), i.sunColor.value.copy(n(A.sun, a.sun)), this.scene.fog.color.copy(n(A.bottom, a.bottom)).lerp(n(A.top, a.top), 0.2), this.sun.color.copy(n(A.sun, a.sun)), this.sun.intensity = r(A.si, a.si), this.hemi.intensity = r(A.hemi, a.hemi), this.sunEl = r(A.el, a.el), this.sunAz = r(A.az, a.az), i.sunDir.value.set(Math.sin(this.sunAz) * Math.cos(this.sunEl), Math.sin(this.sunEl), Math.cos(this.sunAz) * Math.cos(this.sunEl)).normalize(), this.envMaps.length) {
      let u = this.envMaps[0];
      for (let f of this.envMaps) Math.abs(f.t - e) < Math.abs(u.t - e) && (u = f);
      this.scene.environment = u.tex;
    }
    this.envIntensity = r(A.env, a.env);
    let l = Math.max(0, (e - 0.72) / 0.28);
    this.bulbMat.emissiveIntensity = 0.4 + l * 2.6, this.windowLit.emissiveIntensity = l * 1.5, this.shopGlassOut.emissiveIntensity = l * 0.35;
    for (let u of this.streetLights) u.intensity = l * 30;
    for (let u of this.interiorLights) u.intensity = (this.firstPerson ? 7 : 3) + l * 8;
    this.userSign && (this.userSign.emissiveIntensity = l * 0.6);
    for (let u of this.signMats) u.emissiveIntensity = l * 0.45;
  }
  setSignals(e, t) {
    for (let o of this.signals) {
      let A = o.axis === "main" ? e : t;
      o.r.emissiveIntensity = A === "r" ? 3 : 0.04, o.y.emissiveIntensity = A === "y" ? 3 : 0.04, o.g.emissiveIntensity = A === "g" ? 3 : 0.04;
    }
  }
  update(e, t, o, A, a) {
    this.clock += e;
    let s = 60;
    this.sun.position.set(t.x + Math.sin(this.sunAz) * Math.cos(this.sunEl) * s, Math.sin(this.sunEl) * s, t.z + Math.cos(this.sunAz) * Math.cos(this.sunEl) * s), this.sun.target.position.copy(t), this.sky.position.copy(o), this.skyMat.uniforms.time.value = this.clock;
    let r = A && !this.firstPerson;
    if (r !== this.cutaway) {
      this.cutaway = r;
      for (let f of this.roofParts) f.visible = !r;
      for (let f of this.ceiling) f.visible = !r;
    }
    for (let f of this.walls) {
      let g = false;
      if (r) {
        let c = (o.x - f.px) * f.nx + (o.z - f.pz) * f.nz, v = (a.x - f.px) * f.nx + (a.z - f.pz) * f.nz;
        g = Math.sign(c) !== Math.sign(v);
      }
      f.full.visible = !g, f.short && (f.short.visible = g);
    }
    if (this.snow) {
      let f = this.snow.geometry.attributes.position;
      for (let g = 0; g < f.count; g++) {
        let c = f.getY(g) - e * 1.3;
        c < 0 && (c += 20), f.setY(g, c), f.setX(g, f.getX(g) + Math.sin(c + g) * e * 0.2);
      }
      f.needsUpdate = true, this.snow.position.set(t.x, 0, t.z);
    }
    let n = t.x - o.x, i = t.y - o.y, l = t.z - o.z, u = n * n + i * i + l * l || 1;
    for (let f of this.crowns) {
      if (this.firstPerson) {
        f.g.visible = true;
        continue;
      }
      let g = Math.max(0, Math.min(1, ((f.x - o.x) * n + (f.y - o.y) * i + (f.z - o.z) * l) / u)), c = o.x + n * g - f.x, v = o.y + i * g - f.y, m = o.z + l * g - f.z;
      f.g.visible = !(g < 0.92 && c * c + v * v + m * m < f.r * f.r);
    }
    for (let f of this.flags) f.rotation.y = Math.sin(this.clock * 2.1) * 0.25;
  }
};
function groupOf(a, b) {
  let g = new THREE6.Group();
  return a.parent?.add(g), g.add(a, b), g;
}
var $ = (id) => document.getElementById(id), money = (n) => {
  let r = Math.round(n);
  return (r < 0 ? "\u2212$" : "$") + Math.abs(r).toLocaleString("en-US");
}, signed = (n) => (n >= 0 ? "+" : "") + money(n).replace("\u2212", "\u2212"), esc = (s) => s.replace(/[&<>"]/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c2]), clean = (s) => s.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "").trim();
function Oe(s) {
  $("monthOf").textContent = `Month ${Math.min(s.month + 1, s.maxMonths)} of ${s.maxMonths}`, $("date").textContent = `${monthName(s.month + 1)} \xB7 Yr ${yearOf(s.month + 1)}`;
  let c2 = $("cash");
  c2.textContent = money(s.cash), c2.classList.toggle("neg", s.cash < 0), $("rep").textContent = String(Math.round(s.reputation));
  let e = $("energy");
  e.style.width = `${Math.max(0, Math.min(100, s.energy))}%`, e.style.background = s.energy < 25 ? "var(--loss)" : s.energy < 50 ? "var(--alert)" : "var(--cash)", $("ap").textContent = String(s.ap), Pf(s);
}
function renderTasks(items, title) {
  $("tasksTitle").textContent = title;
  let ol = $("taskList");
  ol.innerHTML = "";
  for (let it of items) {
    let li = document.createElement("li");
    it.done && (li.className = "done"), it.final && (li.className = "final"), li.innerHTML = `<span class="dot"></span><span>${esc(it.label)}</span><span class="where">${esc(it.where)}</span>`, it.onClick && !it.done && li.addEventListener("click", it.onClick), ol.appendChild(li);
  }
}
function toast(text, kind = "") {
  let box = $("toasts"), t = document.createElement("div");
  for (t.className = `toast ${kind}`, t.textContent = clean(text), box.appendChild(t); box.children.length > 3; ) box.firstChild.remove();
  setTimeout(() => t.remove(), 6500);
}
var slateTimer = 0;
function slate(title, text, ms = 9e3) {
  let el = $("slate");
  el.innerHTML = `<span class="lbl">${esc(title)}</span><p>${esc(text)}</p><span class="lbl">Tap to dismiss</span>`, el.hidden = false, clearTimeout(slateTimer), slateTimer = window.setTimeout(() => el.hidden = true, ms), el.onclick = () => el.hidden = true;
}
var dialogKey = null, dialogOpen = false;
function openDialog(spec) {
  let el = $("dialog");
  dialogOpen = true, el.hidden = false;
  let idx = 0, typing = 0, full = "", shown = 0, phase = "lines";
  el.innerHTML = `
    <div class="who"><i style="background:${spec.color}"></i><b>${esc(spec.name)}</b><span>${esc(spec.role)}</span>${spec.title ? `<span class="title">${esc(spec.title)}</span>` : ""}</div>
    <div class="line" id="dlgLine"></div>
    <div class="more" id="dlgMore"></div>
    <div class="opts" id="dlgOpts" hidden></div>`;
  let lineEl = $("dlgLine"), moreEl = $("dlgMore"), optsEl = $("dlgOpts"), reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches, type = (text) => {
    if (full = text, shown = 0, clearInterval(typing), spec.onLine?.(true), reduce) {
      lineEl.textContent = full, shown = full.length, spec.onLine?.(false);
      return;
    }
    typing = window.setInterval(() => {
      shown = Math.min(full.length, shown + 2), lineEl.textContent = full.slice(0, shown), shown >= full.length && (clearInterval(typing), spec.onLine?.(false));
    }, 16);
  }, finishTyping = () => shown < full.length ? (clearInterval(typing), shown = full.length, lineEl.textContent = full, spec.onLine?.(false), true) : false, showOptions = () => {
    phase = "options", moreEl.textContent = touchy ? "" : "Press a number to choose", optsEl.hidden = false, optsEl.innerHTML = "", spec.options.forEach((o, i) => {
      let b = document.createElement("button");
      b.type = "button", b.className = "opt", b.disabled = !!o.disabled;
      let cost = o.cost ? `<span class="cost neg">\u2212${money(o.cost).replace("$", "$")}</span>` : '<span class="cost zero">no cost</span>';
      b.innerHTML = `<span class="k">${i + 1}</span><span><b>${esc(o.label)}</b>${o.hint ? `<small>${esc(o.hint)}</small>` : ""}</span>${cost}`, b.addEventListener("click", () => pick2(i)), optsEl.appendChild(b);
    }), optsEl.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
  }, pick2 = (i) => {
    if (phase !== "options" || spec.options[i]?.disabled) return;
    let reaction = spec.onPick?.(i) ?? null;
    optsEl.hidden = true, reaction ? (phase = "result", type(reaction), moreEl.textContent = touchy ? "Tap to continue" : "Space to continue") : close();
  }, advance = () => {
    if (!finishTyping()) if (phase === "lines") {
      if (idx++, idx < spec.lines.length) {
        type(spec.lines[idx]), moreEl.textContent = idx < spec.lines.length - 1 || spec.options?.length ? touchy ? "Tap to continue" : "Space to continue" : touchy ? "Tap to close" : "Space to close";
        return;
      }
      if (spec.options?.length) {
        showOptions();
        return;
      }
      close();
    } else phase === "result" && close();
  }, close = () => {
    clearInterval(typing), el.hidden = true, dialogOpen = false, dialogKey && window.removeEventListener("keydown", dialogKey, true), dialogKey = null, spec.onLine?.(false), spec.onClose(), Ft();
  };
  if (lineEl.addEventListener("click", advance), moreEl.addEventListener("click", advance), dialogKey = (e) => {
    if (phase === "options" && /^[1-9]$/.test(e.key)) {
      e.preventDefault(), e.stopPropagation(), pick2(Number(e.key) - 1);
      return;
    }
    phase !== "options" && (e.key === " " || e.key === "Enter" || e.key === "e" || e.key === "E") && (e.preventDefault(), e.stopPropagation(), advance()), e.key === "Escape" && !spec.options?.length && (e.preventDefault(), close());
  }, window.addEventListener("keydown", dialogKey, true), !spec.lines.length) {
    spec.options?.length && showOptions();
    return;
  }
  type(spec.lines[0]), moreEl.textContent = spec.lines.length > 1 || spec.options?.length ? touchy ? "Tap to continue" : "Space to continue" : touchy ? "Tap to close" : "Space to close";
}
function cardDialogSpec(card, s) {
  let c2 = card.speaker === "narrator" ? null : CAST[card.speaker];
  return {
    name: c2?.name ?? "Narrator",
    role: c2?.role ?? "",
    color: c2?.look.clothes ?? "#888",
    title: card.title,
    lines: card.lines.length ? card.lines : ["\u2026"],
    options: card.options.map((o) => ({ label: o.label, hint: o.hint, cost: o.cost }))
  };
}
var panelClose = null, panelOpen = false, panelLocked = false;
function openPanel(title, html, onClose, opts = {}) {
  let el = $("panel");
  return el.innerHTML = `<header><h2>${esc(title)}</h2>${opts.noClose ? "" : '<button class="x" type="button" id="panelX">Close</button>'}</header><div class="body">${html}</div>`, el.hidden = false, panelOpen = true, panelLocked = !!opts.noClose, panelClose = () => {
    el.hidden = true, panelOpen = false, panelLocked = false, panelClose = null, onClose?.(), Ft();
  }, opts.noClose || $("panelX").addEventListener("click", () => panelClose?.()), el;
}
function closePanel() {
  panelClose?.();
}
function lineChart(values, opts) {
  let w = opts.w ?? 640, A = opts.h ?? 150, padL = 56, padR = 12, padT = 12, padB = 22;
  if (values.length < 2) return `<p class="note">The ${opts.label.toLowerCase()} chart fills in after your second month.</p>`;
  let min = Math.min(0, ...values), max = Math.max(...values, 1), x = (i) => padL + i / (values.length - 1) * (w - padL - padR), y = (v) => padT + (1 - (v - min) / (max - min || 1)) * (A - padT - padB), pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" "), area = `${x(0)},${y(Math.max(min, 0))} ${pts} ${x(values.length - 1)},${y(Math.max(min, 0))}`, ticks = [min, (min + max) / 2, max], last = values[values.length - 1];
  return `<svg class="chart" viewBox="0 0 ${w} ${A}" role="img" aria-label="${esc(opts.label)} by month">
    ${ticks.map((t) => `<line x1="${padL}" x2="${w - padR}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(233,228,214,0.1)"/><text x="${padL - 6}" y="${y(t) + 3}" text-anchor="end">${money(t).replace("$", "$")}</text>`).join("")}
    ${min < 0 ? `<line x1="${padL}" x2="${w - padR}" y1="${y(0)}" y2="${y(0)}" stroke="rgba(233,228,214,0.35)" stroke-dasharray="3 3"/>` : ""}
    <polygon points="${area}" fill="rgba(72,196,134,0.14)"/>
    <polyline points="${pts}" fill="none" stroke="#48c486" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="${x(values.length - 1)}" cy="${y(last)}" r="4" fill="#48c486"/>
    <text x="${padL}" y="${A - 4}">M1</text><text x="${w - padR}" y="${A - 4}" text-anchor="end">M${values.length}</text>
  </svg>`;
}
function plTable(r) {
  let row = (k, v, cls = "") => `<tr class="${cls}"><td>${k}</td><td class="${v < 0 ? "neg" : ""}">${money(v)}</td></tr>`;
  return `<table class="pl">
    ${row("Revenue", r.revenue)}
    ${row("Cost of goods", -r.cogs)}
    ${row("Rent", -r.rent)}
    ${row("Wages", -r.wages)}
    ${row("Overhead", -r.overhead)}
    ${r.marketingCost ? row("Marketing", -r.marketingCost) : ""}
    ${r.interestPaid ? row("Loan interest", -r.interestPaid) : ""}
    ${r.taxes ? row("Quarterly tax", -r.taxes) : ""}
    ${r.ventureProfit ? row("Other locations", r.ventureProfit) : ""}
    ${row("Profit", r.profit, "total")}
  </table>`;
}
var bar = (label, v, color = "var(--cash)") => `<div class="bar"><span>${label}</span><span class="meter"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></span><span class="num">${Math.round(v)}</span></div>`;
function booksHtml(e) {
  let biz = BUSINESSES.find((b) => b.id === e.business), loc = LOCATIONS.find((l) => l.id === e.location), last = e.history[e.history.length - 1], phase = phaseDisplay(e.macro.phase), cap = Math.round(biz.baseCapacityPerDay * TIER_CAPACITY_MULT[e.storeTier - 1] * 30);
  return `
    <div class="figs">
      <div class="fig"><span class="lbl">Cash</span><b class="${e.cash < 0 ? "neg" : ""}">${money(e.cash)}</b></div>
      <div class="fig"><span class="lbl">Loan</span><b>${money(e.loan)}</b></div>
      <div class="fig"><span class="lbl">Rate</span><b>${e.interestRate.toFixed(1)}%</b></div>
      <div class="fig"><span class="lbl">Last month</span><b class="${last ? last.profit >= 0 ? "pos" : "neg" : ""}">${last ? signed(last.profit) : "\u2014"}</b></div>
    </div>
    <div><h3 class="sec-h">Cash by month</h3>${lineChart(e.history.map((r) => r.cash), { label: "Cash" })}</div>
    <div class="grid2">
      <div><h3 class="sec-h">${last ? `${monthName(last.month)} P&amp;L` : "P&amp;L"}</h3>${last ? plTable(last) : '<p class="note">Your first month is still open. Close it with Priya in the office to see the numbers.</p>'}</div>
      <div><h3 class="sec-h">Health</h3>
        ${bar("Reputation", e.reputation)}
        ${bar("Staff morale", e.morale, e.morale < 45 ? "var(--loss)" : "var(--cash)")}
        ${bar("Freshness", 100 - e.fatigue, e.fatigue > 55 ? "var(--alert)" : "var(--cash)")}
        ${bar("Premises", e.condition, e.condition < 50 ? "var(--alert)" : "var(--cash)")}
        ${bar("Your energy", e.energy, e.energy < 30 ? "var(--loss)" : "var(--cash)")}
        <p class="note" style="margin-top:8px">${Math.round(e.loyalty)} regulars \xB7 ${last ? `${last.customers.toLocaleString()} customers last month of ~${cap.toLocaleString()} you can serve` : `room for ~${cap.toLocaleString()} customers a month`}</p>
      </div>
    </div>
    <div class="grid2">
      <div><h3 class="sec-h">How you run it</h3><div class="pillrow">
        <span class="pill">${biz.name}</span><span class="pill">${loc.name}</span>
        <span class="pill">Prices: ${PRICE_LEVELS.find((p) => p.id === e.priceLevel).name}</span>
        <span class="pill">Ads: ${MARKETING_TIERS.find((m) => m.id === e.marketingTier).name}</span>
        <span class="pill">${e.staff} staff</span><span class="pill">Store tier ${e.storeTier}</span>
        <span class="pill">${e.productLines} new lines</span>
      </div></div>
      <div><h3 class="sec-h">The market</h3>
        <p class="note">Economy: <b>${phase.label}</b> \xB7 inflation ${e.macro.inflationYoY.toFixed(1)}% a year${last ? ` \xB7 your share ${Math.round(last.marketShare * 100)}%` : ""}</p>
        ${e.competitors.length ? `<ul class="news">${e.competitors.map((c2) => `<li><b>${esc(c2.name)}</b>, ${STANCE_DESC[c2.stance]}</li>`).join("")}</ul>` : '<p class="note">No rivals on the block yet. The storefront across the street is still for lease.</p>'}
      </div>
    </div>
    ${e.roster.length ? `<div><h3 class="sec-h">Your team</h3><div class="pillrow">${e.roster.map((m) => `<span class="pill">${esc(m.name)}${m.role === "manager" ? " \xB7 manager" : ""} \xB7 skill ${m.skill} \xB7 morale ${Math.round(m.morale)}</span>`).join("")}</div></div>` : ""}
  `;
}
function recapHtml(e, story, next) {
  let r = e.record;
  return `
    <div class="recap-head"><span class="big ${r.profit >= 0 ? "pos" : "neg"}">${signed(r.profit)}</span><span class="note">${r.customers.toLocaleString()} customers \xB7 cash now ${money(r.cash)}</span></div>
    <p class="story">${esc(story)}</p>
    <div class="grid2">
      <div><h3 class="sec-h">P&amp;L</h3>${plTable(r)}</div>
      <div><h3 class="sec-h">On the block</h3>
        <ul class="news">
          ${e.eventHeadline ? `<li class="${e.eventGood ? "pos" : "neg"}">${esc(clean(e.eventHeadline))}</li>` : ""}
          ${e.headlines.map((h) => `<li>${esc(clean(h))}</li>`).join("")}
          ${r.eventLabels.map((h) => `<li>${esc(clean(h))}</li>`).join("")}
          ${!e.eventHeadline && !e.headlines.length && !r.eventLabels.length ? "<li>A quiet month on the street.</li>" : ""}
        </ul>
      </div>
    </div>
    <div class="go-row"><button class="primary" type="button" id="recapGo">Open ${esc(next)}</button></div>`;
}
function ml(e) {
  return `<p class="story">${esc(e)}</p><p class="note">Every full day away runs one month on autopilot, up to three at a time. The shop stays open without you, but nobody makes the calls you would have.</p>
    <div class="go-row"><button class="primary" type="button" id="awayGo">Back to work</button></div>`;
}
function bankHtml(s) {
  let canBorrow = s.loan + LOAN_STEP <= LOAN_CAP && s.ap >= LOAN_AP, canRepay = s.loan > 0 && s.cash >= Math.min(LOAN_STEP, s.loan);
  return `
    <div class="figs">
      <div class="fig"><span class="lbl">Your loan</span><b>${money(s.loan)}</b></div>
      <div class="fig"><span class="lbl">Rate</span><b>${s.interestRate.toFixed(1)}%</b></div>
      <div class="fig"><span class="lbl">Credit line</span><b>${money(LOAN_CAP - s.loan)}</b></div>
    </div>
    <p class="note">Walking in off-schedule takes groundwork: ${LOAN_AP} AP per loan. You earn AP by pitching in around the shop.</p>
    <div class="choice-list">
      <button class="choice" type="button" id="bankBorrow" ${canBorrow ? "" : "disabled"}><b>Borrow ${money(LOAN_STEP)}</b><span class="num">${LOAN_AP} AP</span><small>${s.ap < LOAN_AP ? `You have ${s.ap} AP.` : s.loan + LOAN_STEP > LOAN_CAP ? "Credit line maxed out." : `Interest at ${s.interestRate.toFixed(1)}% a year.`}</small></button>
      <button class="choice" type="button" id="bankRepay" ${canRepay ? "" : "disabled"}><b>Repay ${money(Math.min(LOAN_STEP, s.loan || LOAN_STEP))}</b><span class="num">free</span><small>${s.loan ? "Less interest every month." : "Nothing owed."}</small></button>
    </div>`;
}
function adsHtml(s) {
  return `
    <p class="note">Billed monthly while it runs; switch off any time. Launching a paid campaign off-schedule takes ${ADS_AP} AP. You have ${s.ap}.</p>
    <div class="choice-list">
      ${MARKETING_TIERS.map((t) => {
    let on2 = s.marketingTier === t.id, needsAp = t.cost > 0 && !on2, blocked = needsAp && s.ap < ADS_AP;
    return `<button class="choice ${on2 ? "on" : ""}" type="button" data-tier="${t.id}" ${on2 || blocked ? "disabled" : ""}><b>${t.name}${on2 ? " \xB7 running" : ""}</b><span class="num">${t.cost ? money(t.cost * s.macro.cpi) + "/mo" : "free"}</span><small>${t.desc}${needsAp ? ` \xB7 ${ADS_AP} AP` : ""}</small></button>`;
  }).join("")}
    </div>`;
}
function menuHtml(s) {
  let m = currentMenu(s);
  return `<p class="note">${esc(m.note)} \xB7 ${PRICE_LEVELS.find((p) => p.id === s.priceLevel).name} pricing</p>
    <div class="menu-list">${m.lines.map((l) => `<div><span>${esc(l.name)}${l.isNew ? ' <span class="pill">new</span>' : ""}</span><span class="num">${formatPrice(l.price)}</span></div>`).join("")}</div>`;
}
function endHtml(s, score) {
  let best = s.history.reduce((A, r) => r.profit > A ? r.profit : A, -1 / 0);
  return `<div class="card">
    <span class="lbl">${s.bankrupt ? "Closed for good" : `${s.maxMonths} months in business`}</span>
    <div class="grade" aria-label="Grade ${score.grade}">${score.grade}</div>
    <h2>${s.bankrupt ? "Out of cash" : `Valued at ${money(score.valuation)}`}</h2>
    <p class="note">${esc(score.summary)}</p>
    <div class="figs">
      <div class="fig"><span class="lbl">Months run</span><b>${s.history.length}</b></div>
      <div class="fig"><span class="lbl">Best month</span><b>${isFinite(best) ? signed(best) : "\u2014"}</b></div>
      <div class="fig"><span class="lbl">Reputation</span><b>${Math.round(s.reputation)}</b></div>
    </div>
    <div class="go-row" style="justify-content:center"><button class="primary" type="button" id="endAgain">Start a new run</button></div>
  </div>`;
}
var HAIR_NAMES = {
  short: "Short",
  curly: "Curly",
  bun: "Bun",
  long: "Long",
  cap: "Cap",
  bald: "Shaved",
  ponytail: "Ponytail"
};
function setupHtml(sel2, hasSave, portraits2, presets, pal) {
  let same = (a, b) => a.skin === b.skin && a.hair === b.hair && a.hairColor === b.hairColor && a.clothes === b.clothes, sw = (attr, colors, cur, label) => `<div class="swatches" role="group" aria-label="${label}">${colors.map((c2) => `<button type="button" class="sw" data-${attr}="${c2}" style="--c:${c2}" aria-pressed="${c2 === cur}" aria-label="${label} ${c2}"></button>`).join("")}</div>`;
  return `<div class="inner">
    <div class="brand"><h1>Biz<em>Sim</em><br>3D</h1><p>Open a shop on a real block. Walk the neighbourhood, talk to the people who need you, and survive 24 months.</p></div>
    ${hasSave ? '<div class="go-row"><button class="primary" type="button" id="continueRun">Continue your run</button><span class="note">or start a new one below</span></div>' : ""}
    <div class="step"><span class="lbl">1 \xB7 What are you opening?</span><div class="opts-grid">
      ${BUSINESSES.map((b) => `<button class="tile" type="button" data-biz="${b.id}" aria-pressed="${sel2.business === b.id}"><b>${b.name}</b><small>${esc(b.tagline)}</small><span class="num">~$${b.baseTicket.toFixed(2)} ticket</span></button>`).join("")}
    </div></div>
    <div class="step"><span class="lbl">2 \xB7 Where?</span><div class="opts-grid">
      ${LOCATIONS.map((l) => `<button class="tile" type="button" data-loc="${l.id}" aria-pressed="${sel2.location === l.id}"><b>${l.name}</b><small>${esc(l.blurb)}</small><span class="num">${money(l.rent)}/mo \xB7 ${l.footTrafficPerDay}/day</span></button>`).join("")}
    </div></div>
    <div class="step"><span class="lbl">3 \xB7 How do you look?</span>
      <div class="faces">${presets.map((p, i) => `<button type="button" class="face" data-preset="${i}" aria-pressed="${same(p, sel2.look)}" aria-label="Look ${i + 1}">${portraits2[i] ? `<img src="${portraits2[i]}" alt="">` : ""}</button>`).join("")}</div>
      <div class="tune">
        <span class="lbl">Skin</span>${sw("skin", pal.skins, sel2.look.skin, "Skin tone")}
        <span class="lbl">Hair</span><div class="pillrow">${pal.styles.map((h) => `<button type="button" class="chip" data-hair="${h}" aria-pressed="${sel2.look.hair === h}">${HAIR_NAMES[h] ?? h}</button>`).join("")}</div>
        <span class="lbl">Hair color</span>${sw("haircolor", pal.hairs, sel2.look.hairColor, "Hair color")}
        <span class="lbl">Outfit</span>${sw("outfit", pal.outfits, sel2.look.clothes, "Outfit")}
      </div>
    </div>
    <div class="step"><label class="field"><span class="lbl">4 \xB7 Your name</span><input id="ownerName" maxlength="16" value="${esc(sel2.name)}" autocomplete="off" placeholder="Type your name" aria-describedby="nameHint"></label>
      <span class="note" id="nameHint">Pick a name. It goes on the sign over your door.</span></div>
    <div class="go-row"><button class="primary" type="button" id="startRun">Open the doors</button></div>
    <p class="controls-note"><kbd>WASD</kbd> to walk \xB7 <kbd>Shift</kbd> to run \xB7 drag the mouse to look around \xB7 click to walk \xB7 <kbd>E</kbd> to talk \xB7 <kbd>M</kbd> map \xB7 <kbd>V</kbd> first person. You start with $20,000 and 24 months.</p>
  </div>`;
}
var mapOpen = false;
function openMap(places, onTravel) {
  let el = $("map");
  return el.innerHTML = `<div class="map-card" role="dialog" aria-modal="true" aria-label="Map">
    <header><h2>The neighbourhood</h2><button class="x" type="button" id="mapX">Close</button></header>
    <div class="map-body">
      <div class="map-canvas"><canvas></canvas></div>
      <aside class="map-side">
        <h3 class="sec-h">Legend</h3>
        <ul class="legend">
          <li><span class="lg you"></span>You</li>
          <li><span class="lg need">!</span>Needs a decision from you</li>
          <li><span class="lg close">$</span>Priya \xB7 close the month</li>
          <li><span class="lg place"></span>Place you can travel to</li>
          <li><span class="lg shop"></span>Your shop</li>
          <li><span class="lg road"></span>Street</li>
          <li><span class="lg bldg"></span>Building</li>
          <li><span class="lg park"></span>Park</li>
        </ul>
        <h3 class="sec-h">Travel to</h3>
        <div class="travel">${places.map((p) => `<button type="button" class="secondary" data-go="${p.id}">${esc(p.name)}</button>`).join("")}</div>
        <p class="note">Tap a place on the map or in the list to go straight there.</p>
      </aside>
    </div>
  </div>`, el.hidden = false, mapOpen = true, $("mapX").addEventListener("click", closeMap), el.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => onTravel(b.dataset.go))), el.addEventListener("click", (e) => {
    e.target === el && closeMap();
  }), el;
}
function closeMap() {
  let el = $("map");
  el && (el.hidden = true, el.innerHTML = "", mapOpen = false, Ft());
}
var yl = "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", xl = "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MAAsACYAHgAWABAACgAGAAMA///7//X/7//o/+L/3v/d/9//5f/s//X//v8GAAsADgAPAA4ADAAKAAoACwAMAA4ADwAOAAsABQD+//b/7//q/+j/6v/v//j/AgAMABQAGQAaABcAEQAJAAEA+v/1//L/8f/x//H/8v/y//H/8P/v//D/8v/3//7/BgAPABcAHQAgACAAHgAZABMADQAIAAQAAQD+//v/+P/z/+3/5//g/9r/1//Y/93/5f/x////DAAYACAAJQAnACQAHwAZABMADgAJAAYAAwAAAP3/+f/0/+7/6v/m/+X/5v/p/+//9v/9/wMACAALAAsACwAJAAgABwAIAAkACgALAAsACQAFAAAA+v/0/+//7f/u//L/+P8AAAgADwATABQAEwAPAAkAAwD9//j/9f/0//T/9P/1//X/9P/z//P/8//1//j//f8EAAoAEQAWABkAGgAYABQAEAALAAcABAABAP///f/7//f/8//u/+j/5P/h/+H/4//p//L//P8HABAAGAAcAB4AHQAZABUAEAAMAAgABQADAAEA/v/7//f/8//w/+3/6//s/+7/8v/3//3/AgAFAAgACQAIAAcABgAFAAYABgAHAAgACQAIAAUAAQD9//j/9P/y//L/9P/5////BQAKAA4AEAAPAAwACAADAP//+//4//f/9//3//f/9//3//b/9v/2//f/+f/9/wIABwAMABAAEwATABMAEAANAAkABgADAAEAAAD+//3/+v/3//P/7//r/+n/6P/q/+7/9P/7/wMACgAQABQAFgAWABQAEAANAAoABwAFAAMAAQD///3/+v/3//T/8v/x//H/8v/1//n//f8BAAQABQAGAAYABQAEAAQABAAEAAUABgAGAAYABAACAP7/+//4//b/9v/3//r//v8DAAcACgALAAsACgAHAAMAAAD9//v/+v/5//n/+f/5//n/+f/4//j/+f/6//3/AAAEAAgACwANAA4ADgAMAAoABwAFAAMAAQAAAP///v/8//r/+P/1//L/8P/v//D/8v/2//v/AQAGAAsADgAQABAADgAMAAoABwAFAAQAAgABAAAA/v/8//r/+P/2//X/9f/2//j/+v/9/wAAAgAEAAQABAAEAAMAAwACAAMAAwAEAAQABAADAAIA///9//v/+f/5//n/+//+/wEABAAGAAgACAAHAAUAAwABAP7//f/8//v/+//7//v/+//7//v/+v/7//z//f8AAAIABQAHAAkACgAKAAkABwAFAAQAAgABAAAAAAD///7//f/7//n/9//1//T/9f/2//j//P///wMABgAJAAoACwAKAAkABwAFAAQAAwACAAEAAAD///7//f/7//r/+f/5//n/+v/8//7/AAABAAIAAwADAAMAAgACAAIAAgACAAIAAwADAAIAAQAAAP7//f/8//v//P/9//7/AAACAAQABQAFAAUABAACAAEA///+//3//f/9//3//f/9//3//P/8//3//f/+////AQADAAQABgAGAAYABgAFAAQAAwACAAEAAAAAAP/////+//3//P/7//n/+f/5//n/+//9////AQADAAUABgAHAAYABgAFAAQAAwACAAEAAQAAAAAA///+//3//P/8//z//P/8//3//v8AAAEAAQACAAIAAgABAAEAAQABAAEAAQACAAIAAQABAAAA///+//7//f/9//7///8AAAEAAgADAAMAAwACAAIAAQAAAP/////+//7//v/+//7//v/+//7//v/+//////8AAAEAAgADAAMABAADAAMAAgACAAEAAQAAAAAAAAD////////+//3//f/8//z//P/9//7///8AAAIAAwADAAMAAwADAAMAAgACAAEAAQAAAAAAAAAAAP/////+//7//v/+//7//v///wAAAAABAAEAAQABAAEAAQAAAAAAAAABAAEAAQABAAEAAAAAAP///////////////wAAAAABAAEAAgABAAEAAQAAAAAAAAD///////////////////////////////8AAAAAAQABAAEAAgACAAIAAQABAAEAAQAAAAAAAAAAAAAAAAD///////////7//v/+/////////wAAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAD//////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", kl = "UklGRqK9AABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YX69AAAAAAIACgAWACcAPQBXAHQAlgC7AOIADAE4AWYBlAHCAfABHQJJAnICmQK9AtwC9wIOAx8DKgMuAywDIwMTA/wC3AK2AocCUQITAs4BgQEuAdQAdAAPAKT/Nf/C/kz+1P1a/eD8Zvzs+3X7APuP+iL6u/lb+QH5sPhn+Cj49PfK96z3m/eV9533svfV9wX4RPiP+On4UPnE+UT60fpq+w38u/xy/TH++P7F/5gAbwFIAiQD/wPaBLIFhgZWBx8I4AiYCUUK5wp8CwIMegzhDDgNfA2uDcwN1w3NDa8NfA00DdcMZgzgC0YLmQraCQgJJgg0BzQGJQULBOcCuQGEAEn/C/7K/In7SfoN+db3pvaA9WT0VvNV8mXxh/C87wbvZu7e7W7tF+3b7LrstOzL7P7sTe247T/u4u6g73jwafFz8pPzyvQU9nH33/hb+uX7ef0V/7gAXwIHBK8FUwfyCIgKFAyTDQIPYBCqEd8S+xP+FOYVsBZbF+cXUhibGMEYwxiiGF0Y9BdoF7gW5hXyFN0TqRJWEegPXw69DAULOAlaB20FcwNvAWT/Vf1F+zb5Lfcr9TTzS/Fz767tGOyd6kLpB+ju5vnlKeV/5PzjoeNv42XjhOPM4zvk0uSP5XLmeuek6O/pWevh7ITuP/AR8vbz7PXx9wD6GPw2/lUAdQKQBKUGsAiuCp0Meg5CEPMRixMGFWMWoBe8GLQZiBo2G70bHRxVHGQcSxwKHKEbEBtaGn0ZfRhaFxYWshQyE5YR4Q8WDjcMRwpICD4GKwQSAvf/3P3E+7L5qvet9cDz5PEc8Gvu0+xW6/jpuOia557mx+UV5YrkJeTo49Pj5+Mi5IXkDuW+5ZTmjeep6ObpQ+u97FLuAPDE8Z3zh/WA94X5k/un/b7/1QHpA/gF/gf4CeQLvw2HDzgR0BJOFK4V8BYQGA8Z6hmfGi8bmBvaG/Ub5xuyG1Ub0hopGloZaBhSFxwWxxRUE8URHhBgDo0MqQq2CLcGrgSfAowAef5o/F36Wfhh9nf0nfLW8CXvjO0O7KzqaelF6ETnZuas5RjlquRk5ETkTOR75NHkTuXx5bnmpeez6OLpMeud7CXuxe998UnzJ/UV9w75Evsc/Sv/OgFHA1AFUAdGCS8LCA3ODn8QGBKXE/oUPxZlF2kYSxkIGqAaEhteG4MbgRtXGwcbkBr0GTMZThhGFx4W1hRxE/ARVhClDt8MBwsfCSsHLQUnAx0BEv8I/QP7BfkR9yr1U/OO8d3vRO7E7F/rGOrw6OrnBedE5qjlMeXg5Lbks+TX5CHlkuUo5uLmwOfB6OPpJOuC7PztkO878fryzPSu9p34lvqX/Jz+owCpAqsEpgaYCH0KUwwYDsgPYRHiEkgUkBW6FsQXqxhwGRAaixrgGhAbGBv6GrYaTBq8GQgZMBg2FxsW4RSJExYSiRDkDisNXwuDCZoHpgWqA6kBpv+k/aX7rfm+99v1BvRD8pPw+e547RHsx+qb6Y/opOfc5jjmueVf5SvlHeU15XTl2OVh5g/n4OfT6OjpG+ts7NntYO/98LHyd/RN9jD4H/oW/BL+EQAQAgsEAAbtB84JogtkDRMPrRAvEpYT4hQQFh8XDBjXGH8ZAxphGpoarRqaGmIaBBqAGdkYDxgiFxQW5xSdEzcStxAfD3INsgviCQQIGgYpBDECNgA8/kT8Ufpn+Ij2tvT18kbxrO8q7sLsdOtF6jTpQ+h158nmQubf5aHlieWW5cnlIuaf5kDnBOjq6PHpF+tb7LrtNO/F8GzyJvTw9cn3rfma+439g/96AW8DXgVGByMJ8wqzDGEO+w99EecSNRRnFXoWbRc/GO4YeRnhGSMaQBo4GgsauRlCGacY6RcJFwkW6RSsE1MS4BBVD7UNAQw8CmkIigaiBLQCwgDP/t788foM+TH3Y/Wk8/fxXfDb7nDtIezt6tjp4ugO6FvnzOZg5hnm9+X65SLmbubf5nTnK+gE6f7pF+tO7KDtDe+S8Czy2vOZ9Wb3QPkj+w39+v7pANcCwASjBnsISAoGDLINSw/OEDkSihO/FNYVzhamF1wY7xhfGaoZ0RnUGbEZaxkAGXEYwBftFvoV5xS3E2sSBRGGD/INSgyRCskI9QYXBTIDSAFd/3P9jfuu+df3DPZQ9KTyDPGJ7x3uzOyV63zqgemn6O3nVufj5pPmZ+Zf5nzmveYj56vnVugj6RDqHOtF7Ivt6+5j8PHxk/NG9Qj31/iw+pH8dv5dAEMCJgQDBtcHoAlbCwYNng4hEI0R4BIXFDMVMBYNF8kXZBjcGDAZYRltGVYZGhm7GDgYkxfNFuYV4RS9E34SJRGzDysOjwziCiUJWweHBasDywHo/wX+JfxL+nn4s/b59E/zuPE18Mnude087B/rH+o/6YDo4udm5w3n2ObH5tnmD+dp5+bnhOhF6SXqJOtB7Hrtze458LrxUPP49K/2dPhD+hn89v3V/7QBkANnBTcH/AizClwM8w12D+IQNxJxE5AUkhV0FjcX2BdYGLUY7xgFGfgYxxhzGPwXYxepFs8V1hS/E40SQBHbD18OzwwtC3sJvAfzBSAESQJuAJL+ufzl+hj5Vfef9fjzYvLf8HLvHe7h7MHrverY6RPpbujq54nnS+cw5zjnZOey5yPotuhq6T7qMetB7G3ttO4T8InxE/Ov9Fv2FfjZ+af7ev1R/ygB/gLPBJoGWggPCrULSw3NDjoQkBHNEu8T9BTcFaQWTBfTFzgYexibGJcYcRgoGL0XMBeCFrQVxxS9E5cSVxH+D44OCg10C80JGQhZBpEEwgLvABz/Sf17+7P59fdC9p30CfOH8Rnww+6F7WLsWutw6qXp+uhv6AbowOeb55rnu+f+52To6+iT6VvqQetF7GXtn+7y71zx2vJq9Av2uvd1+Tn7A/3R/qEAcAI7BAAGvQduCRELpQwmDpQP6xApEk4TVxRDFREWwBZOF7sXBhguGDUYGRjbF3sX+RZXFpUVtRS3E50SaREdELkOQQ22CxsKcQi8Bv0ENwNtAaH/1f0N/Ev6kfji9kD1rfMs8r/wZ+8o7gLt9+sI6zjqh+n16IXoNegI6P3nFOhN6KjoI+nA6XvqVutN7GHtj+7W7zPxpfIr9MD1ZfcV+c/6kPxW/h8A5gGrA2sFIgfQCHAKAgyCDe8ORxCHEa8SuxOsFH8VMxbIFjwXjxfBF9EXvxeLFzYXvxYpFnMVnxStE6ASeBE3EOAOcw30C2MKxAgZB2QFpwPmASEAXf6b/N/6Kfl+99/1T/TP8mLxCvDJ7qHtkuyg68rqE+p76QTprOh26GLob+ie6O7oXunv6Z/qbutZ7GHtg+697w/xdvLv83r1FPe6+Gr6Ivzg/aD/YQEfA9kEjAY1CNIJYgvhDE0OpQ/nEBESIBMVFOwUphVBFr0WGBdSF2sXYhc5F+4Wgxb4FU0VhRSfE54SghFNEAIPoQ0tDKcKEwlyB8cFEwRaAp4A4f4m/W/7vvkX+Hv27fRv8wPyq/Bp7z7uLe037F3roOoC6oPpJOnm6Mnozejx6DfpnOki6sfqietp7GXte+6p7+/wSvK58zj1x/Zj+Ar6uftt/Sb/3wCXAksE+AWeBzgJxApCDK4NBg9IEHQRhhJ+E1oUGhW7FT0WnxbhFgMXBBfkFqQWRBbDFSQVaBSOE5gSiBFfEB8Pyg1hDOcKXQnHByUGewTKAhYBYP+s/fv7UPqt+BX3ifUN9KHySfEG8Nruxu3N7O7rLeuJ6gPqnelX6THpLOlH6YLp3elY6vHqqOt97Gztdu6Z79TwI/KG8/v0f/YR+K75U/v//K/+YQASAsADaQUJB6AIKgqlCxANaA6rD9gQ7RHpEskTjRQ0FbwVJhZwFpoWpBaOFlgWAhaMFfgURxR4E44SihFtEDkP7w2RDCILowkXCH8G3gQ2A4oB3P8u/oP83vo/+av3Ivao9D7z5vGi8HXvX+5i7YDsuesQ64TqF+rJ6Zvpjeme6dDpIOqQ6h/ry+uU7Hjtdu6O77zwAPJY88L0PPbD91b58vqW/D3+6P+SAToD3QR5BgsIkgkMC3UMzQ0QDz8QVhFUEjgTARStFDsVrBX9FTAWQhY1FgkWvRVSFckUIxRgE4ESiBF3EE4PDw69DFkL5AliCNQGPQWeA/oBUwCt/gj9aPvO+T74uPZA9dfzgPI88Q7w9u727RDtReyX6wXrkeo86gbq7+n46R/qZurM6k/r8Ouu7Ifteu6G76nw4vEv8470/fV69wP5lvow/ND9cv8WAbcCVQTsBXoH/gh1Ct0LMw13DqYPvxDAEagSdRMmFLoUMRWKFcQV3xXbFbgVdhUWFZcU/BNEE3ASgxF9EF8PLA7lDIsLIQqpCCUHlwUBBGYCxwAn/4n97vta+s34S/fW9W/0GPPU8aXwi++J7qDt0ewe7IbrDOuw6nLqU+pT6nHqruoK64PrGezM7Jntge6C75rwx/EJ8130wvU197T4PfrP+2b9Af+dADgC0ANiBewGbQjhCUcLnQzgDRAPKhAuERgS6RKfEzkUthQWFVcVehV/FWUVLRXWFGIU0RMkE1wSehF/EGwPRA4IDbkLWgrsCHIH7QVgBM0CNgGe/wb+cfzi+ln52/do9gP1rvNr8jrxIPAb7y/uXO2k7AjsiOsl6+Dqueqw6sXq+epK67nrRezt7K/tjO6C747wsfHo8jH0i/X09mn46fly+wH9lP4pAL0BTwPcBGIG3gdQCbMKCAxLDXsOlw+cEIoRXhIYE7cTOhShFOkUFBUhFRAV4RSVFCsUpBMCE0QSbRF9EHYPWQ4nDeMLjworCboHPwa7BDADoQEQAH/+8Pxm++L5aPj49pX1QfT+8s7xsvCs773u5+0r7YnsA+ya607rH+sO6xvrReuN6/LrdOwR7cntm+6F74fwnvHL8gn0WfW39iP4mvkZ+6D8K/64/0YB0gJZBNoFUwfBCCMKdgu4DOkNBQ8MEPwQ1BGSEjYTvxMrFHsUrRTCFLoUlBRRFPATdBPcEikSXRF4EHwPaQ5DDQkMvwplCf8HjQYSBY8DCAJ/APT+bP3n+2j68fiF9yT20vSQ82DyQ/E78Ervce6x7Qrtf+wQ7L3rh+tu63LrlOvS6y7spew47eXtrO6M74PwkPGx8uXzKvV/9uH3TvnF+kL8xv1M/9IAWALaA1YFywY2CJUJ5gooDFgNdQ59D3AQShENErUSQxO1EwsURRRiFGEURBQKFLQTQRO0EgsSShFvEH4Pdg5aDSsM6wqcCT8I1gZkBesDbALpAGb/4/1k/Or6ePkP+LH2YfUg9PDy0vHJ8Nbv+u427ovt++yG7C3s8OvP68vr5Osa7Gvs2exi7QXuwe6W74PwhfGc8sXzAPVL9qP3B/l0+un7ZP3j/mMA4gFeA9YERgauBwoJWQqZC8kM5w3wDuQPwhCIETQSxxI/E5sT3BMAFAgU8xPCE3UTDBOIEuoRMxFjEHwPfw5uDUkMEwvOCXsIHAezBUIEywJQAdP/V/7e/Gn7+/mV+Dv37PWt9H3zYPJW8WHwgu+77gzud+397J3sWewx7CbsNuxj7KvsD+2O7Sfu2u6k74bwfvGK8qnz2vQa9mn3w/go+pX7B/1+/vf/cAHnAlkExQUoB4IIzwkOCz0MWg1lDloPOhADEbQRSxLIEioTchOdE60ToBN4EzQT1BJaEsYRGRFUEHcPhA59DWMMOAv8CbMIXQf9BZQEJgOzAT0AyP5U/eT7e/oZ+cH3dvY49Qn06/Lh8erwCfA/74zu8+1z7Q7txOyV7ILsiuyu7O7sSO2+7U3u9e61743wevF88pHzuPTu9TP3hPjf+UT7rvwe/o//AgFyAt8DRgWmBvwHRwmECrIL0AzbDdIOtA+AEDQRzxFRErkSBxM5E1ATTBMsE/ASmhIqEqAR/BBBEG4Phg6JDXoMWAsmCucImgdDBuMEfQMRAqMANP/H/Vz89/qa+UX4/PbA9ZL0dfNq8nLxj/DC7wzvb+7q7X/tL+357N/s3+z77DLthO3v7XXuE+/K75fwevFy8n3zmfTG9QH3Sfib+ff6WfzB/Sv/lwABAmkDzAQnBnoHwgj9CSoLRwxSDUsOLw/9D7QQVBHbEUgSnBLUEvIS9hLeEqsSXhL3EXYR3RArEGMPhQ6SDYwMdQtNChcJ1AeGBi4F0ANsAgUBnf82/tH8cfsX+sb4gPdG9hn1/fPx8vjxFPFE8Ivv6u5h7vHtmu1e7T3tNu1K7Xjtwe0k7qDuNO/h76TwffFr8mzzf/Sh9dP2Efhb+a76CPxo/cv+MACUAfYCVASrBfoGPwh5CaQKwAvMDMUNqw57DzYQ2RBkEdcRMBJvEpQSnhKOEmQSIBLBEUoRuhASEFQPgA6XDZsMjQtvCkMJCQjEBnUFHwTDAmQBAgCh/kL95/uS+kT5AfjJ9p71gvR3833yl/HF8AnwZO/X7mLuBu7E7Zztju2a7cDtAO5a7s3uWO/777XwhPFo8l/zZ/SB9an23vce+Wn6u/sS/W7+zP8rAYcC3wMyBX4GwAf3CCEKPAtHDEENKA77DrgPXhDuEGURxBEJEjQSRhI9EhsS3xGKERsRlRD3D0IPeA6ZDacMowuOCmsJOwj+BrkFawQXA74BZAAJ/6/9WfwJ+7/5f/hJ9yD2BfX68wDzGfJF8Yfw3+9N79Tuc+4r7vzt5+3s7QruQu6T7v3uf+8Y8MjwjvFo8lXzVPRk9YL2rvfm+Cf6cfvB/Bb+bf/FABsCbwO9BAQGQwd3CKAJugrFC78Mpw17DjsP5Q94EPQQVxGiEdQR7BHrEdERnRFQEeoQbRDYDy0PbA6XDa8MtAuqCpAJaAg1B/gFsgRmAxUCwgBt/xn+yfx9+zf6+vjH96D2hvV89ILzmfLE8QPxWPDD70Xv3+6R7l3uQe4+7lXuhe7O7i/vqO848N/wm/Fr8k/zRPRK9V/2gvex+Or5K/t0/MH9Ef9iALMBAQNLBI4FyQb7ByEJOgpECz4MJw39Db8Oaw8CEIIQ6xA7EXMRkhGYEYURWREUEbcQQxC3DxUPXg6SDbMMwwvBCrEJkghoBzMG9gSyA2gCHAHO/4D+Nf3t+6z6c/lC+B33Bfb79AH0GPNC8n/x0fA48LbvTO/57r7unO6T7qLuyu4L72Pv0+9a8PjwqvFx8kvzOPQ09UD2WveA+LD56foq/G/9uf4DAE4BlwLbAxsFUgaBB6UIvAnGCsALqQyADUQO8w6NDxEQfhDTEBERNhFDETcRExHWEIIQFhCTD/sOTQ6KDbUMzQvVCs4JuQiXB2sGNgX6A7gCcgErAOP+nf1b/B776Pm7+Jj3gvZ59X/0lvO+8vnxSfGt8CfwuO9g7yDv+O7o7vDuEe9J75rvAfB/8BTxvfF78kzzLvQi9SX2NfdS+Hr5q/rk+yL9ZP6o/+0AMAJvA6oE3gUKBysIQQlJCkMLLAwEDcoNfA4ZD6APERBsEK8Q2hDtEOgQzBCXEEsQ5w9tD90OOA5/DbMM1QvmCugJ3AjDB58GcwU+BAQDxQGEAEP/A/7F/I37W/ox+RH4/Pb09fv0EfQ583PywPEh8ZjwJfDI74LvVO8+7z/vWe+K79LvMfCn8DLx0/GH8k/zKPQT9Qz2FPcp+Ej5cfqh+9j8E/5Q/48AzAEHAz0EbQWVBrQHyAjPCcgKsQuKDFENBQ6lDjAPpQ8EEEwQfRCXEJkQgxBWEBEQtg9FD70OIQ5xDa4M2Qv0Cv4J+wjrB9AGqwV/BEwDFALaAJ//ZP4s/fj7yvqk+Yb4dPdt9nX1i/Sy8+vyNvKV8QjxkfAw8OXvsu+V75Dvou/M7wzwY/DR8FPx6/GX8lXzJvQH9fj19/YC+Bn5Ovpi+5H8xf38/jQAbAGhAtMD/wQkBkAHUQhXCU8KOAsSDNoMjw0yDsAOOQ+cD+kPIBA/EEgQORATENYPgw8aD5sOCA5hDacM2gv+ChEKFwkQCP0G4AW8BJADYAItAfj/w/6Q/WH8N/sU+vn46ffk9u31A/Uq9GHzq/IH8njx/fCY8EjwD/Dt7+Hv7e8P8Ejwl/D88HfxBvKp8l7zJvT+9Ob13Pbg9+74Bvon+0/8e/2r/t3/DwE/AmwDlAS1Bc4G3QfhCNgJwQqbC2QMGw3ADVEOzQ40D4YPwg/nD/YP7Q/PD5kPTg/tDncO7A1NDZwM2QsFCyEKLwkxCCYHEgb1BNEDqAJ8AU0AHv/x/cb8oPuB+mr5XPhZ92L2evWg9NfzH/N58ufxafH/8KvwbfBF8DTwOfBU8IbwzfAq8Z3xI/K98mvzKfT59Nj1xvbA98b41/nv+g/8Nf1e/or/tgDgAQgDLARJBV8GbAduCGQJTAomC+8LqAxODeINYg7NDiMPZA+OD6MPoQ+JD1sPFw++DlAOzQ03DY4M1AsJCy4KRQlOCEwHQAYrBQ8E7QLHAZ8Adv9O/ij9B/zr+tf5zPjL99b27vUU9Ur0kfPq8lXy1PFn8Q/xzPCe8IfwhvCa8MXwBfFa8cXxQ/LV8nnzMPT39M31svak96L4qvm7+tT78vwU/jn/XwCFAagCxwPgBPMF/Qb9B/EI2QmyCnwLNgzeDHQN9w1mDsAOBQ81D08PVA9CDxsP3w6NDicOrA0fDX4MzAsKCzcKVwlpCG8HawZeBUkELgMPAu0Ayv+o/of9a/xT+0L6Ovk7+Ef3YPaH9b30AvRZ88LyPvLO8XLxKvH48Nvw1PDi8AXxPvGM8e/xZfLv8ovzOfT39MX1ovaL94H4gfmK+pv7svzO/e3+DQAsAUoCZQN6BIkFkQaOB4EIZwlBCgsLxQtvDAcNjQ3/DV0Opg7bDvsOBQ/6DtoOpA5aDvwNiQ0EDWsMwgsICz4KZQmACI4HkgaNBX8EbANUAjkBHAD//uP9y/y4+6r6pfmo+Lb30Pb49S31cvTI8y/zqPI18tXxifFS8S/xIvEq8UfxefHA8RvyifIL85/zRPT69MD1lPZ292P4XPld+mb7dvyL/aP+vf/XAPABBgMXBCMFJwYiBxMI+AjRCZsKVgsBDJsMIw2YDfoNSA6BDqYOtg6xDpcOaQ4mDs8NZA3mDFYMtQsDC0EKcQmUCKoHtga4BbMEpgOVAoABagBS/zz+Kf0Z/BD7DfoT+SP4P/dm9pz14fQ19JrzEfOb8jfy6PGs8YXxcvF08YrxtvH18UnysPIp87XzU/QB9b71ivZj90n4Ofkz+jX7PvxL/V3+cf+FAJkBqgK3A78EwAW4BqcHiwhjCS0K6QqVCzAMugwyDZcN6Q0nDlEOZg5nDlQOLA7wDaANPA3HDD4MpQv7CkIKegmlCMMH1wbhBeME3gPTAsUBtACj/5L+g/14/HL7c/p8+Y74q/fT9gn2TvWh9AX0evMA85ryRvIG8trxwvG+8c/x8/Es8njy2PJK887zZPQK9b/1g/ZU9zL4GvkM+gf7CPwP/Rr+KP82AEUBUQJaA14EWwVRBj4HIAj3CMEJfQopC8YLUgzNDDUNiw3NDfsNFg4cDg8O7Q24DW8NEw2lDCQMkwvxCkAKgAmzCNkH9AYGBg8FEQQOAwYC/ADw/+T+2/3U/NL71vri+fb4FPg+93X2ufUM9W704fNl8/zypfJg8jDyE/IJ8hTyM/Jl8qryAvNt8+nzd/QV9cL1fvZI9x34/vjp+dz61vvW/Nr94v7r//QA+wH/Av8D+QTsBdcGtweNCFYJEgrACl4L7AtoDNMMLA1yDaUNxQ3RDckNrg1/DT0N6AyBDAgMfgvkCjsKgwm9COwHDwcoBjkFQgRFA0QCQAE6ADT/L/4t/S/8NvtF+lz5fPin9972IvZ19db0SPTK813zA/O78obyZPJV8lryc/Ke8t3yLvOS8wf0jfQj9cn1ffY+9wz45fjI+bT6p/ug/J79n/6i/6YAqAGoAqQDmgSKBXIGUQclCO4IqQlXCvYKhgsFDHIMzgwYDU8Ncw2EDYINbQ1EDQkNuwxbDOoLaAvVCjMKgwnGCPwHJgdHBl8FbwR5A38CgQGBAID/gP6D/Yn8lPum+r/54fgO+Eb3ivbd9T31rfQt9L7zYfMV89zytfKi8qHytPLZ8hHzXPO48yb0pfQz9dH1fvY39/73z/ir+Y/6e/tu/GX9YP5d/1sAWAFTAksDPgQrBRAG7Qa/B4cIQgnwCZAKIQuiCxIMcQy+DPkMIg04DTsNKw0JDdQMjQw0DMkLTwvECikKgQnLCAgIOwdjBoIFmgSrA7YCvwHFAMn/z/7W/eD87/sE+yD6RPlz+Kz38fZD9qP1EfWQ9B70vvNv8zLzB/Pv8uny9vIW80fzi/Ph80f0v/RG9d31gfYz9/L3vPiQ+W36U/s+/C/9JP4b/xMACwECAvUC5APOBLAFiwZcByII3QiLCSsKvQo/C7ILFAxkDKMM0AzqDPMM6AzMDJ0MXQwKDKcLMwuwCh0KfAnNCBMITAd8BqIFwQTYA+sC+QEFARAAGv8m/jX9R/xg+376pfnV+A/4Vfen9gf2dPXx9H70G/TJ84jzWfM88zLzOfNT83/zvPML9Gv02/Rb9er1h/Yy9+n3rPh5+U/6LfsS/Pz86v3c/s7/wQCzAaICjQN0BFMFKwb6BsMHhghDCfkJpgpJC+ILbQzrDFoNuQ0GDkEOaQ58DnoOYg40Du4Nkg0fDZQM8gs6C2wKigmTCIkHbQZCBQgEwgJxARgAuf5W/fL7j/ow+dj3ifZF9RD07PLa8d/w++8x74Pu8+2C7THtAe307AntQu2e7Rzuve5/72LwY/GC8r3zEPV79vr3ivkp+9P8hf49APYBrANeBQYHowgwCqoLDg1ZDokPmhCMEVsSBROKE+kTHxQuFBQU0RNnE9YSIBJFEUgQKg/uDZcMKAujCQwIZga1BP0CQQGF/839HPx2+uD4W/fs9Zb0W/M+8kHxZ/Cx7yHvt+517lruZ+6c7vfud+8c8OTwy/HR8vLzK/V69tz3S/nG+kn8z/1V/9cAUgLBAyIFcQarB80I1Am+CogLMgy4DBsNWQ1yDWYNNg3hDGkM0AsWCz8KTQlCCCIH7gWsBF4DCAKtAFL/+/2q/GX7LvoJ+fn3Avcm9mj1yvRP9PjzxfO589PzFPR89Aj1uvWO9oP3l/jH+RH7cPzh/WH/7AB9AhAEoQUsB6sIHAp4C74M5w3yDtoPnBA1EaMR5RH3EdkRixEMEVwQXA8vDtgMWwu6CfkHHQYpBCMCDgDx/dD7sPmX94n1jfOn8dvvL+6n7EjrFOoP6T3on+c55wvnF+dd597nmeiM6bfqGOyr7W7vXvF287P1D/iF+hH9rP9SAvwEpQdFCtgMWA+/EQYUKhYkGPEZihvuHBceAx+vHxkgQCAjIMEfGh8vHgIdlRvqGQQY5hWWExYRbQ6gC7QIrwWXAnT/S/wj+QP28fL17xTtVOq951LlG+Mb4Vff092T3Jrb6tqE2mvantoe2+rbAN1f3gTg7OET5HXmDenX68zu5vEg9XP41/tG/7oCKgaPCeQMIBA9EzYWAhmdGwIeKyATIrgjFCUnJuwmZCeMJ2Qn7SYoJhYluiMWIi4gBR6hGwYZORZBEyMQ5wySCSsGuwJH/9b7cfgd9eLxxe7P6wPpaeYF5Nvh8d9K3unc0NsC24DaStph2sTacttq3KjdKt/s4OviIuWM5yPq4+zF78Py1vX4+CL8Tv91ApEFmgiLC14ODRGTE+sVDxj9GbAbJR1aHk0f/R9nII0gbiAMIGcfgh5gHQIcbhqmGLAWjxRKEuQPZQ3QCi0IgQXTAicAhP3w+nD4CfbB85vxne/L7Sjstup66XTop+cT57rmm+a25grnledW6Erpbuq/6zrt2u6b8Hnyb/R49o74rvrR/PP+DgEeAx0FBwfYCIwKHgyMDdIO7Q/cEJwRLBKMErsSuBKFEiMSkhHVEO8P4Q6vDVwM7ApjCcUHFgZbBJkC0wAQ/1L9oPv8+W349PaY9Vn0PfNG8nfx0PBV8Afw5e/x7yrwkfAj8eDxxfLR8wD1UPa+90X54vqQ/Ez+EQDaAaMDZwUhB80IZgrpC1ENmQ7AD8EQmRFGEsYSFxM4EygT5xJ0EtER/hD9D88OeA36C1gKlwi4BsIEuAKfAHz+VPws+gn48PXn8/LxFvBY7rzsRuv76d3o8ec457TmaeZW5n3m3+Z6507oWumc6hLsue2P74/xtfP99WP44Ppx/RAAtgJfBQMInworDaIP/xE8FFQWQRgBGo0b5BwAHuAegR/hH/4f2R9xH8Ue2B2rHD8blxm3F6IVWxPoEE4OkQu3CMYFxAK4/6b8l/mR9pnztvDu7UjryOh15lPkZuK04EDfDd4e3XTcE9z62yvcpNxm3W7evN9M4RvjJuVp59/pg+xQ70DyTfVx+KX74/4kAmIFlgi5C8QOshF9FB4XkRnQG9YdoB8qIXEiciMrJJskwSSdJC8keCN6IjchsR/tHe0bthlNF7YU+BEYDxsMCQnoBb4Ckf9p/Ev5P/ZK83Lwve0x69Pop+ay5PfieuE94ETfjt4e3vTdEN5x3hbf/d8l4YniKOT85QLoNuqS7BHvrfFi9Cj3+vnS/Kr/fAJCBfYHkgoRDW8PphGxE44VOBetGOkZ6xqwGzkcgxyQHGAc9BtNG20aWBkPGJcW8hQlEzURJg/+DMAKcggbBr4DYgEL/7/8g/pc+E72XvSQ8ufwZ+8T7u7s+Os166XqSeoh6i3qbOrd6n7rTexI7Wzute8h8avyT/QI9tT3rPmN+3H9Vf8yAQYDygR8BhcIlwn5CjoMVg1MDhkPvA8zEH4QnBCNEFEQ6g9ZD6AOwQ2+DJkLWAr7CIkHAwZvBNACKwGE/9/9Qvyv+iv5u/di9iP1AvQB8yXybvHf8HnwPvAv8EvwkvAF8aLxZ/JT82X0mPXr9lr44vl++yz95/6pAHECNwT5BbEHXAn0CnYM3g0oD1AQVBEvEuESZhO9E+UT3BOiEzgTnRLTEdoQtQ9mDvAMVQuaCcEHzgXHA64Bi/9g/TP7Cfnn9tH0zvLi8BHvYO3T623qNOkp6E/nquY75gPmBOY+5rHmXudC6FzprOot7N7tu+/A8erzM/aY+BT7oP04ANYCdQUPCJ4KHQ2GD9QRARQKFugXmRkXG2AccB1FHtweNB9MHyMfuR4OHiQd/RuZGvwYKRckFe8SkRANDmkLqgjWBfICBAAT/ST6Pvdn9KXx/e527BPq3OfU5f/jYuIA4d3f+d5Z3vzd5N0R3oTeOt8z4G3h5eKZ5IXmpOj06m7tDvDP8qr1mviZ+6H+qwGxBK0HmQpvDSkQwRIyFXcXjBlsGxQdgB6tH5kgQyGoIcohpiE/IZQgqB99HhUdcxubGZEXWhX5EnUQ0w0XC0kIbQWLAqf/yPz0+TD3g/Ty8YLvOO0Y6yfpaOfg5Y/keuOi4gjireGS4bbhGOK44pPjp+Ty5XDnHun36vjsHO9e8bnzJ/ak+Cr7s/06ALoCLQWNB9cJBQwTDv0PvhFUE7sU8RX0FsIXWRi6GOMY1hiSGBkYbRePFoIVShToEmIRug/1DRYMJAoiCBUGAgTuAd3/1P3Z++75Gfhe9sD0Q/Pq8bfwru/P7h3umO1C7RvtIu1Y7brtR+7/7t7v4fAH8kzzrPQk9q/3S/ny+qH8Uv4DAK4BUAPkBGcG1AcpCWIKewt0DEkN+A1/Dt8OFQ8hDwQPvg5QDrsNAQ0kDCULCArQCH8HGgakBCEDlAEDAHD+4PxX+9n5a/gP98r1nvSP86Hy1fEt8azwU/Ak8B7wQ/CS8ArxrPF18mTzePSs9f/2bvj2+ZL7P/35/rsAgwJKBA0GyAd1CRILmQwHDlkPihCXEX4SPBPOEzMUahRyFEkU8BNmE64SxxG0EHcPEQ6GDNgKDQkmBygFGAP6ANL+pvx7+lT4OPYq9DHyT/CL7ufsaesT6uno7uck54/mLuYF5hTmWubY5o7neuib6e7qcuwj7v7v//Ej9GX2wPgw+6/9OADGAlQF3AdYCsMMGA9SEWwTYRUtF8wYOhp1G3gcQh3QHSIeNh4LHqMd/RwaHP0aphkaGFoWahRPEgsQpQ0hC4MI0gUSA0sAgP25+vr3SvWu8izwyO2J63LpiOfP5Uvk/uLs4RfhgeAq4BTgP+Cq4FXhPuJk48PkWuYk6B/qReyT7gPxkvM49vH4t/uF/lQBIAThBpIJLgywDhIRTxNjFUoXABmCGswb3RyxHUgeoR67HpYeMx6SHbYcoBtUGtMYIRdDFTsTEBHFDl8M4wlYB8EEJgKK//X8avrw94v1QfMW8Q7vLe146/LpnOh654/m2uVe5RvlEuVA5aflROYX5xvoUOmx6jzs7e3A77DxufPX9QT4PPp6/Ln+9AAlA0kFWwdWCTYL9wyXDhAQYhGIEoITTRTnFFEVihWSFWkVEBWIFNQT9RLvEcIQdA8HDn4M3gosCWkHnQXJA/QBIQBV/pP84PpA+bb3Rvbz9MDzsPLE8f7wYfDt76Lvgu+M77/vG/Ce8EfxFPIC8xD0OfV79tL3O/mz+jX8vf1I/9EAVQLQAz4FmwbkBxYJLQooCwMMvQxTDcQNEA41DjMOCQ66DUUNqwzuCxALFAr6CMgHfgYiBbUDPAK7ADX/r/0s/K/6Pvnc94z2UfUw9CvzRfKA8d7wY/AO8OHv3u8D8FLwyvBp8TDyHPMs9Fz1q/YW+Jr5Mvvc/JT+VQAcAuMDqAVmBxgJuwpKDMENHg9cEHcRbhI+E+QTXhSqFMkUuBR3FAgUaROcEqMRfxAyD78NKQxzCqAItQa1BKQCiABk/j78Gvr99+v16fP98Snwc+7f7HDrKeoO6SHoZufd5ojmaeaA5s7mUucL6PjoGOpo6+bskO5h8FfybfSf9uj4RPuu/SIAmAIOBXwH3wkxDG0OjhCQEm4UJBavFwsZNBoqG+gbbRy5HMocoBw7HJsbwxqzGW0Y9RZMFXcTeRFWDxINsgo7CLMFHgOBAOL9R/u1+DH2wPNo8S3vFe0i61vpwedY5iTlJ+Rj49niiuJ34qHiBuOm44DkkeXY5lHo+enO68rt6+8q8oT09PZ1+QH8kv4lAbIDNgarCAsLUg17D4IRYxMaFaQW/RcjGRQazhpQG5kbqRuAGx4bhRq3GbQYgBceFpAU2xIBEQgP8wzICooIPwbsA5UBQf/z/LD6ffhg9lv0dPKu8A3vk+1E7CPrMOpv6d/oguhZ6GLon+gM6arpdupv65Hs2u1G79PwfPI99BL2+Pfp+eL73f3W/8oBswONBVQHBgmdChYMcA2mDrYPnxBfEfQRXhKcEq4SlRJQEuIRSxGOEKwPqQ6GDUcM7wqBCQIIdQbdBD8DnwEBAGj+2PxW++T5hvhA9xP2BPUT9ETzl/IP8q3xcPFa8WrxoPH78XryHPPe8770u/XR9v73PvmP+uz7Uv2+/iwAmAH/Al0ErgXvBh0INQk0ChcL3QuCDAYNaA2lDb0NsA1/DSkNrwwSDFQLdwp8CWYINwfzBZwENwPFAUsAzf5O/dL7Xfry+JX3SvYU9fbz8/IN8kjxpvAo8M/vnu+U77Pv+u9q8ADxvvGg8qXzzPQR9nL37fh9+iD80f2N/1ABFQPaBJkGTwj3CY0LDg13DsIP7hD4EdwSmBMqFJEUyxTXFLUUZBTlEzkTYRJdETEQ3g5mDc4LFwpGCF4GYwRbAkcAL/4V/P757/ft9fzzIfJe8LruNu3X66Hqlem26Afoiec+5ybnQ+eU5xjo0Oi56dPqGuyN7Snv6vDN8s706vYb+V37rP0CAFsCsgQCB0YJeQuXDZsPgRFEE+EUVRacF7MYmBlKGsYaCxsZG/Aajxr3GSsZKhj3FpUVBxRPEnEQcQ5UDBwK0Ad0BQ0DnwAw/sX7Y/kP9830o/KV8Kbu3Ow568LpeOhf53nmx+VM5Qfl+uQk5YTlG+bm5uTnE+lv6vbrpe1472vxevOg9dr3Ifpy/Mf+HAFsA7EF6AcMChcMBw7XD4MRCBNkFJMVkxZjFwEYbBijGKcYdxgVGIAXvBbKFawUZhP5EWkQug7wDA8LGwkYBwoF9wLjANL+yPzK+t34BPdD9Z7zGPKz8HTvXO5t7ansEeyn62rrW+t568PrOuza7KPtk+6l79nwK/KY8xv1s/Za+Az6x/uG/UT//gCwAlYE7QVwB90IMQpoC4EMeA1NDv0Ohw/qDyYQOxApEO8PkQ8OD2cOoA27DLgLnQpqCSQIzgZqBf4DiwIWAaP/Nf7P/HX7Kvry+M/3w/bS9f70SPSy8z7z7PK98rHyyfID82Dz3vN79Df1D/YB9wr4KPlY+pf74fw0/ov/5QA8Ao0D1gQTBkEHXAhiCVAKJAvbC3QM7QxEDXkNiw15DUQN7AxyDNYLGgs/CkgJNwgNB88FfwQfA7QBQADI/k791/tm+v74o/dZ9iL1AvT88hLySPGe8Bfwte9572PvdO+t7w3wlfBC8RPyCPMe9FP1pfYQ+JL5KPvN/H/+OgD5AbkDdQUrB9UIcQr5C2wNxA4AEBsRExLmEpITFRRsFJgUlxRpFA4UhxPUEvYR8BDCD3AO/AxoC7kJ8QcUBiYELAIoACH+GfwW+hv4LvZR9Iry3fBM79ztj+xq623qnen66IboQ+gx6FHoougl6dfpuerI6wLtZe7u75rxZvNN9Uz3YPmD+7H95f8cAk8EfAadCK0KqQyLDlEQ9hF3E9EUARYDF9cXehjrGCoZNBkLGa8YHxhfF24WUBUFFJIS+RA+D2MNbgthCUIHFQXdAqEAZf4s/P352/fL9dHz8fEw8I/uFO3B65jqnenQ6DPoyOeP54nntecT6KLoYOlM6mTrpewN7pfvQvEJ8+j03Pbg+O/6Bv0g/zgBSwNTBUwHMwkEC7oMUg7KDx4RSxJPEykU1xRXFaoVzhXDFYsVJhWUFNgT9BLpEbsQaw/+DXcM2AonCWYHmQXFA+4BGABG/n38wfoV+X33/PWV9EvzIvIa8TbweO/h7nLuK+4N7hjuS+6l7ibvy++S8HrxgfKj8970L/aR9wP5gfoG/JD9Gv+iACMCmgMEBV0GowfSCOkJ5ArCC4AMHg2aDfMNKQ48DisO9w2hDSoNkwzfCw4LJAojCQ0I5AauBWsEIAPQAX0ALP/g/Zz8Yvs3+h35Fvgm9072kPXv9Gz0B/TD85/znPO68/nzV/TV9HD1J/b49uL34vj1+Rj7SvyH/cv+FABeAacC6gMkBVQGdAeDCH4JYgouC90LcAzkDDgNaw18DWwNOQ3kDG0M1wshC00KXglUCDMH/QW1BF4D+gGOABz/qP01/Mf6YfkH+Lv2gvVe9FLzYfKN8djwRfDV74nvYu9h74bv0u9E8NvwlvF08nTzk/TO9SX3kvgV+qn7Sv33/qoAYAIVBMUFbQcJCZUKDgxwDbgO4g/tENYRmRI3E6wT9xMYFA4U2RN4E+4SORJcEVkQMA/lDXoM8gpQCZgHzAXxAwsCHQAs/jz8Ufpv+Jr21/Qo85LxGPC+7obtc+yI68bqL+rG6Yrpfeme6e7pbeoY6+/r8ewb7mrv3fBw8iH06/XK97z5u/vF/dP/4wHwA/YF7wfZCa8Lbg0RD5UQ9xE1E0sUNxX4FYsW8BYmFywXAheqFiIWbhWNFIMTURL5EIAP5w0yDGYKhQiTBpUEkAKGAH3+efx9+o/4sfbp9DnzpfEx8N/use2r7M7rHOuW6j3qEuoU6kTqoeoq693ruuy97eXuLvCX8RzzufRq9i34/vnX+7b9l/90AUwDGAXWBoIIGQqXC/kMPQ5gD18QORHtEXkS2xIVEyUTCxPJEl8SzhEYET8QRA8rDvYMqAtECs0IRwe1BRsEfALcAD//qf0c/Jz6LPnR94v2X/VO9Fvzh/LU8UTx1/CO8GrwavCO8NXwPvHJ8XPyOvMe9Br1LfZU94z40/kk+3z82f04/5QA6wE5A3sErwXSBuEH2Qi5CX8KKAu0CyIMcAydDKsMmQxmDBUMpgsZC3IKsQnYCOoH6QbYBbkEjwNeAigB8P+6/oj9Xvw++yv6KPk3+Fv3lvbq9Vj14vSJ9E/0M/Q19Ff0mPT29HL1Cfa89of3afhg+Wr6g/uq/Nz9Ff9SAJEBzwIHBDgFXwZ3B38IdAlUChwLygtcDNEMJw1dDXMNaQ09DfEMhAz3C0wLhAqhCaMIjgdlBigF3AODAiABt/9K/t78dPsR+rn4bfcx9gn19vP98h7yXfG78Drw3O+h74rvme/M7yXwofBC8QXy6fLs8wz1SPab9wX5gfoN/KX9Rv/sAJQCOQTaBXAH+wh0CtsLKg1gDnkPcxBMEQESkBL6EjsTVBNDEwoTqBIdEmsRlBCXD3kOOg3eC2YK1wgzB30FugPtARoARf5x/KL63fgl93316vNv8g/xzO+q7qzt0uwg7JfrOOsE6/vqHuts6+Xrh+xT7UXuXe+X8PLxavP89Kb2Y/gx+gr87P3S/7kBnAN4BUgHCQm4Ck8Mzg0vD3EQkBGLEl8TChSNFOQUEBURFeYUkBQQFGYTlRKeEYMQRw/sDXYM5wpDCY0HyQX7AyYCTwB5/qn84fom+Xz35fVm9ADzuPGP8Ijvpe7n7VHt4uyd7IDsjezC7CDtpO1P7h3vDvAf8U3ylvP39G329PeJ+Sn70Px6/iQAygFoA/wEggb2B1UJngrMC94M0Q2lDlYP5A9PEJQQtRCxEIgQOxDLDzkPhw63DcsMxAunCnQJMAjcBn4FFgSpAjsBzf9l/gP9rftl+i35CPj59gL2JfVk9L/zOvPU8o7yaPJj8n7yufIT84vzIPTP9Jf1dvZq93D4hvmp+tb7Cv1D/nz/tADoARQDNQRJBU4GQQcgCOgImQkwCqsKCwtPC3QLfQtoCzYL5wp8CvcJWQmkCNgH+QYIBgkF/QPmAskBpwCE/2L+RP0u/CD7IPou+U34gPfI9if2oPUz9eH0q/ST9Jf0ufT59FT1zPVe9gn3zfem+JT5lPqj+8D85/0W/0kAfgGzAuMDDQUtBkAHRQg3CRYK3gqNCyMMnQz5DDgNVw1XDTgN+AyZDBsMgAvICvUJCAkECOoGvgWBBDYD4QGEACL/v/1d/AD7q/lg+CT3+fXi9OHz+PIr8nrx6fB48Cjw+u/w7wnwRvCm8CjxzPGR8nTzdfSS9cf2Evhy+eL6Yfzp/Xr/DgGjAjUEwQVDB7gIHQpvC6oMzA3SDrsPgxAqEa0RCxJDElUSQRIFEqQRHBFwEKEPrw6eDW8MJQvCCUkIvgYjBXwDzAEXAGD+rPz9+lj5v/c39sL0ZPMf8vbw7e8E7z7une0i7c3soeyd7MHsDe2A7Rru2e6778Dw5PEl84D09PV89xb5vfpv/Cj+5f+hAVkDCgWvBkYIywk7C5MM0A3vDu8PzhCIER4SjhLXEvgS8hLFEnAS9hFWEZMQrw+qDogNSwz2CosJDgiCBuoESwOmAQAAXP6+/Cr7ofkp+MP2c/U79B7zHvI98X3w3+9k7w7v3O7P7ubuIu+C7wTwp/Bq8UryR/Nc9Ij1yfYa+Hr55fpY/M/9SP+/ADECmwP5BEoGiQe1CMsJyAqrC3MMHA2nDRIOXQ6GDo8Odw4/DucNcQ3eDC8MZguGCo8JhghsB0QGEAXUA5MCTwEMAMz+kv1h/Dz7Jfof+Sv4TfeG9tj1Q/XK9G30LPQJ9AP0GvRO9J30CPWN9Sr23fam94L4bvlp+nD7gPyW/bH+zf/oAP4BDgMVBA8F+wXXBqEHVgj1CH0J6wlACnsKmwqfCogKVgoKCqQJJQmPCOMHIgdPBmwFewR+A3cCagFYAEX/M/4l/R38Hvsq+kX5b/ir9/z2Y/bh9Xf1KPXz9Nr03fT79DX1i/X79YT2Jvfg96/4kfmF+on7mvy1/dn+AgAtAVkCgQOkBL8FzgbQB8EIoQlrCh8Lugs7DKEM6wwWDSQNFA3lDJgMLQykCwALQgpqCXoIdQdcBjMF+wO3AmsBGADC/mv9GPzK+oX5S/gg9wf2AfUR9DnzfPLc8Vnx9fCx8I7wjfCt8O/wU/HW8XryO/Ma9BT1J/ZR95D44PlA+6z8Iv6d/xwBmgIVBIkF8wZQCJ4J2Ar9CwoN/Q3TDosPIhCYEOwQHBEoERER1RB1EPMPTw+KDqYNpAyIC1MKBwmnBzcGuQQxA6EBDAB4/uX8WfvW+V/4+Paj9WP0PPMv8j/xbfC87yzvwO537lPuVO567sTuMu/D73XwSPE58kbzbvSt9QH3Z/jd+V776fx5/gsAnAEpA64EKAaUB/AINwpoC4EMfg1eDh8PwA8/EJwQ1RDrEN0QrBBYEOMPTA+WDsIN0gzIC6cKcQkpCNEGbQUABIwCFQGe/yv+vfxZ+wL6ufiC92D2VPVh9IjzzPIu8q/xT/EQ8fLw9fAY8VvxvfE+8tvylPNn9FD1UPZi94X4tfnx+jX8f/3L/hYAXgGhAtoDCAUnBjYHMggaCeoJogpBC8QLKwx1DKMMsgylDHsMNAzSC1YLwQoUClIJewiTB5wGlwWIBHEDVAI1ARUA+P7g/dD8yvvQ+ub5C/lE+JH39PZv9gH2rfVz9VT1T/Vk9ZP13PU99rb2Rffp96D4aflB+ib7FvwP/Q7+Ef8VABgBFwIRAwEE5wTABYoGQwfpB3sI9whcCaoJ3wn6Cf0J5gm1CW0JDAmTCAUIYwetBuUFDgUqBDoDQQJCAT4AOP8z/jL9NfxB+1f6evms+O/3RPeu9i72xfV09T31H/Uc9TP1ZfWx9Rb2lPYq99b3l/hs+VL6SPtL/Fn9b/6M/6wAzQHtAggEHAUnBiYHFgj2CMMJewodC6cLFwxtDKYMxAzFDKgMbwwZDKcLGgtzCrMJ3AjvB+4G3AW7BIwDVAIUAdD/if5D/QH8xfqS+Wz4VPdN9ln1e/S08wfzdfIA8qjxb/FV8Vrxf/HD8SfyqfJI8wT02vTJ9c/26vcY+Vb6ofv4/Fb+uf8fAYMC5AM9BY0G0AcECSYKMwsqDAcNyg1wDvgOYg+qD9MP2Q+/D4MPJw+rDhAOVw2BDJELiQpqCTcI8wafBUAE2AJpAff/hv4X/a77T/r7+Lb3g/Zj9Vr0avOU8trxPvHB8GTwKPAN8BTwO/CE8O3wdvEc8t/yvvO19MP15/Yc+GH5s/oP/HP92v5DAKkBCwNmBLUF+AYqCEoJVQpJCyQM5AyIDQ8OeA7BDuoO9A7eDqkOVA7iDVYNtgwEDD8LawqICZcImgeTBoMFawRMAykCAwHb/7T+jf1p/Ev7Mvoh+Rv4H/cw9lH1gfTE8xvzh/IK8qXxW/Er8RfxIPFG8Yvx7vFw8hDzzvOp9KD1svbd9x/5d/rh+1r94f5xAAcCnwM2BcgGUQjMCTYLigzGDeUO4w++EHIR/BFbEo0SjxJhEgMSdBG1EMcPqw5lDfULYAqqCNYG6ATmAtYAvP6e/IL6bvhp9nf0oPLo8FXv7O2z7Kzr3OpF6uzp0en16Vnq/urh6wHtXe7v77bxq/PL9Q/4cfrq/HT/BwKcBCoHqwkWDGUOkBCQEl4U9RVPF2gYPBnGGQYa+BmdGfUYARjCFj0VdBNsESsPtwwXClIHcAR6AXf+cvtz+IP1rPL172jtDOvo6AXnZ+UV5BPjZeIN4gziZeIW4x7keuUn5yDpYevi7Z3wifOf9tb5I/19ANsDMQd2CqENpxB/EyEWhBihGnEc7x0WH+IfUSBhIBEgYh9WHvEcNhspGdIWOBRhEVcOIwvPB2QE7QB0/QX6qfZr81XwcO3E6lroOuZp5O3iy+EF4Z7gl+Dv4Kbht+Ih5N7l+OdQ6uHsoO+F8ob1mvi2+9L+4wHhBMEHfAoKDWIPgBFcE/IUPhY+F+8XUBhiGCYYnRfMFrUVXhTMEgYREg/4DMAKcQgUBrIDUQH8/rj8j/qI+Kf29fR18y3yIPFR8MLvc+9m75jvCvC38J3xt/IC9Hb1D/fF+JP6cPxW/jwAHALvA60FUAfRCCsKWAtUDBsNqg3+DRcO9A2VDfsMKQwgC+YJfgjuBjoFagOEAY7/kf2U+575tvfl9TD0oPI58QLwAO847q3tYu1Z7ZPtEO7R7tPvE/GP8kL0KPY6+HL6yfw4/7YBPQTCBj8Jqgv7DSoQLxIDFJ8V/hYZGO0YdhmwGZoZMxl7GHQXIBaCFJ4SehAaDocLxwjjBeMC0P+0/Jn5h/aJ86jw7u1j6w/p+uYs5arjeuKg4SDh/OA04crhvOIH5Krlnufg6WjsL+8u8lv1rvgc/Jv/IAOhBhQKbQ2iEKkTehYKGVIbSx3uHjYgHyGkIcYhgSHYIMofXR6SHG8a+xc9FTwSAg+YCwgIXQSiAOP8KvmE9fvxme5q63joy+Vr42Hhs99l3nzd/Nzm3Drd990d36fgkeLW5G/nU+p77d3wb/Qn+Pj71/+5A5MHVwv7DnQStxW6GHQb3B3rH5sh5yLKI0EkSyToIxkj3yE/ID0e4BstGS4W6xJtD8EL7wcEBAsAEfwh+Ej0kPAE7bDpnebV42DhRd+K3TXcStvL2rraFtvg2xPdrt6q4ALjr+Wo6ObrXe8F89H2t/qs/qICjwZnCh8OrBEDFRwY7BprHZQfXyHIIssjZSSWJFwkuSOvIkMheB9UHd8aHxgeFeQRew7vCkgHkwPa/yn8ivgH9azxge6Q6+DoeuZj5KHiOeEv4IPfON9N38HfkuC94TzjDOUk53/pFOzb7svx2/QB+DP7Z/6UAbAEsgeRCkQNxA8KEg8UzxVFF24YRhnNGQIa5hl7GcIYvxd4FvAULhM5ERcP0QxuCvYHcgXrAmgA8v2R+0z5K/c09Wzz2vGC8GfvjO7y7ZztiO227SXu0u6579fwJvKi80P1Bfff+Mv6wvy8/rIAnQJ2BDYG1gdSCaMKxgu2DHAN8Q05DkYOGQ6yDRMNPgw3CwIKpAghB4AFxgP7ASQASf5y/KT65vhB97n1VfQa8w3yM/GP8CTw8+8A8EnwzvCP8YjyuPMa9av2ZfhC+jz8Tv5vAJgCwwTnBv0I/QrhDKIOOBCfEdASxxOAFPgULBUbFcQUJxRGEyISvhAfD0kNQQsNCbQGPQSwARX/dPzV+UH3wfRc8hvwBO4g7HXqCOnf5//mauYj5izmheYu5yboa+n46srs3O4n8aXzT/Yd+QX8AP8EAggFAQjoCrMNWRDREhMVGRfbGFMafRtVHNYcAB3RHEkcaRszGqsY1ha3FFYSuQ/oDOsJzAaUA00AAP24+X/2YPNj8JLt9+qZ6H/msuQ24xDiReHY4MngGuHL4djiQeQA5hDobeoO7ezv//I99p35FP2YAB4EnAcHC1MOeBFsFCUXmhnEG50dHh9CIAYhZyFjIfogLiAAH3MdjBtQGcYW9RPlEKENMAqeBvQCP/+J+933RvTQ8IPtbOqS5/7kueLJ4DPf/t0t3cHcvdwh3ezdG9+r4Jji2+Rv50vqZ+278Dv03veZ+2L/LAPsBpkKJg6KEboUrhdcGr0cyh58INEhwyJQI3YjNyORIokhICBcHkIc2RknFzYUDRG3DT0KqgYIA2P/xPs2+MX0efFc7nfr0+h25mfkq+JI4UDgl99M32Hf1N+j4MzhSeMW5S3nh+kc7OTu1vHq9BX4TfuK/sEB6QT4B+UKqQ06EJMSrBSAFgoYRhkyGssaEhsGG6ga+hkBGb8XOhZ4FH4SVBABDo0LAAljBr4DGgF//vX7hPk09wz1EfNL8b3vbO5b7Y3sA+y/67/rBOyK7E/tUO6J7/Twi/JJ9Cj2H/gp+j38Vf5pAHECaARFBgMInAkLC0wMWQ0wDs8ONA9dD0wPAA98DsEN1Ay2C24KAAlxB8gFCgQ+AmwAmf7M/A37YfnP9132D/Xr8/XyMfKi8UnxKPFA8ZHxGvLY8srz7fQ89rP3TfkF+9T8tP6eAIwCdwRYBigI4Al7C/IMQA5gD00QBRGDEcYRyxGUER4RbRCAD1wOAw14C8IJ5gfoBdEDpQFu/zH99vrF+Kb2nvS28vTwXu/67czs2usn67XqiOqf6vzqnuuD7KntDe+r8H/ygvSv9v/4a/vs/XkACgOXBRkIhgrXDAUPBxHYEnEUzBXmFrkXQxiBGHIYFhhtF3kWPBW6E/YR9w/CDV0L0AgiBlwDhwCq/dD6APhF9abyLPDf7cfr6ulP6Pvm8uU55dPkwOQC5Zjlgua850TpFesq7X3vCPLC9KP3o/q5/dsAAAQeBysKHg3uD5ISARU0FyMZyRogHCMdzx0iHhketR32HN4bcBqwGKMWTxS5EesO7AvFCH8FJQK//ln7/Pez9IjxhO6w6xXpvOar5OjieuFl4KzfUt9Y377fhOCn4STj9+Qb54npO+wo70jyk/X9+H78CgCYAx0HjgriDQ4RCRTLFksZghtqHfweNSAQIYwhpyFgIbogtR9UHp0clBpAGKcV0RLGD5AMOAnIBUsCyv5P++b3l/Rs8XDuqesg6dzm5OQ94+vh8uBU4BLgLeCk4HXhneIX5ODl8edD6tDskO958oP1pPjU+wj/OAJZBWIISwsLDpoQ8hIKFd8WaxiqGZkaNhuBG3gbHhtzGnwZOxi2FvIU9BLFEGoO7AtUCagG8gM7AYr+6Pte+fL2rPST8qzw/u6M7VrsbOvD6mDqROpv6t7qkOuA7KztD++j8GPySPRL9mb4kfrF/Pr+KAFKA1cFSQcaCcQKQgyPDagOiQ8wEJsQyxC+EHYQ8w86D0wOLg3kC3IK3wgwB2sFlwO7Ad3/A/41/Hn61PhN9+n1rPSc87vyDPKS8U/xQvFt8c7xZPIt8yb0SvWX9gj4lvk9+/j8vv6LAFgCHQTWBXwHCQl2CsAL4gzWDZoOKw+GD6oPlw9LD8gOEA4lDQkMwApOCbkHBQY4BFgCbAB6/oj8nvrC+Pv2TvXC81zyIfEW8D/vn+447gzuHe5q7vPut++z8OXxSfPb9JX2c/hv+oL8pf7SAAEDLAVKB1UJRgsWDcAOPRCIEZwSdhMSFG0UhxReFPITRBNWEioRww8mDlgMXQo9CPwFpAM6Acf+Uvzk+YP3OfUL8wPxJu967Qbsz+rY6Sbpu+iZ6MLoNOnw6fPqO+zE7YvvifG68xb2lvg0++b9pQBnAyYG1whyC/ANSBByEmgUIhadF9EYuxlYGqUaoRpLGqQZrRhpF9sVBxTzEaQPIQ1yCp4HrQSqAZz+jPuF+I/1tPL872/tFuv36BrnheU85EPjn+JR4lviveJ244Tk5OWU543py+tG7vnw2vPi9gf6Qf2FAMsDCAczCkMNLhDrEnMVvhfGGYMb8RwLHs8eOR9JH/8eWh5eHQwcahp7GEUWzxMgEUAOOAsQCNIEhwE5/vL6u/ed9KPx1O447NfpuOfi5VjkH+M74q7heuGd4Rni6uIP5IPlQudG6YnrBO6v8IPzdvaA+Zj8tP/MAtUFxwiaC0YOwhAIExAV1xZXGIsZcRoHG0wbQBvjGjcaPxn+F3oWthS6EosQMQ6zCxkJawayA/cAQf6Y+wb5kPZA9BvyKPBr7uvsquut6vXphOla6Xjp2+mD6mvrkezw7YTvRvEw8zz1Y/ed+eT7MP55ALcC5QT7BvIIxQpuDOcNLQ89EBIRrBEJEigSCRKvERoRTRBLDxkOuww1C44JzAf0BQ4EHwIvAEP+ZPyW+uD4R/fS9YT0YfNv8q7xIvHL8Kzww/AR8ZPxSPIt8z/0efXX9lT46vmV+079D//RAI8CQwTmBXMH5Ag1CmALYgw4Dd0NUQ6SDp4OdQ4ZDooNywzdC8UKhQkjCKMGCgVeA6UB5P8i/mX8s/oS+Yj3GvbN9KbzqPLZ8TrxzvCW8JXwyfAy8dDxoPKg8830I/ad9zb56vqz/Iv+awBNAioE/QW/B2oJ+QpkDKkNwQ6qD18Q3hAlETIRBRGeEP8PJw8bDtwMcAvaCR8IRAZQBEkCNgAc/gT88/ny9wb2NvSI8gPxq++F7pbt4exo7C/sNex87APtye3N7grwf/En8/z0+fYZ+VX7pf0DAGgCywQlB24JoAuyDZ8PXxHtEkQUXhU4Fs8WIBcqF+sWZRaYFYYUMROfEdIP0A2fC0UJyQYzBIsB1/4i/HL50PZF9Njxke937ZHr5el46E/nb+bZ5ZHll+Xt5ZDmgee96D/qBewJ7kXws/JL9Qj43/rJ/b0AswOiBoAJRgzqDmYRsRPEFZkXKxl1GnMbIBx9HIYcPBygG7MadxnxFyUWFxTPEVIPqAzYCewG6wPeAM/9x/rN9+z0K/KT7yvt++oI6Vjn8eXV5Arkj+No45PjEeTg5PzlZOcS6QHrK+2K7xbyyPSY9336b/1lAFYDOQYHCbYLPw6aEMISrxRcFsUX5hi8GUQafhpqGggaWhliGCQXpBXnE/IRzA98DQgLegjXBSoDeQDN/S77o/g29uvzy/Hc7yLuouxi62Pqqek16QjpIumB6STqCess7IjtGu/b8Mby1fQA90H5kPvm/TwAigLJBPEG/gjnCqgMPA6dD8gQuhFxEuoSJBMhE+ASYhKrEbwQmg9IDswMKwtqCY8HoQWmA6YBpf+s/cD75/kp+In2DvW885byofHf8FLw++/c7/PvQfDE8HnxXvJw86r0CfaG9x35yfqC/EX+CQDKAYIDKQW8BjUIjgnDCtELtAxqDe8NQg5jDlIODg6ZDfUMJAwpCwcKxAhjB+gFWgS+AhoBcv/O/TL8pPoq+cn3hvZk9Wj0lvPw8njyMPIZ8jTyf/L78qXze/R69aD25/dM+cn6Wvz5/aH/TAH0ApMEIwagBwQJSQpsC2kMOw3fDVQOmA6oDoYOMA6oDfAMCAz2CrsJWwjcBkIFkgPSAQgAOf5t/Kj68vhP98b1XPQW8/nxCfFI8LvvZO9D71rvqu8x8O7w4PEE81X00vV09zf5FvsL/Q7/GwEqAzUFNAciCfgKsAxEDq8P6xD0EcYSXxO8E9sTuxNcE74S5BHPEIEPAA5ODHEKbwhNBhEEwwFq/w39svpi+CT2//P58RrwZ+7l7JvrjOq86S7p5ejg6CLpqul26oXr0+xe7iHwF/I79IX28Ph0+wr+qwBNA+oFeQjzClANiQ+XEXQTGRWDFqsXjxgrGX4ZhhlDGbYY3xfBFmAVvhPhEc8PjA0hC5MI6wUvA2oAof3f+ir4i/UK86/wf+6C7L7qOOn05/bmQubY5bvl6+Vn5i3nPOiQ6SXr9uz+7jfxmvMg9sH4dvs3/vsAugNsBgkJigvmDRgQGBLiE28VuxbDF4UY/RgrGQ4ZqBj6FwYXzxVZFKkSxBCxDnUMFwqfBxUFfwLn/1P9zPpY+AD2yvO98d7vM+7B7Izrlurj6XTpSull6cTpZupH62bsvu1K7wbx7PL19Bz3WPmk+/j9TACaAtsEBwcYCQcL0AxtDtkPEBEPEtQSWxOlE7ATfhMPE2UShBFtECUPsQ0VDFcKfQiNBo0EhAJ5AHH+dPyH+rH49/Zf9e7zp/KP8ajw9u957zTvJu9P767vQfAH8fvxHPNj9M71V/f4+Kz6bvw4/gIAyQGFAzEFxwZDCKAJ2QrrC9IMjA0WDm8Olw6NDlIO5g1MDYUMlguBCkoJ9QeIBgcFeAPfAUMAqf4X/ZH7HfrA+H/3XfZe9Yf02PNV8wDz2fLg8hXzePMH9MD0n/Wj9sj3Cfli+s77SP3M/lMA2AFXA8oEKwZ2B6cIuQmoCnILEgyIDNIM7QzbDJoMLAySC88K4wnUCKQHVwbxBHgD8QFgAMv+OP2s+yz6vvhn9yv2D/UX9EbzofIo8t7xxfHd8SbyoPJJ8x/0IfVK9pj3BvmQ+jD84v2g/2UBKgPpBJ0GQAjMCT0LjAy2DbYOiA8qEJgQ0hDVEKIQNxCXD8MOvA2GDCQLmgntByIGPgRHAkQAOf4v/Cv6NPhQ9oX02fJS8fXvx+7K7QTtd+wl7BDsOOye7EDtHe4z73/w/fGq84D1eveS+cL7A/5PAJ4C6gQsB1wJdAttDUIP6xBlEqoTthSGFRYWZhZzFj0WxBUKFREU2hJqEcUP7g3tC8YJfwcgBbACNQC4/T/70vh59jn0G/Il8Fzuxuxo60bqZOnD6GfoUOh/6PPoq+ml6t7rU+3+7tzw5vIX9Wj30/lP/NX+XwHkA10GwwgOCzgNOg8PEbASGRRHFTUW4RZJF2wXShfjFjkWTRUjFL8SJBFYD18NQQsECa4GRwTVAWH/8fyN+jz4Bfbu8/7xOvCo7kvtKOxC65zqNuoS6jHqkOow6w3sJe107vbvpfF983j1kPe9+fr7P/6FAMYC+gQbByIJCgvMDGUOzg8EEQQSyxJWE6UTtxONEycThhKuEaEQYw/4DWUMrwrbCPAG9ATsAuAA1v7V/OH6Avk+95j1F/S/8pTxmfDR7z3v4O667svuEu+O7z3wHPEp8l/zu/Q39s/3ffk8+wX91P6iAGoCJQTOBWEH1wgtCl8LaQxHDfgNeg7LDusO2Q6XDiUOhg28DMkLsgp6CSYIugY6Ba0DGAJ/AOn+Wv3X+2b6DPnM96v2rfXU9CP0nPNA8xHzD/M685HzEvS79Ir1fPaN97r4//lW+7z8K/6e/xABfQLfAzIFcAaXB6EIjAlTCvUKcAvBC+gL5Qu3C14L3go2CmkJewhuB0cGCAW3A1gC8ACE/xn+s/xY+wz61fi197L2z/UQ9Xb0BPS986DzsPPr81H04fSa9Xn2e/ed+Nz5Mvud/Bf+m/8kAa4CMQSrBRQHaQilCcQKwQuYDEgNzA0jDkwORQ4ODqcNEg1QDGMLTQoSCbUHOwapBAIDTQGP/839DfxV+qv4E/eT9TH08fLX8efwJPCS7zPvCO8S71Hvxu9v8EvxVvKQ8/P0fPYm+O35yvu5/bT/tAG0A6wFlwdvCS4LzgxLDp4PxRC7EXwSBxNYE3ATTRPvElcShhF/EEUP2w1EDIcKpwiqBpYEcgJEABL+4/u++an3qvXI8wnycfAH783tyez962zrGOsC6yvrkes17BTtLO557/nwpfJ79HP2ifi2+vT8O/+FAcwDCAYyCEUKOQwKDrEPKRFvEn4TUxTsFEYVYhU+FdoUORRdE0YS+hB8D9AN/AsECvAHxQWKA0YB//68/IT6XvhP9mD0lPLx8HzvOu4u7Vvsw+tp60zrbevM62bsO+1I7ojv+PCV8lf0O/Y6+E76cPyb/sgA7wILBRUHBwnbCowMFQ5xD5wQlBFVEt0SKxM/ExgTuBIfElARTRAbD70NNwyOCsgI6gb6BP8C/gD9/gP9Fvs7+Xn31fVS9PfyxvHE8PLvVO/r7rfuue7x7l3v/O/M8Mnx8PI99Kz1OPfd+JT6WPwj/vD/ugF5AyoFxwZKCLAJ8woRDAYNzw1qDtYOEg8dD/gOow4gDnANmAyZC3cKNgnbB2oG5wRZA8MBLACZ/g79kfsm+tL4mfd/9of1tfQK9IjzMvMG8wfzM/OK8wr0sPR89Wn2dPea+Nf5JfuC/Of9UP+5ABwCdQO/BPYFFwccCAMJyglsCuoKQAtuC3MLUAsGC5UK/wlGCW0IdwdnBkIFCwTGAngBJgDT/ob9QfwL++b51/ji9wr3Uva89Uv1APXc9OD0DPVf9dj1dvY39xj4Fvku+l37nfzr/UP/nwD8AVQDogTjBRIHKggoCQgKxwpjC9gLJQxJDEQMEwy6CzcLjAq8CckItQeFBjsF3QNuAvIAcP/s/Wv88fqE+Sn45Pa69a70xfMB82by9vGy8ZzxtPH78XDyEvPf89X08vUx95D4Cvqa+z397P6jAFwCEQS+BV0H6AhbCrEL5QzzDdkOkQ8cEHUQmxCPEE8Q3Q84D2MOYA0yDN0KYwnLBxcGTgR0ApAAp/7A/N/6CvlI9571EvSn8mLxSfBd76PuHO7K7bDtzO0g7qruae9b8Hzxy/JD9OD1nPdz+WD7XP1i/2sBcQNuBV0HNwn2CpYMEQ5iD4YQeRE5EsISExMrEwoTsBIeElYRWRAsD9ENTAyiCtkI9Ab7BPMC4gDO/r78uPrC+OL2HfV58/vxp/CB743uze1E7fPs2+z97Fjt6u2y7q3v2fAy8rPzWPUd9/r47Prs/PP+/AABA/sE5Qa4CHAKBwx5DcAO2g/EEHoR+xFFElgSMxLYEUcRgxCOD2sOHg2qCxYKZAicBsIE2wLvAAL/G/1A+3X5wfcp9rH0XfMy8jPxYvDC71XvHO8W70Tvpe838Pnw6PEA8z70nfUb97D4WvoR/NH9lf9XAREDvQRYBtwHRQmNCrMLsQyGDS4Oqg72DhMPAA++Dk8OtA3vDAMM9ArECXkIFQefBRoEjAL5AGf/2/1a/Oj6ivlE+Br3EPYo9Wb0y/NZ8xHz9fIC8zvznPMl9NP0pfWW9qT3y/gH+lT7rfwO/nL/1AAxAoIDxQT1BQ4HDAjtCK4JTArGChoLRwtNCy0L5gp7CuwJPAltCIIHfwZnBT4ECAPJAYYAQ/8E/s38o/uK+oX5mPjG9xL3fvYM9r31k/WP9a/18/Vc9ub2kfda+D75OvpL+238nP3U/hEATwGIAroD4AT1BfYG4AevCGAJ8QlgCqwK0grSCq0KYgrzCWAJrAjYB+gG3gW+BIsDSgL+AKz/Wf4I/b/7gfpT+Tn4N/dR9on14vRf9AL0zPO+89nzHfSI9Bv10/Wu9qr3xPj4+UL7oPwL/oD/+wB1AuwDWAW3BgQIOglVClELKwzgDG4N0g0LDhgO+Q2sDTQNkQzFC9MKvAmFCDAHwgU/BKwCDgFp/8P9IfyI+v34hfcl9uD0vfO98uTxNvG08GDwPPBJ8IXw8vCN8VbySvNl9Kb1CPeI+CD6zPuH/Uv/FAHcAp0EUQb1B4IJ9ApGDHQNeg5WDwQQghDOEOgQzxCDEAUQVg94Dm8NPAzjCmkJ0QchBl4EjAKzANb+/Pwq+2b5tfcd9qL0SfMV8gvxLvCA7wTvu+6l7sTuFu+b71HwN/FI8oPz4/Rl9gP4ufmB+1f9NP8TAe4CwASDBjIIyAk/C5UMxA3JDqEPShDBEAYRGBH2EKIQGxBlD4AOcQ06DN8KZAnPByMGZgSdAs8A//40/XP7wvkl+KL2PfX589zy5/Ee8YPwGPDe79Tv/O9U8NvwkPFv8nbzovTv9Vn32/hw+hT8wv1z/yQBzwJuBP0FdwfXCBsKPAs6DBANvA09DpEOuA6xDnwOGw6PDdsM/wsBC+IJpghTB+sFcwTxAmkB4P9a/t38bfsP+sb4l/eF9pT1xfQc9JrzQfMR8wvzLvN68+3zhvRC9R/2Gfcu+Fr5mPrl+zz9mP72/1EBpQLsAyQFSAZVB0cIGwnQCWIK0QobCz8LPgsXC8sKXArLCRsJTQhlB2YGVAUxBAMDzAGSAFn/I/73/Nb7xvrK+eX4Gfhq99r2avYc9vH16fUD9kH2oPYf9733d/hL+TX6M/tC/Fz9gP6o/9EA9gEUAycELAUeBvsGvwdoCPQIYAmsCdYJ3QnCCYUJJgmnCAkITwd6Bo4FjgR9A18COAEKANv+r/2J/G37YPpl+X74sPf+9mn29PWh9XD1Y/V69bX1E/aU9jX39ffS+Mn51vr3+yf9ZP6o//AANwJ6A7QE4QX9BgQI8wjHCXwKEAuBC84L9Qv1C84LgAsNC3UKugneCOMHzgagBV0ECgOrAUQA2f5v/Qr8r/pj+Sn4Bff89RD1RfSe8x3zw/KS8ovyr/L88nLzEfTV9L71yfby9zX5kPr++3r9Af+NABkCogMhBZIG8gc6CWgKeAtlDC4Nzw1HDpMOsw6mDmwOBg51DbkM1wvPCqUJXAj5Bn8F8wNaArgAE/9v/dL7QPq++Fb3Efbz9P7zNPOW8iXy4PHH8djxEvJw8vLylPNS9Cn1F/YX9yf4RPlq+pj7yvz//TX/agCdAcwC9gMaBTcGSgdTCFAJQAogC+8LqgxODdkNSQ6ZDsgO0w63DnEOAA5hDZUMmgtwChkJlgfrBRoEKQIcAPr9yfuT+V73NPUd8yTxUe+t7UDsFOsv6pjpU+ll6dDpleq16yzt9+4Q8XDzEPbk+OH7/P4oAlYFeAiBC2MODxF6E5cVXBfAGLsZSBpkGgwaQhkJGGYWXxT+EU4PWwwzCeUFgAIV/7T7bvhS9W7y0u+J7Z3rGeoB6VzoK+hv6CPpRerM67Dt5e9g8hH16/fd+tf9ygClA1kG2AgWCwYNoA7bD7QQJhEyEdgQHhAJD6EN8QsFCukHqwVbAwcBv/6Q/In6tvgk99v14/RD9P3zFPSF9E31Z/bL9275R/tG/WD/hAGkA7EFnAdWCdQKCQzrDHMNmw1gDcEMwQtjCq4IrAZnBO4BT/+a/OD5NPel9EfyKPBa7uns4etM6zHrlOt27NftsO/88a70uvcR+6H+VgIcBt0Jgw34ECcU+xZjGU4brRx2HaAdAx3DG+IZaxdoFOgQ/Qy7CDkEj//W+if2nPFP7VfpyuW/4kXgbN5A3cjcCN0C3rHfD+IP5aPouuw/8Rv2NPtxALYF5wrpD6IU+RjXHCYg1iLXJCAmqCZsJm4lsiNBISgedRo+FpYRlgxZB/gBkPw99xnyP+3I6MnkWOGE3lvc6Now2jba+dpy3JneYeG65JHo0uxk8TD2G/sMAOoEmgkFDhUSthXXGGkbYR24Hmkfcx/aHqQd2xuLGcUWmRMbEGEMggiSBKoA3/xG+fL19vJf8Dzulexy69bqwOov6xzsfu1K73Hx5POS9mb5T/w3/wwCuwQyB2EJOguxDL0NVw59DiwOaA03DKAKrwhxBvQDSwGI/r37/vhe9vHzx/Hx733ueO3r7NzsT+1F7rrvqvEM9NL28PlV/e0ApQRnCBwMsA8MExsWyRgFG78c6R18Hm4evR1pHHUa6hfQFDYRLQ3ICB0EQ/9T+mb1lfD867LnzuNm4I3dVNvH2fHY19h92eDa+9zF3zHjL+es65LwyfU3+8EASwa7C/QQ3RVcGlweyCGQJKUm/yeWKGkoeSfLJWkjYSDBHJ4YDRQmDwMKvgRx/zn6L/Vt8AnsGeiw5N7hr98t3lvdPd3P3Qzf6+Bg41rmx+mT7anx8PVR+rP+AAMeB/oKfw6bET8UXxbzF/MYXRk0GXkYNhd0FUETrBDHDaMKVwf2A5YAS/0q+kT3q/Ru8pnwNu9N7uDt8+2B7obv+vDT8gL1evcq+v/85v/NAp8FSgi9CucMug4oECoRthHIEWARfxAqD2cNQQvGCAMGCQPr/738kPl79pDz4fCC7oHs7erQ6TTpHumS6Y7qD+wO7oPwYPOV9hP6xv2YAXYFSAn5DHIQoRNwFs8YrxoEHMQc6RxwHFkbqRlmF5wUVxGqDaUJXwXtAGj86PeF81fvdev25+vkaOJ64C3fit6V3k/fteDC4mvlpOhd7IHw/fS5+Zz+jgNzCDINsxHeFZwZ2hyGH5Mh9SKlI6Aj5SJ4IWAfqRxhGZkVZBHaDBEIIgMo/jv5dvTx78PrAei/5Avi9N+D3r/dqd1B3oPfZ+Hg4+HmWOoz7lvyu/Y6+8D/NgSFCJUMUhCqE4wW6xi9GvkbmxykHBUc9RpMGSYXkRSfEWAO6gpQB6gDBwCC/Cz5F/ZU8/Lw/O577Xbs8Ovq62DsTe2p7mnwgPLe9HP3Lvr7/Mj/gwIZBXsHlwliC88M1g1vDpkOUQ6aDXkM9QoZCfIGjQT7AU3/lfzl+VH36vTB8ubwZu9O7qftd+3E7Y3u0O+K8bHzO/Yb+UL8nv8cA6gGLgqYDdIQxxNmFpwYWxqWG0McXBzbG8EaERnRFgkUxhAYDREJwwRGAK/7F/eV8kLuNeqE5kTjhuBb3s7c69u32zXcZd1B38Lh3OSA6J7sIfHy9fv6IQBLBV8KRA/hEx8Y6BsqH9Qh2SMvJdEluyXuJHAjSCGDHi4bXRciE5QOywnfBOr/BPtH9srxpO3o6ajm8+PX4Vrgg99U38rf4uCS4tDkjOe26j3uCvII9iH6Pv5JAiwG0wkqDSIQqxK6FEUWSBe/F6sXDxfyFV0UXRIAEFUNbwpgBzsEFQEB/hH7V/jj9cPzA/Kt8MjvV+9b79TvvfAN8rzzvvUE+H/6Hv3Q/4ICIwWgB+kJ7wukDfwO7g9yEIUQJRBTDxMObAxoChMIegWsArz/u/y7+dD2DPSB8UDvV+3U68LqKuoQ6nnqY+vN7K/uAPG288L2FPqb/UEB9QSfCC0MiA+eElsVsBeOGegathvxG5YbpBogGQ8XexRwEf8NNwouBvcBqf1c+SX1HPFY7ezp6+Zn5G7iC+FG4CbgquDT4Zrj9uXd6EDsDfAw9JX4Jf3HAWMG4gorDykTxhbvGZQcph4cIO0gFSGUIGwfpB1FG1wY+RQtEQ0NrggoBJL/BfuX9mHydu7t6tbnQOU648vh+uDK4DvhSeLt4x3my+jp62TvKfMk9z77YP92A2kHJQuVDqoRUxSEFjIYVxnvGfkZdhltGOYW6hSIEs8PzwybCUcG5QKL/0r8Nfle9tTzpPHZ733ule0k7Svtp+2T7ufvmfGd8+T1X/j9+q39XAD6AnUFvQfECX0L3QzaDXAOmg5XDqkNlQwjC1oJRwf4BHwC4/89/Z76Fvi39ZHzs/Eq8APvRu777SXuxu7d72XxV/Oq9VL4QPtk/q0BCAVhCKQLvw6dES0UXxYkGG8ZNhpzGiEaPxnQF9cVXhNvEBgNagl3BVIBEf3K+JT0hfCz7DPpGOZ041Xhyd/Z3ore4d7e33zhtON95snpiO2p8Rb2ufp7/0UE/giODd8R2hVrGYAcCh/9IE4i9yL2Iksi+iAKH4Ycexn6FRUS4A1xCeAEQwCy+0X3EfMr76frlegE5v/jjuK44X7h4OHY4l/ka+bv6NzrIO+o8mD2NPoN/tcBfgXuCBYM5Q5PEUcTxRTEFUAWOha1FbYURxNxEUMPywwaCkAHUQRfAXv+uPsm+dP2z/Qj89nx+PCD8H3w5PCz8eTyb/RI9mL4r/of/aL/JwKcBPIGGAkBC54M5Q3NDk8PZw8SD1MOLA2lC8QJlwcpBYgCxv/y/B/6Xfe/9FbyMPBe7urs4OtI6yjrg+tY7KbtZu+R8Rz0+vYb+nD95gBqBOgHTQuEDnwRIxRoFj4YmhlxGr4afRqtGVEYcBYRFD8RCg6ACrUGuwKo/pH6jPav8g3vvOvN6FHmVeTl4gnixuEf4hLjnOS15lLpZ+zj77Tzx/cG/FwAsgTxCAIN0hBLFFsX8xkGHIcdcR6+Hm4egR3+G+0ZWRdQFOMQIw0lCf8ExQCP/HL4hPTa8IXtl+of6CjmvOTh45rj6OPG5DHmHeiA6kvtbvDY83b3Mvv5/rYCVQbDCe0MxA85EkAU0BXiFnIXfxcKFxoWtBTiErIQMQ5uC3wIawVNAjb/N/xh+cX2cPRv8s7wk+/F7mbueO737t/vKfHL8rr05/ZG+cX7VP7jAGEDvgXrB9oJfgvODMANTw53DjgOkg2KDCcLcAlyBzkF0wJPAL79Mfu3+GP2Q/Rl8tjwpu/Y7nXugu4B7/DvTPEP8zD1pPde+k79ZgCSA8EG4AndDKQPJhJTFBwWdRdUGLMYjBjeF6oW9RTGEiYQIg3ICSoGWQJq/nD6gva08hrvyevR6EXmM+Sm4qnhQeFz4T7in+OR5QzoAutl7ibyMPZx+tL+PQOcB9kL3g+WE+8W2BlCHCEebB8cIC4goh98HsMcfhq8F4oU+RAcDQcJ0ASLAFD8NPhK9KjwXu196hLoKebJ5Pfjt+MI5OTkR+Ym6HbqKe0u8HPz5/Z2+gz+lQH/BDgILgvSDRkQ9hFiE1gU1BTVFGAUeRMoEnYQcQ4mDKMJ+gY8BHgBwv4o/Lr5iPed9QX0yPLt8XfxaPHA8XrykPP79LH2pfjK+hH9a//IARkETQZWCCYKsQvsDM4NUQ5wDioOgA10DAwLUAlLBwcFkwL+/1b9rfoU+Jr1UPNE8YXvHu4Z7X/sVuyf7Fzti+4m8CfyhPQw9x76Pv1/ANADHgdWCmYNPBDIEvoUxhYfGPwYWBkvGX8YSxeXFWwT1BDbDZAKBQdLA3X/mfvK9x30pfB17Z7qMeg55sTk2ON747Djd+TM5ajnAurP7P/vg/NI9zv7R/9WA1UHLQvMDh4SERWXF6MZKhslHI4cZRyqG2MalRhMFpQTexATDW4JnwW6AdX9BPpa9uvyye8D7afqweha53jmHuZN5gLnOejp6QjsiO5c8XP0u/ci+5X+AQJUBXsIZgsFDksQLRKiE6QULhU/FdkUARS8EhQRFA/JDEEKjAe7BN4BBv9F/Kr5RPch9Uzzz/Gy8Pvvq+/E70TwJfFi8vHzyPXZ9xn6d/zk/lABrQPqBfoHzwleC5wMgg0JDi8O8w1UDVgMBAthCXgHVQUHA5sAIP6n+0D5+fbj9ArzfPFE8Grv9e7q7kvvGPBN8eTy2PQc96X5ZvxO/04CVQVQCC4L3w1SEHcSQhSlFZkWFRcUF5UWmRUhFDYS3w8nDR0KzgZNA6r/+vtQ+L/0W/E27mHr7ejn5lrlUeTS4+DjfOSl5VTng+kn7DPvmPJE9ib6Kf45AkEGLQroDWARgxRAF4oZVhuZHE8dcx0GHQkchBp9GAAWGxPcD1UMmQi6BM0A5/wb+Xz1HfIO71/sHOpQ6APnOeb25Tjm/eY+6PPpEeyM7lTxWvSL99f6Kv5zAZ8EnwdhCtkM+g66EBAS+RJwE3UTCxM2Ev8QbA+LDWcLEAmTBgEEagHd/mv8IfoO+D32ufSK87byQfIt8nnyIvMi9HL1Cffc+N76Af03/3IBogO5BakHZQngChIM8Qx2DZ8NaQ3UDOMLmwoDCSQHCgXBAlYA2f1Z++X4jPZf9GvyvPBf717uv+2K7cDtY+5w7+XwufLl9F73Fvr//AoAJQNBBkoJMAzjDlIRbxMtFYIWZBfNF7oXKBcaFpUUnRI+EIINdwotB7UDHwCB/Ov4cvUo8h7vZuwN6iHorOa35UflX+X/5SXnyujn6nHtWvCU8w73tvp5/kMCAQafCQoNMRADE3IVcRf3GPsZeRpvGt0ZyBg1Fy4VvRLxD9gMhAkFBnAC1v5M++P3rvS88R7v3+wM663px+hf6HXoB+kR6ovrbu2r7zjyBPX/9xn7Qf5jAXAEVwcHCnQMkA5REK4RoRImEz0T5hIlEgARfw+sDZQLQwnIBjIEkQH1/m38CPrU9971MPTU8tDxK/Hn8ATxgfFZ8obz//S89rD4z/oK/VT/nQHYA/QF5wehCRoLRwwgDaANxA2LDfQMBQzCCjIJYAdXBSID0ABv/g38u/mG9371rvMk8unwCPCF72fvr+9d8G/x3/Ko9MD2G/mu+2n+PQEcBPMGswlLDKwOxxCQEvsT/hSSFbIVXRWRFFETpBGPDx4NXQpZByEExwBc/fL5nPZr83Hwvu1i62np3ufL5jfmJeaW5orn/Ojl6jzt9e8D81b23vmI/UEB9wSVCAsMRQ8zEsYU8RapGOUZnxrUGoMarhlaGI4WVBS4EckOlQstCKUEDQF5/fv5pfaJ87XwOO4d7G/qNel06C/oZOgT6TXqwuux7fbvhPJL9Tz4RftX/mABTwQWB6UJ7wvpDYkPyBCgERASFRKzEe4QzA9WDpUMlgpmCBMGqwM+Adr+jvxo+nP4vfZO9S70Y/Py8tvyH/O686f04PVd9xL59fr4/A//KwE+AzsFFAe9CCwKVQsyDLwM7gzHDEcMcAtGCtEIGAclBQQDwgBt/hL8wfmI93X1lvP28aLwoe/97rru2+5i707wm/FC8z31gfcD+rX8iP9uAlYFMAjrCnkNyg/REYET0BS1FSsWLBa4FdAUdxOyEYwPDQ1DCjsHBQSxAFL9+fm39p7zvvAo7ujrDOqd6KTnJucm56XnoegU6vjrQ+7o8NzzDfds+uf9bAHoBEoIgAt4DiUReBNlFeMW6hd2GIMYExgpF8kV/BPLEUQPcwxpCTYG6gKY/1H8Jvkp9mjz8fDR7hPtvuvZ6mfqaere6sLrD+287r/wDPOV9Uv4IPsC/uIAsANbBtcIFgsLDa0O9A/aEFwReBEuEYMQew8eDnUMjAptCCgGyQNfAfn+pfxx+mv4nPYR9dHz5PJN8hHyL/Km8nLzjfTw9ZH3Z/lk+3z9ov/IAeAD3AWxB1IJtQrRC58MGQ08DQcNegyZC2gK7wg1B0cFLgP5ALT+bfwz+hT4HPZZ9NfynvG58Czw/u8x8MTwtvEC86T0kfbA+CX7tP1eABMDxQVlCOIKLg08D/8QbBJ6EyEUXRQqFIkTexIFES4P/gyACsAHzgS4AY7+YvtE+EX1dvLl76Httusv6hbpcOhC6I7oUumL6jTsRO6x8G/zb/ai+fj8YADHAxwHTwpODQkQdBKAFCUWWRcXGFsYJBhzF04WuRS+EmgQxA3eCsgHkgRLAQb+1PrE9+j0TfIA8Azue+xV653qV+qB6hvrH+yH7UnvWvGv8zr27Pi2+4j+UgEGBJQG8AgMC98MXw6FD00QsxC4EFwQpA+WDjkNlwu7CbAHhQVGAwEBxf6f/Jv6xvgq99H1wvQC9JbzfvO880z0KfVO9rP3TvkV+/v89P7zAOwC0QSVBi0IjwmxCowLGQxUDDwMzwsQCwMKrggYB0oFTwM0AQT/zfyd+oH4h/a79Cnz2/Hb8DDw3+/r71fwIfFG8sHzjPWc9+j5Yvz//q8BZQQPB6AJCgw9Di0QzhEWE/4TfhSUFDwUeBNKErkQyg6IDP0JNwdEBDMBFP74+u/3CfVW8uTvwO3365LqmekR6f3oX+k06nrrKO03753xTPQ39076gv3CAPwDIQcfCugMbA+fEXYT6BTsFX8WnhZJFoMVTxS1Er8Qdg7oCyMJNgYwAyEAG/0t+mb31fSH8ojw4O6a7bnsQuw27JPsWO197vzvy/Hf8yz2pfg6+979gQAVA4sF1gfpCbsLQA1zDkwPyg/pD6wPFA8mDuoMaAupCbkHowV2Az4BCv/l/N36//hU9+f1v/Tk81nzIvM/867zbPR09b/2Rfj7+df7zP3P/9IByAOlBV4H5gg1CkILBQx7DJ4MbwztCxwLAAqeCAAHLwU1Ax4B+P7O/K/6qPjF9hH1mfNm8oDx7fCy8NLwTfEh8kzzx/SL9pD4yfor/an/NQLABD0HnQnSC88NiA/yEAUSuhIME/cSehKYEVQQtA6/DH8KAAhPBXkCjv+d/Lb56PZC9NTxqe/P7VDsNOuB6jzqZ+oB6wjsd+1G723x4POU9nn5gfyc/7kCygW9CIMLDw5SEEES0hP9FL0VDRbtFV4VYxQBE0ERLA/ODDMKaQd/BIUBi/6g+9P4NPbO86/x4u9t7lrtq+xk7ITsC+3z7TbvzfCu8s30HveU+SD8tf5DAb0DFQY/CC8K2ws8DUoOAQ9dD2APCg9eDmINHgyZCt4I+AbzBNsCvwCp/qj8x/oR+ZD3TvZP9Zz0NvQf9Fj03/Su9cH2EPiT+T/7Cf3n/ssAqgJ3BCcGrgcECR4K9gqFC8gLvAthC7kKxgmPCBkHbwWYA6ABlP9//W77bvmL99H1TPQF8wbyVPH28O7wQPHp8ejyOfTU9bL3yvkP/Hf+8wB2A/MFWgifCrQMjQ4fEGERShLUEvwSwBIeEhsRug8BDvoLrgkpB3gEqAHK/uv7G/lp9uPzl/GS797theyO6/7q2uoi69Xr8Oxs7kPwavLY9H73UPo+/ToAMwMaBuAIdgvQDeEPnhEAE/0TlBS/FIAU2BPLEmARng+PDT8LuggPBksDfgC2/QP7cvgR9uzzDvKA8Ervce757ePtL+7Z7t3vM/HV8rf0zvYO+Wr71f1AAJ4C4gT/BusImgoFDCMN8A1oDooOVw7QDfoM2gt6CuEIGwcxBTEDJwEe/yT9RPuJ+f73rPaZ9c30TPQY9DH0l/RH9Tz2b/fZ+HD6K/z//d//wAGWA1YF9AZmCKIJoQpcC84L9AvMC1cLmAqRCUkIyAYVBTwDRgFA/zb9NPtH+Xr32PVt9EHzXfLF8YDxj/H08a3yt/MN9ar2g/iQ+sb8F/95AdwDNQZ0CI4KdgwiDoYPmhBYEboRvRFgEaQQjQ8eDmAMWgoYCKQFCwNcAKT98vpV+Nr1j/OA8brvRO4p7W7sF+wm7Jzsd+2z7kjwL/Jf9Mv2aPkn/Pv+1AGjBFoH6glHDGMONRCyEdMSkxPtE+ETbxOaEmcR3A8DDuULjgkLB2kEtwED/1r8zPlm9zT1QPOW8T3wO++V7k7uZe7a7qfvyfA48uvz1/Xy9y76gPza/i8BcgOXBZEHVwnfCiIMGA2/DRMOFA7DDSMNOgwNC6QJCQhGBmcEdgKAAJH+tPz1+l75+PfL9t71N/XY9MP0+PR29Tj2Ovd0+N/5cvsh/eT+rQBzAigEwwU6B4IIkwlnCvcKQAs/C/QKYAqGCWsIFAeKBdUDAAIVACH+LvxJ+n341vZe9R/0IPNp8v/x5vEf8qryhfOt9Bz2yvew+cP79/1BAJUC5AQjB0QJOwv+DIAOug+jEDYRbxFLEcsQ7w+8DjgNaQtZCRMHoQQSAnL/z/w3+rj3YPU781Xxt+9s7nnt5eyz7OTsd+1q7rfvWfFG83X12fdn+hL9yv+DAi0FuwcfCk0MOg7cDyoRHxK0EukSuxIuEkMRAhBwDpYMgAo4CMsFRwO4AC3+s/tX+SX3KvVv8/zx2fAL8JXvee+270vwMvFl8t7zk/V594b5rvvj/RsARwJcBE4GFAiiCfIK/Au8DC8NUg0mDa0M6wvlCqQJLQiMBsoE8wIRATH/Xf2h+wf6mPhd9172n/Ul9fL0CPVk9QX25/YC+FH5zPpn/Br+2v+bAVMD9wR7BtgHBAn3CasKGwtFCyYLvwoSCiMJ9geSBv8ERwNzAY//pf3C+/D5Ovit9lD1LfRL87HyYvJi8rLyUfM89G/15PaT+HT6ffyi/tcAEQNDBWEHXQkuC8gMIg4zD/UPZBB7EDkQnw+wDm8N4wsTCgkI0AVyA/0Aff4A/JP5Q/cc9Svze/ET8PzuPe7Z7dLtKu7f7u3vTvH88u70Gvdz+e/7gP4XAakDJgaDCLMKqQxdDsUP2xCYEfkR/RGlEfEQ5w+MDukMBgvtCKsGTATcAWj//vyr+nr4d/at9CXz5fH18FjwEfAg8ITwOvE98obzDvXK9rL4uvrV/Pn+GAEoAxwF6gaICO4JFQv2C44M2gzaDI4M+gsiCwwKvwhDB6MF6AMcAkwAgf7I/Cr7sPlk+E33cfbV9X31avWb9RD2xva299z4MPqp+z/95v6UAEAC3gNkBcgGAggKCdgJaAq1Cr4KgQr/CTwJOggBB5YFAgROAoQAsP7b/BD7XPnI9172J/Ur9HHz/vLU8vjyZ/Mi9CT1avbr96L5hPuI/aL/xwHrAwIGAAjaCYUL9wwoDhAPqg/yD+QPgQ/LDsMNbwzWCv8I9AbABG0CCgCh/UD78/jI9sn0AvN88T/wU++87n7um+4R79/vAfFw8ib0GfY/+I369vxu/+gBVwStBuAI4gqrDDAOag9SEOUQIBEBEYsQvw+kDj4Nlgu2CacHdgUtA9oAif5H/B/6HPhK9rL0W/NM8ovxGvH78C3xsPF+8pLz5vRy9iz4CfoA/AT+CwAIAvEDugVbB8oIAAr2CqgLEww2DA8MogvyCgMK3QiFBwYGaAS2AvkAPv+N/fL7dvoh+fz3Dvdb9uf1tvXH9Rr2rfZ794H4tvkU+5L8Jv7H/2oBBgOPBP0FRgdiCEoJ+QloCpcKggoqCpAJuAimB2AG7QRXA6YB4/8a/lX8n/oD+Yn3O/Yi9UX0qfNS80TzgfMG9NP04/Ux97f4bfpI/ED+SgBaAmQEXgY7CPIJeAvFDNANlA4KDzEPBw+LDsANqQxLC68J2gfYBbMDdgEt/+T8p/qD+IP2sfQZ88Hxs/Dz74fvb++u70LwKPFb8tXzj/V/95v51/sp/oQA2gIhBUwHTwkgC7YMCA4PD8gPLRA9EPkPYg98Dk0N2gssCkwIRgYjBPABuP+I/Wv7bPmX9/P1i/Rk84Xy8fGr8bTxCfKq8pDzt/QY9qn3Yvk4+yH9E/8AAeACpwRMBsYHDAkZCucKcQu2C7YLcAvoCiEKIQnvB5EGEgV5A9IBJQB+/ub8Z/sK+tf41PcI93f2JfYS9kD2rPZU9zT4RfmB+uH7XP3n/nsADQKSAwIFVAZ/B3wIRAnSCSIKMwoDCpIJ5Aj8B94GkQUdBIoC4QAr/3T9xvsp+qn4T/cj9iv1cPT288Dz0PMn9MT0pPXD9hv4pflZ+y79G/8TAQ0D/QTZBpUIKAqJC7AMlQ0zDoYOjA5EDq4NzgynCz8KnQjKBtAEtwKNAFz+L/wU+hT4O/aS9CTz9/ES8XvwM/A+8JvwSPFB8oLzBfXA9qv4vPrn/CL/YAGVA7YFuAeQCTULnQzCDZ4OLQ9rD1kP9w5HDk4NEQyYCuoIEQcYBQgD7gDV/sf80fr8+FP33fWi9Kjz9fKK8mnyk/IG877zt/Tp9U/34PiR+lr8Mf4JANoBmAM6BbgGCAgkCQcKqwoOCy8LDQuqCgkKLgkgCOUGhQUIBHgC3gBF/7X9OfzY+pz5jPit9wX3mPZn9nT2v/ZE9wH48fgP+lL7tPwr/q7/NQG1AiYEfgW1BsMHoQhKCboJ7QniCZkJEglRCFkHMQbfBGkD2gE5AJH+6vxQ+8z5Z/gp9xr2QvWl9Ej0LfRX9MT0dPVi9oz36fh0+iP87/3M/7IBlANpBSYHwggzCnALcww1DbEN5Q3ODW0NwwzTC6EKNAmTB8YF1wPQAb3/p/2a+6L5yPcY9pn0VfNS8pbxJPEA8SrxovFk8m7zuvRA9vn32/nd+/T9FAAzAkUEPwYWCMIJOQt0DGwNHQ6DDpwOaQ7qDSMNGQzRClMJqAfXBewD8QHx//f9Dfw9+pL4E/fK9bv07fNj8x/zIvNs8/nzxvTP9Qz3dfgD+q37aP0r/+sAnwI9BLwFFAc9CDIJ7gltCqwKqwpsCu8JOQlOCDUH9QWUBB0DlwENAIf+D/2t+2r6Tvle+KH3GvfM9rn24vZF99/3rfiq+c/6Ffx0/eX+XQDUAUEDmwTaBfUG5genCDMJhgmdCXkJGQl/CK4HrAZ9BSgEtQIsAZf//v1r/Oj6fvk0+BT3JPZq9ev0q/Sr9Oz0b/Uv9iv3XPi8+UX77vyu/nwATAIWBM8FbQfoCDYKUQswDNAMLA1CDRENmAzbC90KogkyCJMGzgTsAvgA+/4B/RT7P/mL9wH2q/SP87PyHPLO8crxEPKg8nXzjPTf9Wf3G/nz+uT85f7qAOkC2ASrBloI3AkoCzgMBg2PDdANyA14DeEMCAzxCqIJIwh8BrcE3QL5ABT/Of1z+8n5R/jy9tP17vRI9OTzxPPn80z08PTP9eP2JviP+Rj7tvxh/g4AtAFKA8cEIwZVB1kIKAm/CRkKOAoZCr8JLAlkCGwHSwYIBaoDOwLCAEj/2P15/DP7DvoR+UH4pPc99w73F/dZ99L3f/hb+WL6jPvS/C7+lv8BAWgCwQMEBSkGKQf9B6IIEQlJCUcJCwmXCOwHDgcDBs8EegMLAosAA/97/fz7kPo/+RL4Dvc79p71PPUW9S71hfUa9uj27vck+Yb6Cvyr/V3/GAHTAoQEIAagB/oIJwogC94LXgycDJcMTQzBC/QK6wmrCDoHoAXlAxMCMwBP/nH8pfry+GP3APbQ9NvzJPOx8oPynPL88qDzhPSl9fz2gvgv+vr72f3C/6sBigNVBQIHiQjhCQML6wuSDPYMFQ3vDIUM2QvwCs8JfAj/BmAFqAPhARUATf6S/O/6bPkR+OX27vUw9bD0cPRw9LD0LfXk9dH27vc0+Zv6HPyt/UX/2wBnAt8DOwV0BoMHYggNCYAJugm6CYAJDgloCJIHkAZqBScEzwJpAf//mP49/ff7zfrG+ef4N/i592/3W/d/99j3ZPgg+Qj6FftC/If93P45AJYB6wIvBFoFZQZLBwQIjQjhCP8I5giWCA8IVgduBlwFJgTTAmoB9f97/gX9nPtI+hH5/vcX92H24PWX9Yr1ufUj9sf2oveu+Oj5R/vG/Fv+//+nAUsD4QRhBsIH/QgJCuEKgAviCwQM5guHC+kKEAr+CLsHTAa5BAoDSQF//7X99ftI+rn4TvcQ9gX1NPSh807zP/Ny8+jznfSO9bb2DviQ+TP77/y6/ooAVgIUBLwFQwejCNMJzgqPCxEMUwxTDBIMkQvUCt8JtwhjB+sFVgSuAvsASP+d/QP8g/ol+fD36/Ya9oL1JvUG9SP1fPUO9tX2zffw+Db6mPsO/ZD+FACTAQMDXQSYBa8GnAdYCOEINAlQCTQJ4ghcCKUHwwa7BZMEUwMBAqcATf/6/bb8ivt7+pH50Pg9+Nz3rve09+73W/j4+MH5svrD+/D8Mf5+/88AHAJeA4wEnwWSBl0H+wdqCKUIrAh9CBoIhAe/Bs8FuQSDAzQC1ABr/wH+nvxK+w/68fj69y73k/Ys9vz1BvZJ9sT2dfdZ+Gr5pfoA/Hf9AP+SACYCswMvBZIG1QfwCN0JlgoXC10LZgsxC78KEwovCRgI1AZqBeADPwKRAN3+Lv2L+//5kfhK9zD2SfWa9Cj09PP/80r00vSW9ZD2vPcU+Y/6JvzR/Yb/PQHrAokEDQZvB6kIswmJCiULhguoC40LNAugCtQJ1giqB1gG5gReA8cBKwCR/gP9ivst+vP45PcD91f24vWm9aT12/VK9u32wvfB+Ob5KvuF/O/9YP/PADUCigPFBOEF1waiBz4IpwjcCNwIpwg/CKgH5Ab5Be0ExgOKAkMB9v+t/m79Qvwv+zz6bvnJ+FP4Dfj49xb4Zfjj+I75YfpY+2z8lv3R/hQAVwGTAsED2QTVBa4GYAflBzsIXwhQCA4Imgf3BikGMgUaBOcCngFIAO3+lP1F/Aj75Png+AP4UvfQ9oL2avaI9tz2Zvci+A35Ifpa+7D8HP6X/xgBlwILBGwFswbZB9UIpAlACqUK0QrDCnoK+AlACVQIOgf4BZQEFQOEAen/Tf65/DT7yPl8+Ff3X/aa9Qz1t/Sf9ML0IvW69Yn2ive4+Az6fvsI/aD+PwDbAWsD6QRKBokHngiECTYKsArxCvgKwwpWCrIJ2wjWB6kGWwXzA3kC9QBv//D9gPwn++z51vjp9yz3ovZN9i72R/aV9hf3yfen+Kz50foQ/GH9vf4cAHYBwwL7AxkFFgbsBpcHFAhfCHkIYAgVCJsH9QYnBjYFKAQEA88BkwBV/x7+9fzg++f6Dvpb+dL4dvhJ+Ez4f/jg+G75JPr/+vn7Df0z/mX/nQDRAfwCFQQXBfwFvAZVB8IHAQgPCOwHmQcXB2kGkwWaBIIDUwISAcj/e/40/fn70/rH+d34GfiB9xj34fbd9g73c/cI+M34vPnS+gf8Vf22/iEAjwH4AlQEmwXGBs4HrghgCeAJKwo/ChwKwgkyCXAIfwdlBiYFygNZAtkAU//P/Vb87/qi+Xb4cveb9vb1hvVO9U71h/X49Z72dvd7+Kj59vpd/Nj9Xf/jAGQC1wM0BXQGkAeCCEYJ1gkyClYKQwr5CXkJyAjpB+EGtgVuBBEDpwE2AMj+Zf0S/Nn6v/nK+AD4ZPf59sL2vvbu9lH34/eh+Ib5jfqv++f8Lf56/8UACAI8A1kEWgU4BvAGfQfdBw0IDQjeB4AH9gZEBm8FegRtA00CIgHy/8X+of2N/JD7sPrx+Vj56fim+JD4qPju+F/5+fm5+pn7lPyl/cb+7/8ZAT0CVgNbBEcFFAa9Bj4HlAe9B7cHgwcgB5MG3AUBBQYE8QLHAZAAU/8W/uH8u/ur+rj55vg7+Lr3aPdH91f3mPcK+Kr4dfln+nv7qvzw/UP/ngD5AUsDjgS7BcsGtwd7CBEJdwmrCakJdAkKCW8IpgeyBpkFYAQOA6sBPQDN/mL9BPy6+oz5gPic9+T2XPYI9un1APZM9sz2ffdb+GL5i/rR+yz9lv4GAHUB2wIwBG0FjAaHB1cI+whtCasJtgmMCS8JoQjlBwAH9wXQBJADQALnAIz/Nv7t/Ln7nvqk+dD4Jvip91v3P/dT95j3DPir+HL5W/pi+4D8r/3o/iQAWwGHAqEDowSIBUkG5AZVB5oHsQeaB1cH6QZSBpcFvATHA70CpAGDAGH/Rf40/Tf8UfuJ+uP5ZPkN+eH44PgM+WL54PmE+kr7Lvwp/TX+Tv9sAIgBnAKhA5IEaAUeBrAGGwdcB3AHWAcUB6UGDgZRBXIEeANmAkUBGADp/r39m/yL+5H6tfn6+Gf4/vfB97P31Pck+KH4SfkZ+gv7HPxF/X/+xf8OAVQCkAO7BM4FwgaUBz0IuggICSUJEQnLCFUIsAfiBu0F1wSmA2ACDAGy/1f+Bf3D+5b6hvmY+NL3N/fL9pH2ifa09hD3nPdV+Df5Pfph+5386/1D/50A8wE+A3YElAWTBm4HIAilCPoIHwkSCdQIZwjNBwoHIgYaBfgDwwKCATsA9f64/Yr8cvt2+pv55fhZ+Pn3xvfC9+z3Q/jF+G75O/om+yv8Q/1n/pL/vADeAfMC9APcBKUFSwbKBiEHTQdNByIHzgZRBrEF7wQRBB0DGAIHAfL/3/7V/dj88Psi+3L65Pl8+Tz5Jfk4+XT52Pli+g772fu9/LX9vP7L/90A6gHtAt8DuwR7BRsGmAbuBhoHHQf0BqMGKQaJBcgE6APwAuQBzACs/4v+cP1i/Gb7g/q9+Rr5nfhJ+CD4JPhU+LH4N/nl+bf6qfu0/NT9A/85AHEBogLIA9oE0wWuBmYH9gdbCJMInAh2CCIIogf3BiUGMgUhBPkCwAF8ADX/8v25/JH7gPqN+bz4EviT90H3Hvcq92f30fdn+Cb5CfoM+yn8Wv2Y/t3/IgFfAo8DqgSrBYwGSAfcB0UIgQiOCGwIHQijB/8GNwZOBUoEMAMHAtUAof9x/k39Ovw++1/6ofkI+Zj4Uvg4+Er4h/jt+Hv5LPr8+uf75/z3/Q//KgBCAU8CTQM1BAMFsQU9BqMG4Qb3BuMGpgZDBrsFEgVNBG4DfQJ+AXgAcP9t/nX9jPy6+wL7afry+aD5dflx+ZX54flR+uT6lfti/EX9Of45/z4AQgE/AjADDwTXBIIFDQZ1BrcG0QbDBowGLwasBQYFQgRkA28CawFcAEn/Of4w/TX8TvuB+tH5Q/nb+Jv4hfiY+Nb4PfnL+X76UPs+/EP9Wv57/6IAxgHjAvID7ATNBY8GLgemB/UHGQgQCNwHfAfzBkMGcQWABHYDWQIuAfz/yf6c/Xz8bvt5+qH57Phd+Pf3vPeu9833GPiO+Cv57vnQ+s/74/wH/jX/ZwCVAboCzwPOBLIFdgYWB48H3gcCCPoHxgdpB+MGOQZuBYYEhwN3AlsBOQAZ/wD+9Pz7+xv7WPq1+Tj54vi0+LD41Pgi+ZX5K/ri+rT7nPyW/Zz+p/+yALYBrwKVA2UEGgWwBSMGcQaZBpoGdAYoBrgFJwV5BLED1ALoAfEA9v/8/gr+JP1Q/JP78Ppt+gz6zvm2+cT5+PlQ+sr6Y/sZ/Ob8x/21/qv/pQCbAYgCZwMzBOYEfQX0BUkGeAaCBmQGIQa6BTAFhgTBA+UC9gH7APf/8v7x/fv8FPxB+4n67/l2+SH58/jt+A/5WfnJ+Vz6Efvi+8z8yf3U/uj//gAPAhcDEATzBLwFZgbuBlAHiwecB4QHQgfYBkkGlgXFBNkD1wLFAakAif9r/lX9TfxZ+376wfkm+a/4Yfg7+ED4b/jH+EX56Pms+oz7hPyO/aX+wv/gAPcBBAP+A+IEqwVUBtkGOAdwB38HZAchB7gGKgZ7Ba8EywPTAs0BwACv/6P+oP2t/M37B/tf+tf5cvk0+Rz5K/lh+bz5OfrW+pD7YfxF/Tj+Mv8vACkBGgL9As0DhgQjBaAF/AU1BkgGNwYBBqgFLwWXBOUDHQNEAl4BcQCC/5f+tf3i/CL8efvs+n76MPoG+v/5Hfpe+sD6Qvvh+5j8ZP1A/if/EwAAAegBxAKSA0oE6gRuBdIFFAYyBi0GAga0BUUFtgQKBEYDbQKFAZMAnP+m/rb90fz9+z/7m/oV+q/5bflQ+Vn5iPnb+VL66fqe+238UP1F/kT/SQBOAUwCQAMiBO8EoQU1BqcG9QYdBx0H9waqBjkGpQXxBCMEPQNEAj8BMwAl/xz+HP0s/FH7j/rr+Wj5CfnP+L340vgP+XH59/md+mD7PPws/Sv+M/8+AEgBSQI9Ax8E6QSXBSYGkwbbBv0G+QbOBn4GCwZ3BcYE/AMcAy0CNAE1ADf/P/5S/Xb8r/sC+3P6A/q2+Y35ifmp+e35U/rZ+nv7NfwE/eL9y/65/6cAjwFtAjsD9gOXBB4FhQXMBfAF8gXQBY0FKQWoBAwEWAOSAr0B3wD9/xv/P/5v/a78Afxt+/T6mfpe+kX6T/p6+sb6Mfu5+1r8Ev3b/bH+j/9xAFABKQL1ArADVgTkBFQFpwXYBecF0wWeBUcF0QQ+BJID0AL9AR0BNQBL/2T+hf2y/PH7R/u2+kP68Pm/+bH5x/kA+lv61/px+yX87/zM/bb+qf+fAJIBfgJdAyoE4AR9BfsFWQaVBqwGngZsBhYGngUIBVUEigOsAr4BxgDK/8/+2v3x/Bj8Vfur+h76sfln+UH5QPlk+az5Fvqh+kj7Cfzf/Mb9uf6x/6sAoAGMAmgDMQTjBHkF8AVGBnkGiAZzBjoG3wVlBc0EGwRUA3sClgGpALr/zv7r/RT9T/yg+wv7kvo5+gL67Pn5+Sj6ePrn+nP7F/zQ/Jv9cv5Q/zEADwHmAbECagMPBJwEDAVfBZIFpQWWBWYFGAWrBCQEhQPSAhACQQFsAJX/wf71/Tb9h/zu+2z7Bvu++pX6jPqj+tr6L/uh+y380PyF/Ur+Gf/u/8QAlQFeAhoDwwNYBNMEMgV0BZUFlgV3BTcF2QRfBMoDHwNhApQBvQDh/wT/LP5e/Z387/tY+9r6ePo2+hX6FPo2+nj62vpZ+/P7pfxq/T/+Hv8DAOkAywGkAm8DJwTJBFEFvAUHBjEGOQYfBuIFhQUKBXIEwQP8AiYCRAFaAG//hv6m/dL8D/xj+8/6WfoB+sr5tfnD+fP5Rfq1+kP76vun/Hb9U/44/yEACAHpAb8ChQM3BNEEUAWxBfIFEgYQBuwFqAVFBcUELAR7A7kC6AEOAS8AUP92/qb95fw2/J77H/u8+nj6VPpQ+mz6p/oB+3f7Bvyq/GH9Jv70/sf/mgBpAS4C5QKLAxwElATwBDAFUQVTBTYF+wSjBDAEpQMGA1UClwHQAAUAOv91/rn9Cv1u/Ob7d/sj++z60vrX+vr6O/uY+w/8nfxA/fL9sf54/0MADAHPAYkCNAPMA08EuQQIBToFTQVCBRgF0QRtBO8DWgOxAvgBMwFmAJb/x/7//UH9kvz2+3D7BPu0+oH6bfp5+qX67vpV+9b7b/wd/dz9qP57/1MAKQH6AcACdwMcBKoEHgV3BbEFzAXGBaEFXAX6BHsE5AM3A3gCrAHWAPv/IP9K/n39vvwS/Hr7/Pqa+lX6MPor+kX6gPrY+k373PuB/Dn9AP7R/qn/ggBXASQC5QKVAzEEtQQeBWsFmQWoBZgFaAUaBbEELgSUA+cCKgJiAZQAw//1/i3+cf3E/Cv8p/s+++/6vvqr+rb63/ol+4b7AfyR/DX95/2l/mn/MAD1ALMBZwIMA54DHASABMoE+QQKBf4E1ASPBDAEuQMsA40C4AEoAWoAqv/s/jX+if3r/GD86vuM+0n7IfsV+yf7Vfue+wH8e/wK/ar9WP4R/87/jgBKAf8BqQJDA8wDPgSYBNcE+wQCBesEuQRqBAMEgwPvAkoClwHaABgAVP+U/tv9Lv2Q/AX8kPs1+/T60PrI+t/6Evti+8z7Tvzl/I79Rv4H/8//mABfAR4C0gJ2AwgEgwTmBC0FWAVlBVQFJQXaBHME9ANfA7cCAAI9AXQAqP/e/hr+Yf22/B38mvsw++D6rfqX+p/6xfoI+2b73vts/A39v/19/kL/DADUAJgBUgL+ApkDIASQBOUEIAU9BT0FIAXmBJEEIwSfAwYDXQKoAeoAKABm/6j+8/1K/bH8K/y8+2X7KfsJ+wX7HftR+6D7B/yE/BT9tf1i/hf/0f+LAEIB8AGSAiUDpQMQBGMEnAS7BL0EpQRxBCQEwANFA7gCHAJ0AcMADwBa/6r+Af5l/dj8Xfz4+6r7dvtc+137evuw+wD8Z/zj/HH9Dv63/mf/GwDPAH4BJAK/AkoDwgMkBG8EoAS3BLIEkwRZBAUEmwMbA4oC6QE9AYkA0v8b/2n+wP0j/Zb8G/y3+2v7OPsh+yX7RPt/+9P7P/zA/FT99/2m/l3/GQDUAIoBOQLbAm4D7QNXBKkE4QT9BP4E4wStBFwE9AN1A+MCQAKRAdoAHQBg/6f+9f1O/bf8MvzC+2n7K/sH+//6E/tC+4v77ftm/PL8j/05/u3+pv9hABoBywFyAgwDkwMHBGMEpwTQBN8E0gSqBGgEDgSdAxkDgwLgATMBgADL/xf/av7G/S/9qfw3/Nr7lftq+1n7YvuF+8L7F/yC/AD9j/0r/tH+fv8sANkAgQEfArECMgOhA/sDPQRnBHcEbQRKBA4EuwNTA9cCTAKzAREBaQC+/xb/c/7Z/Uz9z/xl/A/80Puq+537qfvP+wz8YfzL/Ef90/1s/g7/tf9fAAYBqAFAAswCRwOwAwMEQARkBG8EYQQ5BPkDogM2A7gCKgKPAeoAQQCV/+v+SP6t/SD9o/w4/OP7pfuA+3T7gfup++n7QPys/Cz9u/1Y/v7+qv9ZAAUBrQFLAtwCXQPMAyYEaASSBKIEmAR1BDgE5AN7A/0CbwLUAS4BgQDS/yT/e/7a/Ub9wPxN/O/7p/t4+2L7ZvuE+7r7CPxt/OX8bv0F/qf+Uf/9/6oAUgHzAYgCDgOEA+UDMARjBH4EgARoBDcE7wORAx8DnAILAm8BywAjAHv/1v45/qb9If2t/Ez8APzM+6/7q/vA++z7MPyK/Pb8dP0A/pf+Nf/Y/3sAGgGzAUICwwI0A5MD3AMQBCsELwQbBO8DrANVA+oCbwLmAVMBtwAYAHn/3f5I/r39P/3R/HX8Lvz9++T74vv4+yX8aPzA/Cv9pv0v/sL+Xf/7/5kANAHJAVMCzwI8A5YD3AMMBCQEJQQOBOADmwNCA9YCWgLQATsBnwAAAGD/xP4u/qP9Jf22/Fv8FPzj+8n7x/ve+wv8T/yo/BT9kf0b/rH+Tf/u/5AALgHGAVUC1gJHA6YD8AMlBEIERwQ0BAoEyQNyAwkDjgIFAnEB1QA0AJL/8/5Z/sn9Rv3R/G/8Ifzp+8f7vfvL+/H7Lfx//OT8W/3g/XD+Cf+o/0gA5gB+AQ4CkwIIA2wDvAP4Ax0EKgQhBAAEyAN7AxsDqgIqAp4BCQFvANP/OP+i/hX+kv0e/br8avwu/Af8+Pv/+x38Uvyb/Pf8ZP3g/Wf++P6O/yYAvQBPAdkBWQLKAiwDewO2A9wD6wPkA8cDlANMA/IChwINAogB+wBoANP/P/+v/if+qv07/dv8jvxV/DD8Ivwq/Ej8e/zD/B39h/0A/oX+Ev+k/zgAywBaAeEBXQLLAioDdwOwA9MD4QPZA7sDhwM/A+UCegIBAnwB7wBcAMf/NP+k/h3+n/0w/dD8gvxI/CP8FPwb/Dn8a/yy/Az9dv3v/XT+Af+U/yoAvgBPAdgBVwLJAisDewO4A98D8QPtA9IDogNeAwcDnwIoAqUBGAGGAPH/XP/L/kH+wf1N/en8lvxX/Cz8F/wY/C78Wvyb/O/8U/3H/Uf+0P5g//P/hgAWAaABIAKUAvkCTQOOA7wD1APWA8MDmgNeAw4DrQI+AsIBPAGwACAAj/8C/3r+/P2J/SX90PyP/GD8R/xD/FT8evy0/AD9Xv3K/UP+xf5O/9v/aADyAHcB9AFlAsgCGwNcA4kDowOnA5cDcgM6A+8CkwIpArMBMwGsACIAl/8O/4v+Ef6i/UD97vyu/IH8aPxk/HT8mfzR/Bv9dv3f/VX+1P5Z/+P/bQD0AHYB8AFfAsACEQNRA34DlwOcA4wDZwMwA+YCjAIjAq4BLwGpACAAlv8O/4z+Ev6j/UH97/yu/ID8Zvxg/G/8kvzI/BH9av3S/Ub+xf5K/9P/XQDlAGgB4wFTArYCCgNNA30DmQOhA5UDdANAA/kCogI8AsoBTQHJAEEAuP8w/63+Mf7A/Vz9Bv3C/JD8cfxm/HD8jvy//AL9V/26/Sr+pP4l/6v/MwC6ADwBtwEoAo0C4wIoA1wDfQOKA4IDZwM5A/kCqAJIAtsBZAHlAGIA3P9Y/9j+Xv7u/Yr9NP3u/Lr8mPyK/I/8qPzU/BL9Yf2+/Sj+nP4Y/5n/HACfAB0BlQEDAmYCvAIBAzUDVwNmA2EDSQMeA+IClQI6AtIBXwHlAGYA5f9l/+j+cf4E/qL9Tv0J/dX8s/yk/Kj8wPzp/CX9cf3L/TL+o/4c/5r/GgCZABUBiwH4AVoCrgLzAicDSQNZA1UDPgMVA9sCkAI2AtABYAHoAGsA6/9s//H+e/4O/qz9V/0S/d38ufyp/Kv8wfzo/CH9a/3D/Sj+l/4O/4r/CQCIAAQBeQHnAUkCnwLmAhwDQQNTA1MDPwMZA+ICmwJFAuIBdAH/AIQABgCI/w3/l/4p/sb9cP0o/fH8yvy2/LX8xvzp/B79Y/23/Rf+g/72/m//7P9oAOIAVwHEAScCfgLGAv8CJwM8Az8DMAMPA90CmgJJAusBggERAZoAHwCl/yz/uP5M/ur9k/1L/RL96fzT/M783Pz7/Cz9bP27/Rf+fv7t/mL/2v9TAMoAPQGoAQkCXwKnAuECCQMgAyYDGQP7AswCjQJAAuYBgQETAaAAKQCy/zz/y/5h/gD+qv1i/Sn9AP3p/OP87vwL/Tn9d/3D/Rz+f/7r/l3/0/9JAL4ALgGYAfkBTgKWAs8C+QIRAxgDDQPxAsUCiAI9AuYBhAEZAagAMwC+/0r/2v5w/hD+uv1y/Tj9Dv31/O389vwR/Tz9d/3A/Rb+d/7g/lD/w/84AKwAGwGFAeUBOwKEAr8C6gIEAw4DBgPtAsMCigJDAu4BjwEoAbkARwDT/2H/8v6J/ij+0v2J/U39If0G/fv8Af0Y/UD9d/29/Q/+bP7S/j7/r/8iAJMAAQFpAcoBHwJpAqUC0gLvAvsC9gLhArsChgJCAvIBlwEyAcgAWQDo/3j/C/+j/kT+7v2k/Wj9O/0d/RD9E/0n/Uz9f/3B/Q/+af7L/jT/ov8RAIAA7ABSAbEBBgJQAowCugLYAuYC5ALRAq4CfAI8Au8BlwE3Ac8AYwD1/4j/Hf+3/ln+BP66/X79UP0x/SL9I/01/Vf9iP3G/RL+aP7H/i3/mP8EAHEA2wBAAZ4B8wE8AnkCqALHAtcC1gLGAqUCdgI5Au8BmgE9AdgAbgADAJf/Lv/J/mz+F/7N/ZD9Yf1B/TD9MP0//V79jP3I/RD+Y/6//iP/i//1/2AAyQAtAYoB3gEoAmUClQK2AsgCygK8Ap4CcgI4AvEBoAFFAeMAfAATAKn/Qv/e/oL+Lf7j/ab9df1U/UH9Pv1L/Wf9kf3K/Q/+X/64/hj/ff/l/04AtAAXAXMBxwERAk8CgAKiArYCugKvApQCawI0AvEBowFLAewAiQAiALv/Vf/z/pf+RP76/bz9i/1o/VP9Tv1Y/XH9mf3O/RD+Xf6z/hD/cv/Y/z4AogADAV8BsgH7AToCawKPAqQCqgKhAokCYwIvAu8BpAFPAfQAkwAvAMr/Zv8G/6v+WP4P/tD9n/16/WT9Xf1l/Xz9of3T/RL+XP6u/gn/aP/L/y8AkgDxAEsBngHnASYCWAJ8ApMCmwKUAn8CWwIqAu0BpQFUAfsAnQA7ANj/d/8Y/77+bP4j/uX9sv2N/XX9bP1y/Yb9qP3Y/RT+Wv6q/gH/Xv++/yAAgQDfADgBigHTARECRAJqAoICjAKHAnQCVAImAusBpgFYAQIBpwBIAOf/h/8q/9L+gP43/vn9xv2f/Yb9fP1//ZH9sP3d/Rb+Wf6m/vv+Vf+y/xIAcQDNACUBdgG/Af0BMQJXAnECfQJ6AmoCSwIgAukBpwFbAQgBsABTAPX/l/88/+T+lP5L/g3+2f2y/Zj9i/2N/Zz9uf3j/Rn+Wf6j/vX+TP+n/wQAYQC8ABIBYwGrAeoBHQJFAmACbQJtAl4CQwIaAuYBpwFeAQ4BuABeAAIApv9M//f+p/5f/iD+7P3E/an9m/2a/af9wv3p/Rz+Wv6h/u/+RP+d//f/UgCrAAABUAGYAdYBCgIzAk8CXgJfAlMCOgIUAuIBpgFgARMBwABoAA8Atf9d/wj/uf5y/jP+//3W/br9qv2o/bP9y/3v/SD+Wv6f/ur+PP+T/+v/RACbAO8APQGFAcMB+AEhAj4CTgJRAkcCMQINAt4BpQFiARgBxwByABsAw/9t/xn/zP6F/kb+Ev7o/cv9uv22/b791P32/ST+XP6d/ub+Nv+J/9//NgCMAN4AKwFyAbAB5QEPAi0CPwJEAjwCJwIGAtoBowFjARwBzgB7ACYA0P98/yr/3f6X/ln+JP76/dz9yf3D/cr93v39/Sj+Xv6c/uP+L/+A/9T/KQB9AM4AGgFgAZ4B0wH9ARwCLwI2AjACHQL/AdUBoQFkAR8B1ACEADEA3f+K/zr/7/6p/mv+Nv4M/uz92f3R/db96P0F/i3+YP6c/t/+Kf94/8r/HQBuAL4ACQFOAYwBwQHsAQsCIAIoAiQCEwL3AdABnwFkASIB2QCMADsA6v+Y/0r///66/n3+SP4d/v396P3f/eL98v0N/jL+Y/6c/t3+JP9x/8D/EABhAK8A+QA9AXoBrwHaAfsBEAIaAhcCCQLvAcsBnAFkASQB3gCTAEUA9f+m/1n/D//M/o7+Wv4u/g3++P3t/e/9/P0V/jj+Zv6c/tv+IP9p/7b/BQBTAKAA6QAsAWkBngHJAeoBAQIMAgsC/wHnAcUBmQFjASYB4gCaAE4AAQCz/2f/H//c/qD+a/4//h7+B/77/fv9Bv4d/j7+af6d/tn+HP9j/67/+v9HAJEA2QAcAVgBjQG4AdoB8QH+Af8B9AHfAb8BlQFiAScB5gCgAFcACwDA/3X/L//s/rD+fP5Q/i7+Fv4J/gf+Ef4l/kT+bf6f/tj+GP9d/6X/8P86AIQAygAMAUcBfAGoAcoB4gHwAfIB6gHWAbgBkQFhASgB6gCmAF8AFQDL/4P/Pf/8/sH+jf5h/j7+Jf4X/hT+HP4u/kv+cf6g/tf+Ff9X/57/5v8vAHYAuwD8ADcBawGXAboB0wHiAeYB3wHNAbIBjQFfASkB7QCrAGYAHwDX/5D/TP8L/9H+nf5x/k7+NP4l/iH+J/43/lL+dv6j/tf+Ev9S/5b/3f8kAGoArQDtACcBWwGHAaoBxAHUAdkB1AHEAasBiAFcASkB7wCwAG0AKADi/53/Wv8a/+D+rf6B/l3+Q/4z/i3+Mv5A/ln+e/6l/tf+EP9O/5D/1P8ZAF0AoADeABgBSwF3AZsBtQHGAc0ByQG7AaQBgwFZASgB8QC0AHMAMADs/6n/Z/8p//D+vP6R/m3+Uv5B/jr+Pf5J/mD+gP6o/tj+Dv9K/4r/zP8PAFIAkwDQAAkBPAFoAYwBpwG4AcABvgGyAZwBfQFWASgB8gC4AHkAOAD2/7T/dP83//7+zP6g/nz+Yf5P/kb+SP5T/mj+hf6r/tn+Df9G/4T/xP8FAEYAhgDCAPoALQFZAXwBmAGqAbMBswGoAZUBeAFTASYB8wC7AH8AQAD//7//gP9E/w3/2/6v/ov+b/5c/lP+U/5d/m/+i/6v/tr+DP9D/3//vf/8/zwAegC1AOwAHgFKAW4BigGdAacBpwGfAY0BcgFPASUB9AC+AIQARwAIAMr/jP9S/xv/6f6+/pr+fv5q/l/+Xv5m/nf+kf6z/tz+DP9B/3r/tv/0/zEAbgCoAN4AEAE7AV8BewGPAZoBnAGVAYUBbAFLASMB9ADAAIgATQARANT/mP9e/yj/9/7M/qj+jP53/mz+af5w/n/+l/63/t7+DP8//3b/sP/r/ygAYwCcANEAAgEtAVEBbQGCAY4BkQGLAXwBZQFHASEB9ADCAIwAUwAYAN3/o/9q/zb/Bf/a/rb+mv6F/nj+df56/oj+nv68/uH+DP89/3L/qv/k/x4AWACQAMQA9AAfAUMBYAF1AYEBhgGBAXQBXwFCAR4B9ADEAJAAWQAgAOb/rf92/0L/E//o/sT+p/6S/oX+gP6E/pD+pP7A/uT+Df88/27/pf/d/xUATgCEALgA5wARATUBUgFnAXUBegF3AWwBWAE9ARsB8wDFAJMAXgAnAO//t/+C/0//IP/2/tL+tf6f/pH+i/6O/pn+q/7F/uf+Dv87/2z/oP/W/w0ARAB5AKsA2gAEAScBRQFbAWkBbwFtAWMBUQE4ARgB8QDGAJYAYwAtAPf/wf+M/1v/LP8D/9/+wv6s/p3+l/6Y/qH+sv7L/ur+D/86/2n/m//Q/wUAOgBuAKAAzQD3ABoBNwFOAV0BZAFjAVoBSgEzARQB8ADGAJgAZwAzAP//yv+X/2b/Of8Q/+z+z/65/qn+ov6i/qr+uf7Q/u7+Ef86/2f/l//K//7/MQBkAJQAwQDqAA0BKgFBAVEBWQFZAVIBQwEtARAB7gDGAJoAawA5AAYA0/+h/3H/Rf8c//n+3P7F/rX+rf6s/rP+wf7W/vL+E/86/2X/lP/F//f/KQBaAIkAtgDdAAEBHgE1AUUBTQFPAUkBPAEnAQwB7ADGAJwAbgA+AA0A2/+q/3z/UP8p/wb/6P7R/sH+uP62/rz+yP7c/vb+Fv87/2T/kf/A//D/IQBRAH8AqgDSAPQAEQEoATkBQgFFAUABNAEhAQgB6QDFAJ0AcQBDABMA4/+0/4b/W/80/xL/9f7e/s3+w/7A/sX+0P7i/vr+GP87/2P/jv+7/+r/GQBIAHUAnwDGAOgABQEcAS0BNwE7ATcBLAEbAQQB5gDEAJ0AcwBHABkA6v+8/5D/Zv9A/x7/Af/q/tj+zv7K/s3+1/7o/v/+G/89/2L/i/+3/+T/EgA/AGsAlQC7ANwA+QARASIBLQExAS4BJQEVAf8A4wDDAJ4AdgBLAB4A8f/F/5r/cf9L/yn/Df/1/uT+2f7U/tb+3/7u/gP/Hv8+/2L/if+z/9//CwA3AGIAigCwANEA7gAFARcBIgEnASUBHQEOAfoA4ADBAJ4AeABOACQA+P/N/6P/e/9W/zX/GP8B/+/+4/7e/t/+5/71/gj/Iv9A/2L/iP+w/9r/BQAwAFkAgQClAMYA4gD6AAsBFwEdARwBFQEIAfUA3QC/AJ4AeQBSACgA/v/U/6v/hP9g/z//I/8M//r+7v7o/uj+7/77/g7/Jf9C/2L/hv+t/9b///8oAFEAdwCbALsA1wDvAAEBDQETARMBDQEBAfAA2QC9AJ0AegBUAC0ABADb/7T/jv9q/0r/Lv8X/wX/+P7y/vH+9/4C/xP/Kf9E/2P/hf+q/9H/+f8hAEgAbgCRALEAzADkAPYAAgEJAQoBBQH7AOoA1QC7AJ0AewBXADEACQDi/7v/lv90/1T/Of8i/xD/A//8/vr+//4J/xj/Lf9G/2T/hf+o/87/9P8bAEEAZQCHAKcAwgDZAOsA+AAAAQEB/QD0AOUA0QC4AJwAfABZADQADgDo/8P/n/99/17/Q/8s/xr/Df8F/wP/B/8Q/x7/Mf9J/2X/hP+m/8r/7/8VADkAXQB+AJ0AuADPAOEA7gD2APkA9QDtAN8AzQC1AJoAfABbADcAEwDu/8r/p/+G/2j/Tf82/yT/F/8P/wz/Dv8W/yT/Nv9M/2b/hP+l/8f/6/8PADIAVQB1AJMArgDFANcA5ADtAPAA7gDmANoAyACyAJkAfABcADoAFwD0/9H/r/+P/3H/V/9A/y7/If8Y/xX/Fv8d/yn/Ov9P/2j/hP+j/8T/5/8JACwATQBtAIoApAC7AM0A2wDjAOcA5gDfANQAxACvAJcAewBdAD0AGwD5/9f/tv+X/3r/YP9K/zj/Kv8h/x3/Hv8k/y//P/9T/2r/hf+i/8L/4/8EACYARgBlAIEAmwCxAMMA0QDaAN4A3gDYAM4AvwCsAJUAewBeAD8AHwD+/93/vf+f/4P/av9U/0H/NP8q/yb/Jv8r/zX/Q/9W/2z/hv+i/8D/3/8AACAAPwBdAHkAkgCoALoAyADRANYA1gDRAMgAugCoAJMAegBeAEEAIgADAOP/xP+n/4v/cv9d/0v/Pf8z/y7/Lv8y/zv/SP9a/2//h/+h/77/3P/7/xoAOQBWAHEAiQCfALEAvwDIAM0AzgDKAMIAtQClAJAAeQBfAEMAJQAHAOj/yv+u/5P/e/9m/1T/Rv88/zf/Nv85/0H/Tf9d/3H/iP+h/73/2v/3/xUAMgBPAGkAgQCWAKgAtgDAAMUAxgDDALwAsAChAI4AdwBfAEQAKAALAO3/0f+1/5v/g/9u/13/T/9F/z//Pf9A/0f/Uv9h/3T/if+h/7z/1//0/xAALQBIAGEAeQCNAJ8ArQC3AL0AvwC8ALYAqwCdAIsAdgBeAEUAKgAOAPL/1v+7/6L/i/93/2X/V/9N/0f/Rf9H/03/V/9l/3f/i/+i/7v/1f/w/wwAJwBBAFoAcQCFAJYApACvALUAtwC1ALAApgCZAIgAdABeAEYALAARAPb/3P/C/6n/k/9//27/YP9W/0//Tf9O/1P/Xf9p/3r/jf+i/7r/0//t/wgAIgA7AFMAagB9AI4A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9f/t/+b/3//Y/9P/z//L/8n/yP/J/8r/zf/R/9b/3P/i/+r/8f/5/wIACgASABkAIAAmACsALwAzADUANgA1ADQAMQAuACkAIwAdABYADwAHAP//9//w/+j/4v/c/9f/0//P/83/zP/N/87/0P/U/9j/3v/k/+r/8f/5/wAACAAPABYAHQAiACcALAAvADEAMgAyADAALgArACcAIgAcABUADwAHAAAA+f/y/+v/5f/f/9r/1v/T/9H/0P/Q/9H/0//W/9r/3//l/+v/8v/4////BgANABQAGgAfACQAKAArAC0ALgAuAC0AKwAoACQAIAAbABUADgAIAAEA+v/0/+3/6P/i/97/2v/X/9X/1P/U/9T/1v/Z/93/4f/m/+z/8v/4////BQALABEAFwAcACEAJQAnACkAKwArACoAKAAmACIAHgAZABQADgAIAAIA/P/1//D/6v/l/+H/3f/a/9j/1//X/9j/2f/c/9//4//n/+z/8v/4//7/BAAKAA8AFQAZAB4AIQAkACYAJwAnACcAJQAjACAAHAAYABMADgAIAAMA/f/3//L/7f/o/+T/4P/e/9z/2v/a/9v/3P/e/+H/5f/p/+3/8v/4//3/AwAIAA0AEgAXABsAHgAhACMAJAAkACQAIwAhAB4AGwAXABIADQAIAAMA/v/5//P/7//q/+f/4//h/9//3v/d/97/3//h/+P/5v/q/+7/8//4//3/AgAHAAwAEAAUABgAGwAeACAAIQAhACEAIAAeABwAGQAVABEADQAIAAMA///6//X/8f/t/+n/5v/k/+L/4f/g/+D/4f/j/+X/6P/r/+//8//4//z/AQAGAAoADgASABYAGQAbAB0AHgAeAB4AHQAcABoAFwAUABAADAAIAAQA///7//f/8//v/+z/6f/m/+X/5P/j/+P/5P/l/+f/6v/t//D/9P/4//z/AAAFAAkADAAQABMAFgAYABoAGwAcABwAGwAaABgAFQATAA8ADAAIAAQAAAD8//j/9P/x/+7/6//p/+f/5v/m/+b/5v/o/+n/7P/u//H/9f/4//z/AAAEAAcACwAOABEAFAAWABcAGAAZABkAGAAXABYAFAARAA4ACwAIAAQAAAD9//n/9v/z//D/7v/r/+r/6f/o/+j/6f/q/+v/7f/w//L/9f/4//z///8DAAYACQAMAA8AEQATABUAFgAXABcAFgAVABQAEgAQAA0ACgAHAAQAAQD+//r/9//1//L/8P/u/+z/6//r/+v/6//s/+3/7//x//P/9v/5//z///8CAAUACAALAA0ADwARABMAFAAUABQAFAATABIAEAAOAAwACgAHAAQAAQD+//v/+f/2//T/8v/w/+//7v/t/+3/7f/u/+//8P/y//T/9//5//z///8BAAQABwAJAAsADQAPABAAEQASABIAEgARABAADwANAAsACQAHAAQAAQD///z/+v/3//X/8//y//H/8P/v/+//7//w//H/8v/z//X/9//6//z//v8BAAMABgAIAAoADAANAA4ADwAQABAAEAAPAA4ADQAMAAoACAAGAAQAAgD///3/+//5//f/9f/0//P/8v/x//H/8f/y//L/8//1//b/+P/6//z//v8BAAMABQAHAAgACgALAA0ADQAOAA4ADgAOAA0ADAALAAkABwAGAAQAAgAAAP7//P/6//j/9//1//T/9P/z//P/8//z//T/9f/2//f/+f/7//z//v8AAAIABAAGAAcACQAKAAsADAAMAAwADAAMAAsACwAJAAgABwAFAAMAAgAAAP7//P/7//n/+P/3//b/9f/1//X/9f/1//X/9v/3//j/+v/7//3//v8AAAIAAwAFAAYABwAIAAkACgAKAAsACwAKAAoACQAIAAcABgAFAAMAAgAAAP///f/8//r/+f/4//f/9//2//b/9v/2//f/9//4//n/+v/8//3//v8AAAEAAwAEAAUABgAHAAgACAAJAAkACQAJAAkACAAHAAYABQAEAAMAAgAAAP///v/9//v/+v/6//n/+P/4//j/+P/4//j/+f/5//r/+//8//3//v8AAAEAAgADAAQABQAGAAcABwAIAAgACAAIAAcABwAGAAUABQAEAAMAAgAAAP///v/9//z/+//7//r/+f/5//n/+f/5//n/+v/6//v//P/9//7///8AAAEAAgACAAMABAAFAAUABgAGAAYABgAGAAYABgAFAAUABAADAAIAAQAAAAAA///+//3//P/8//v/+//6//r/+v/6//r/+//7//z//P/9//7//////wAAAQACAAMAAwAEAAQABQAFAAUABQAFAAUABQAEAAQAAwADAAIAAQABAAAA///+//7//f/8//z//P/7//v/+//7//v//P/8//z//f/+//7//////wAAAQABAAIAAwADAAQABAAEAAQABAAEAAQABAAEAAMAAwACAAIAAQAAAAAA//////7//v/9//3//f/8//z//P/8//z//f/9//3//v/+//7///8AAAAAAQABAAIAAgACAAMAAwADAAMAAwADAAMAAwADAAMAAgACAAEAAQAAAAAAAAD//////v/+//7//f/9//3//f/9//3//f/9//7//v/+//////8AAAAAAAABAAEAAgACAAIAAgACAAMAAwADAAMAAgACAAIAAgABAAEAAQAAAAAAAAD////////+//7//v/+//7//v/+//7//v/+//7//v////////8AAAAAAAABAAEAAQABAAIAAgACAAIAAgACAAIAAgACAAEAAQABAAEAAQAAAAAAAAAAAP/////////////+//7//v/+//7//v////////////////8AAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAAAAAAAAAAAAAAAA////////////////////////////////////////AAAAAAAAAAAAAAAAAAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAAAAAAAP//////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", Il = "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df94/3z/gP+E/4j/i/+P/5P/l/+b/5//o/+n/6v/r/+y/7b/uv++/8L/xv/K/87/0v/W/9r/3v/i/+b/6v/u//L/9v/6//7/AgAGAAoADgASABYAGgAeACIAJgAqAC4AMgA1ADkAPQBBAEUASQBMAFAAVABYAFsAXwBjAGYAagBuAHEAdQB4AHwAfwCDAIYAigCNAJAAlACXAJoAngChAKQApwCqAK4AsQC0ALcAugC9AMAAwgDFAMgAywDOANAA0wDWANgA2wDdAOAA4gDlAOcA6gDsAO4A8ADzAPUA9wD5APsA/QD/AAEBAwEEAQYBCAEKAQsBDQEOARABEQETARQBFgEXARgBGQEbARwBHQEeAR8BIAEhASEBIgEjASQBJAElASYBJgEnAScBKAEoASgBKAEpASkBKQEpASkBKQEpASkBKQEpASkBKAEoASgBJwEnASYBJgElASUBJAEjASMBIgEhASABHwEeAR0BHAEbARoBGQEYARcBFQEUARMBEQEQAQ8BDQEMAQoBCAEHAQUBAwECAQAB/gD8APsA+QD3APUA8wDxAO8A7QDrAOgA5gDkAOIA4ADdANsA2QDWANQA0gDPAM0AygDIAMUAwwDAAL4AuwC4ALYAswCwAK4AqwCoAKYAowCgAJ0AmgCYAJUAkgCPAIwAiQCGAIQAgQB+AHsAeAB1AHIAbwBsAGkAZgBjAGAAXQBaAFcAVABRAE4ASwBIAEUAQgA/ADwAOQA2ADMAMAAtACoAJwAkACEAHgAbABgAFQATABAADQAKAAcABAABAP7//P/5//b/8//w/+7/6//o/+X/4//g/93/2//Y/9X/0//Q/87/y//I/8b/w//B/7//vP+6/7f/tf+z/7D/rv+s/6r/p/+l/6P/of+f/53/m/+Z/5f/lf+T/5H/j/+N/4v/iv+I/4b/hP+D/4H/f/9+/3z/e/95/3j/dv91/3T/cv9x/3D/bv9t/2z/a/9q/2n/aP9n/2b/Zf9k/2P/Yv9h/2D/YP9f/17/Xv9d/1z/XP9b/1v/Wv9a/1r/Wf9Z/1n/Wf9Y/1j/WP9Y/1j/WP9Y/1j/WP9Y/1j/WP9Y/1n/Wf9Z/1r/Wv9a/1v/W/9c/1z/Xf9d/17/Xv9f/2D/Yf9h/2L/Y/9k/2X/Zf9m/2f/aP9p/2r/a/9t/27/b/9w/3H/cv90/3X/dv93/3n/ev98/33/fv+A/4H/g/+E/4b/h/+J/4v/jP+O/5D/kf+T/5X/lv+Y/5r/nP+e/5//of+j/6X/p/+p/6v/rP+u/7D/sv+0/7b/uP+6/7z/vv/A/8L/xP/G/8j/y//N/8//0f/T/9X/1//Z/9v/3f/g/+L/5P/m/+j/6v/s/+//8f/z//X/9//5//v//f8AAAIABAAGAAgACgAMAA4AEQATABUAFwAZABsAHQAfACEAIwAlACcAKQArAC0ALwAxADMANQA3ADkAOwA9AD4AQABCAEQARgBIAEkASwBNAE8AUABSAFQAVQBXAFkAWgBcAF0AXwBhAGIAZABlAGYAaABpAGsAbABtAG8AcABxAHMAdAB1AHYAdwB5AHoAewB8AH0AfgB/AIAAgQCCAIMAhACEAIUAhgCHAIgAiACJAIoAigCLAIwAjACNAI0AjgCOAI8AjwCPAJAAkACQAJEAkQCRAJEAkQCSAJIAkgCSAJIAkgCSAJIAkgCSAJEAkQCRAJEAkQCQAJAAkACPAI8AjwCOAI4AjQCNAIwAjACLAIoAigCJAIgAiACHAIYAhQCFAIQAgwCCAIEAgAB/AH4AfQB8AHsAegB5AHgAdwB1AHQAcwByAHAAbwBuAG0AawBqAGgAZwBmAGQAYwBhAGAAXgBdAFsAWgBYAFYAVQBTAFEAUABOAEwASwBJAEcARQBEAEIAQAA+ADwAOwA5ADcANQAzADEALwAtACsAKgAoACYAJAAiACAAHgAcABoAGAAWABQAEgAQAA4ACwAJAAcABQADAAEA///9//v/+f/3//X/8//x/+7/7P/q/+j/5v/k/+L/4P/e/9z/2v/Y/9X/0//R/8//zf/L/8n/x//F/8P/wf+//73/u/+5/7f/tf+z/7H/r/+t/6v/qf+o/6b/pP+i/6D/nv+c/5v/mf+X/5X/k/+S/5D/jv+M/4v/if+H/4b/hP+C/4H/f/9+/3z/e/95/3j/dv91/3P/cv9w/2//bv9s/2v/av9o/2f/Zv9k/2P/Yv9h/2D/X/9d/1z/W/9a/1n/WP9X/1b/Vf9U/1P/U/9S/1H/UP9P/0//Tv9N/0z/TP9L/0v/Sv9J/0n/SP9I/0f/R/9G/0b/Rv9F/0X/Rf9E/0T/RP9E/0T/Q/9D/0P/Q/9D/0P/Q/9D/0P/Q/9D/0P/Q/9E/0T/RP9E/0T/Rf9F/0X/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NQA1ADUANQA1ADUANQA1ADUANQA2ADYANgA2ADYANgA2ADYANgA2ADYANgA2ADYANgA2ADYANgA1ADUANQA1ADUANQA1ADUANQA1ADUANQA0ADQANAA0ADQANAA0ADQAMwAzADMAMwAzADMAMgAyADIAMgAyADIAMQAxADEAMQAwADAAMAAwADAALwAvAC8ALwAuAC4ALgAuAC0ALQAtACwALAAsACwAKwArACsAKgAqACoAKQApACkAKQAoACgAKAAnACcAJwAmACYAJgAlACUAJAAkACQAIwAjACMAIgAiACIAIQAhACAAIAAgAB8AHwAfAB4AHgAdAB0AHQAcABwAHAAbABsAGgAaABoAGQAZABgAGAAYABcAFwAWABYAFgAVABUAFAAUABQAEwATABIAEgARABEAEQAQABAADwAPAA8ADgAOAA0ADQANAAwADAALAAsACwAKAAoACQAJAAkACAAIAAcABwAHAAYABgAGAAUABQAEAAQABAADAAMAAwACAAIAAQABAAEAAAAAAAAA/////////v/+//7//f/9//z//P/8//v/+//7//r/+v/6//r/+f/5//n/+P/4//j/9//3//f/9v/2//b/9v/1//X/9f/0//T/9P/0//P/8//z//P/8v/y//L/8v/x//H/8f/x//D/8P/w//D/8P/v/+//7//v/+//7v/u/+7/7v/u/+3/7f/t/+3/7f/t/+z/7P/s/+z/7P/s/+z/6//r/+v/6//r/+v/6//r/+r/6v/q/+r/6v/q/+r/6v/q/+r/6v/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/p/+n/6f/q/+r/6v/q/+r/6v/q/+r/6v/q/+r/6//r/+v/6//r/+v/6//r/+v/6//s/+z/7P/s/+z/7P/s/+3/7f/t/+3/7f/t/+3/7v/u/+7/7v/u/+7/7v/v/+//7//v/+//7//w//D/8P/w//D/8f/x//H/8f/x//H/8v/y//L/8v/y//P/8//z//P/8//0//T/9P/0//T/9f/1//X/9f/1//b/9v/2//b/9v/3//f/9//3//f/+P/4//j/+P/4//n/+f/5//n/+f/6//r/+v/6//v/+//7//v/+//8//z//P/8//z//f/9//3//f/9//7//v/+//7//////////////wAAAAAAAAAAAAABAAEAAQABAAEAAgACAAIAAgACAAIAAwADAAMAAwADAAQABAAEAAQABAAFAAUABQAFAAUABQAGAAYABgAGAAYABgAHAAcABwAHAAcABwAIAAgACAAIAAgACAAIAAkACQAJAAkACQAJAAkACgAKAAoACgAKAAoACgAKAAsACwALAAsACwALAAsACwALAAwADAAMAAwADAAMAAwADAAMAAwADQANAA0ADQANAA0ADQANAA0ADQANAA0ADQAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADwAPAA8ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgAOAA4ADgANAA0ADQANAA0ADQANAA0ADQANAA0ADQANAA0ADAAMAAwADAAMAAwADAAMAAwADAAMAAsACwALAAsACwALAAsACwALAAsACwAKAAoACgAKAAoACgAKAAoACgAJAAkACQAJAAkACQAJAAkACAAIAAgACAAIAAgACAAIAAgABwAHAAcABwAHAAcABwAHAAYABgAGAAYABgAGAAYABQAFAAUABQAFAAUABQAFAAQABAAEAAQABAAEAAQAAwADAAMAAwADAAMAAwADAAIAAgACAAIAAgACAAIAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAA//////////////////////7//v/+//7//v/+//7//v/9//3//f/9//3//f/9//3//P/8//z//P/8//z//P/8//v/+//7//v/+//7//v/+//7//r/+v/6//r/+v/6//r/+v/6//r/+f/5//n/+f/5//n/+f/5//n/+f/4//j/+P/4//j/+P/4//j/+P/4//j/+P/3//f/9//3//f/9//3//f/9//3//f/9//3//f/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9P/0//T/9P/0//T/9P/0//T/9P/0//T/9P/0//T/9P/0//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//b/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9v/2//b/9v/2//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/+P/4//j/+P/4//j/+P/4//j/+P/4//j/+P/4//j/+P/5//n/+f/5//n/+f/5//n/+f/5//n/+f/5//n/+v/6//r/+v/6//r/+v/6//r/+v/6//r/+v/7//v/+//7//v/+//7//v/+//7//v/+//7//v//P/8//z//P/8//z//P/8//z//P/8//z//P/9//3//f/9//3//f/9//3//f/9//3//f/9//3//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", tr = { tap: yl, cash: xl, good: kl, bad: Il }, Ar = "bizsim3d.sound", composer = null, Qa = {}, ba = (() => {
  try {
    return localStorage.getItem(Ar) !== "off";
  } catch {
    return true;
  }
})();
function zl(e) {
  let t = atob(e), o = new Uint8Array(t.length);
  for (let A = 0; A < t.length; A++) o[A] = t.charCodeAt(A);
  return o.buffer;
}
function or() {
  if (composer) {
    composer.state === "suspended" && composer.resume().catch(() => {
    });
    return;
  }
  try {
    let e = window.AudioContext || window.webkitAudioContext;
    if (!e) return;
    composer = new e();
    for (let t of Object.keys(tr)) composer.decodeAudioData(zl(tr[t])).then((o) => {
      Qa[t] = o;
    }).catch(() => {
    });
  } catch {
    composer = null;
  }
}
function ue(e, t = 0.55) {
  if (!ba || !composer) return;
  let o = Qa[e];
  if (o) try {
    let A = composer.createBufferSource();
    A.buffer = o;
    let a = composer.createGain();
    a.gain.value = t, A.connect(a).connect(composer.destination), A.start();
  } catch {
  }
}
function ar() {
  return ba;
}
function Hl() {
  return Object.keys(Qa).length;
}
function Fl(e) {
  ba = e;
  try {
    localStorage.setItem(Ar, e ? "on" : "off");
  } catch {
  }
}
var $2 = $, SAVE_KEY = "bizsim3d.save.v1", PREF_KEY = "bizsim3d.setup.v2", GFX_KEY = "bizsim3d.gfx", WALK = 2.2, RUN = 4.8;
window.__bizsimBooted = true;
var failBoot = (msg) => window.__bizsimFail?.(msg), canvas2 = $2("view");
function makeRenderer() {
  try {
    return new THREE7.WebGLRenderer({ canvas: canvas2, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    throw failBoot("Your browser couldn\u2019t start 3D graphics. Try another browser, or turn on hardware acceleration in your browser settings."), e;
  }
}
var renderer = makeRenderer(), zo = {
  last: 0,
  lastWork: 0,
  acc: 0,
  n: 0,
  work: 0,
  t0: 0,
  max: 1,
  min: 0.75,
  minT: 0,
  ceil: 9,
  ceilT: 0,
  up: 0,
  cool: 0,
  pending: null
};
function Ho(e) {
  renderer.setPixelRatio(e), Ee && Ee.setPixelRatio(e), resize();
}
function rr(e) {
  let t = zo;
  if (t.last) {
    let r = e - t.last;
    r > 0 && r < 250 && (t.acc += r, t.work += t.lastWork, t.n++);
  }
  if (t.last = e, t.n < 30 || t.acc < 750) return;
  let o = 1e3 * t.n / t.acc, A = t.work / t.acc;
  if (t.acc = t.work = t.n = 0, mode !== "play" || document.hidden || !Qe.done) return;
  let a = renderer.getPixelRatio();
  if (t.ceil < 9 && e - t.ceilT > 45e3 && (t.ceil = 9), t.min > 0.75 && e - t.minT > 6e4 && (t.min = 0.75), t.pending) {
    let r = t.pending;
    if (t.pending = null, r.dir < 0 && o < r.fps * 1.06) {
      Ho(r.pr), t.min = r.pr, t.minT = e, t.cool = 8;
      return;
    }
    if (r.dir > 0 && o < 50) {
      Ho(r.pr), t.ceil = r.pr, t.ceilT = e, t.cool = 8;
      return;
    }
  }
  if (t.cool > 0 && t.cool--, o < 48 && A < 0.8 && a > t.min + 0.01) {
    let r = Math.max(t.min, Math.round(a * 0.82 * 100) / 100);
    t.pending = { dir: -1, pr: a, fps: o }, Ho(r), t.up = 0, t.cool = Math.max(t.cool, 3);
    return;
  }
  let s = Math.min(t.max, t.ceil);
  o >= 57 && a < s - 0.01 && t.cool <= 0 ? ++t.up >= 4 && (t.pending = { dir: 1, pr: a, fps: o }, Ho(Math.min(s, Math.round(a * 1.12 * 100) / 100)), t.up = 0, t.cool = 3) : t.up = 0;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6)), zo.max = renderer.getPixelRatio(), renderer.shadowMap.enabled = true, renderer.shadowMap.type = THREE7.PCFSoftShadowMap, renderer.toneMapping = THREE7.AgXToneMapping, renderer.toneMappingExposure = 1.55;
var camera = new THREE7.PerspectiveCamera(42, 1, 0.1, 900), touchy = window.matchMedia("(pointer: coarse)").matches, gfx = (() => {
  try {
    let v = localStorage.getItem(GFX_KEY);
    if (v === "high" || v === "fast") return v;
  } catch {
  }
  return !touchy && window.innerWidth >= 900 ? "high" : "fast";
})(), Ee = null, nr = null, gtao = null;
function buildComposer() {
  if (Ee) {
    for (let p of Ee.passes) p.dispose?.();
    Ee.dispose();
  }
  if (Ee = null, gtao = null, gfx !== "high" || !world) return;
  let w = canvas2.clientWidth || window.innerWidth, h = canvas2.clientHeight || window.innerHeight, pr = renderer.getPixelRatio(), rt2 = new THREE7.WebGLRenderTarget(w * pr, h * pr, { type: THREE7.HalfFloatType, samples: 4 });
  Ee = new EffectComposer(renderer, rt2), nr = new RenderPass(world.scene, camera), Ee.addPass(nr), gtao = new GTAOPass(world.scene, camera, w * pr, h * pr), gtao.output = GTAOPass.OUTPUT.Default, gtao.blendIntensity = 0.9, gtao.updateGtaoMaterial({
    radius: 0.55,
    distanceExponent: 1.6,
    thickness: 1.2,
    scale: 1,
    samples: 12,
    distanceFallOff: 1
  }), gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
  let g = gtao;
  g.setSize = (sw, sh) => GTAOPass.prototype.setSize.call(g, Math.max(1, sw * 0.5), Math.max(1, sh * 0.5)), g.setSize(w * pr, h * pr), Ee.addPass(gtao), Ee.addPass(new UnrealBloomPass(new THREE7.Vector2(w, h), 0.22, 0.45, 0.92)), Ee.addPass(new OutputPass()), Ee.setPixelRatio(pr), Ee.setSize(w, h);
}
// The play camera: the original angle (about 36 degrees up, 13 m back), always centred on the player.
// pitch is in radians above the horizon (1.57 would be straight down); dist is metres from the player.
// A run STARTS at exactly this framing, so there is no swing in from the setup screen's low side angle.
var PLAY_VIEW = { pitch: 0.62, dist: 13, yaw: 0.25 };
var cam = {
  yaw: 0.28,
  pitch: PLAY_VIEW.pitch,
  dist: PLAY_VIEW.dist,
  target: new THREE7.Vector3(0, 1, 1),
  focus: null,
  focusDist: 0,
  orbit: false
}, view = "third", fpYaw = Math.PI, fpPitch = 0;
function resize() {
  let w = canvas2.clientWidth || window.innerWidth, h = canvas2.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false), camera.aspect = w / Math.max(1, h), camera.fov = view === "first" ? 72 : camera.aspect < 0.8 ? 54 : 42, camera.near = view === "first" ? 0.05 : 0.1, camera.updateProjectionMatrix(), Ee?.setSize(w, h);
}
window.addEventListener("resize", resize);
var world = null, state = null, mode = "setup", player = null, people = [], tod = 0, busy = null, pending = null, closing = false, repathT = 0, traveling = false, cast = /* @__PURE__ */ new Map(), staff = [], customers = [], peds = [], cars = [], spawnT = 0, pedT = 0, signalT = 0, store = {
  get(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
},
  set(key, v) {
  try {
    localStorage.setItem(key, v);
  } catch {
  }
},
  del(key) {
  try {
    localStorage.removeItem(key);
  } catch {
  }
}
};
function save() {
  !state || state.gameOver || (state.lastPlayedAt = Date.now(), store.set(SAVE_KEY, JSON.stringify(state)));
}
function loadSave() {
  let raw = store.get(SAVE_KEY);
  if (!raw) return null;
  try {
    let s = JSON.parse(raw);
    return s && s.business && Array.isArray(s.history) && !s.gameOver ? s : null;
  } catch {
    return null;
  }
}
function ownerLook(s) {
  return s.avatar.look ?? { ...avatarLook(s.avatar), sleeves: "long" };
}
function shopNameFor(business, ownerName) {
  let noun = {
    restaurant: "Kitchen",
    convenience: "Corner Store",
    coffee: "Coffee",
    bakery: "Bakery",
    barber: "Barbershop"
  }, n = ownerName.trim();
  return n ? `${n}'s ${noun[business]}`.toUpperCase() : businessOf(business).name.toUpperCase();
}
function buildWorld(business, location, ownerName) {
  world?.dispose();
  let biz = businessOf(business);
  return world = new cl({
    business,
    location,
    accent: biz.accent,
    shopName: shopNameFor(business, ownerName),
    tagline: LOCATIONS.find((l) => l.id === location).name
  }), world.initEnv(renderer), world.firstPerson = view === "first" && mode === "play", document.documentElement.style.setProperty("--accent", biz.accent), people = [], cast.clear(), staff = [], customers = [], peds = [], cars = [], $2("labels").innerHTML = "", tags.clear(), buildCars(), mapBase = null, buildComposer(), world;
}
function addPerson(p) {
  return world.scene.add(p.root), people.push(p), world.clickables.push(p.hit), p;
}
function removePerson(p) {
  p.dispose(), people = people.filter((q) => q !== p);
  let i = world.clickables.indexOf(p.hit);
  i >= 0 && world.clickables.splice(i, 1);
  let t = tags.get(p.id);
  t && (t.remove(), tags.delete(p.id));
}
function path(from, to) {
  return world.nav.findPath(from.x, from.z, to.x, to.z);
}
function npcGo(p, to, onArrive = null) {
  let r = path(p.root.position, to);
  if (r) {
    p.walkTo(r, onArrive);
    return;
  }
  p.place(to.x, to.z, p.heading), p.walkTo([], onArrive);
}
var LANES = [
  { axis: "x", lane: 10, dir: 1, stop: 30.2 },
  { axis: "x", lane: 6, dir: -1, stop: 45.8 },
  { axis: "z", lane: 37, dir: 1, stop: 0.4 },
  { axis: "z", lane: 39, dir: -1, stop: 15.6 }
];
function buildCars() {
  let busy2 = state?.location === "high" || mode === "setup" ? 1 : state?.location === "low" ? 0.5 : 0.75, counts = [
    Math.round(5 * busy2) + 1,
    Math.round(5 * busy2) + 1,
    Math.round(3 * busy2) + 1,
    Math.round(3 * busy2) + 1
  ], kinds = ["sedan", "hatch", "suv", "sedan"];
  LANES.forEach((L, li) => {
    for (let s = 0; s < counts[li]; s++) {
      let c2 = makeCar(CAR_COLORS[(li * 3 + s * 7) % CAR_COLORS.length], kinds[(s + li) % kinds.length]), g = c2.group;
      g.rotation.y = L.axis === "x" ? L.dir === 1 ? 0 : Math.PI : L.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
      let range = L.axis === "x" ? 200 : 150, along = -range / 2 + (s + 0.3 * li) / counts[li] * range + Math.random() * 6;
      L.axis === "x" ? g.position.set(along, -0.12, L.lane) : g.position.set(L.lane, -0.12, along), world.scene.add(g);
      let speed = 7.5 + Math.random() * 3;
      cars.push({
        g,
        axis: L.axis,
        lane: L.lane,
        dir: L.dir,
        speed,
        v: speed,
        len: c2.length,
        lightsF: c2.lightsF,
        lightsR: c2.lightsR
      });
    }
  });
}
function signalState() {
  let t = signalT % 30;
  return t < 13 ? { main: "g", oak: "r" } : t < 16 ? { main: "y", oak: "r" } : t < 17 ? { main: "r", oak: "r" } : t < 27 ? { main: "r", oak: "g" } : t < 29.5 ? { main: "r", oak: "y" } : { main: "r", oak: "r" };
}
function updateCars(dt) {
  signalT += dt;
  let sig = signalState();
  world.setSignals(sig.main, sig.oak);
  let night = Math.max(0, (tod - 0.7) / 0.3);
  for (let c2 of cars) {
    let pos = c2.axis === "x" ? c2.g.position.x : c2.g.position.z, front = pos + c2.dir * c2.len / 2, want = c2.speed, L = LANES.find((l) => l.axis === c2.axis && l.lane === c2.lane), light = c2.axis === "x" ? sig.main : sig.oak, toStop = (L.stop - front) * c2.dir;
    light !== "g" && toStop > -0.3 && toStop < 30 && !(light === "y" && toStop < 4) && (want = Math.min(want, Math.max(0, toStop - 0.4) * 0.7));
    let ahead = (x, z) => {
      let lat = c2.axis === "x" ? z : x, d = ((c2.axis === "x" ? x : z) - front) * c2.dir;
      return Math.abs(lat - c2.lane) < 1.7 && d > -0.5 && d < 7;
    };
    player && ahead(player.x, player.z) && (want = 0);
    for (let p of people) if (p !== player && ahead(p.x, p.z)) {
      want = 0;
      break;
    }
    for (let o of cars) {
      if (o === c2 || o.axis !== c2.axis || o.lane !== c2.lane) continue;
      let gap = ((c2.axis === "x" ? o.g.position.x : o.g.position.z) - pos) * c2.dir - (o.len + c2.len) / 2;
      gap > -1 && gap < 9 && (want = Math.min(want, Math.max(0, gap - 1.5) * 0.9, o.v));
    }
    c2.v += (want - c2.v) * Math.min(1, dt * (want < c2.v ? 3.5 : 1)), c2.axis === "x" ? (c2.g.position.x += c2.v * c2.dir * dt, c2.g.position.x * c2.dir > 100 && (c2.g.position.x = -100 * c2.dir)) : (c2.g.position.z += c2.v * c2.dir * dt, c2.g.position.z * c2.dir > (c2.dir === 1 ? 80 : 70) && (c2.g.position.z = c2.dir === 1 ? -70 : 80));
    let brake = want < c2.v - 0.3 || c2.v < 0.3;
    for (let l of c2.lightsF) l.material.emissiveIntensity = 0.2 + night * 3;
    for (let g of c2.lightsR) g.material.emissiveIntensity = 0.25 + night * 1.5 + (brake ? 2.2 : 0);
  }
}
var PED_ROUTES = [
  { a: { x: -68, z: 2 }, b: { x: 68, z: 2 } },
  { a: { x: -68, z: 2.55 }, b: { x: 68, z: 2.55 } },
  { a: { x: -68, z: 13.2 }, b: { x: 68, z: 13.2 } },
  { a: { x: -68, z: 13.65 }, b: { x: 68, z: 13.65 } },
  { a: { x: 32, z: -46 }, b: { x: 32, z: 52 } },
  { a: { x: 32.6, z: -46 }, b: { x: 32.6, z: 52 } },
  { a: { x: 43.4, z: -46 }, b: { x: 43.4, z: 52 } },
  { a: { x: 44, z: -46 }, b: { x: 44, z: 52 } }
];
function pedCap() {
  let loc = state?.location ?? "average";
  return loc === "low" ? 10 : loc === "average" ? 16 : 24;
}
function spawnPed(anywhere = false) {
  let t = PED_ROUTES[Math.floor(Math.random() * PED_ROUTES.length)], fwd2 = Math.random() < 0.5, A = fwd2 ? t.a : t.b, b = fwd2 ? t.b : t.a, p = addPerson(new Person(randomLook())), r = anywhere ? Math.random() : 0;
  p.place(A.x + (b.x - A.x) * r, A.z + (b.z - A.z) * r, Math.atan2(b.x - A.x, b.z - A.z)), p.speed = 1.15 + Math.random() * 0.4, p.walkTo([b]), peds.push({ p });
}
function crowdLevel() {
  if (!state) return 0.4;
  let last = state.history[state.history.length - 1];
  if (!last) return 0.35;
  let cap = businessOf(state.business).baseCapacityPerDay * TIER_CAPACITY_MULT[state.storeTier - 1] * 30;
  return Math.max(0.08, Math.min(1, last.customers / cap));
}
function spawnCustomer() {
  let w = world, p = addPerson(new Person(randomLook())), dir = Math.random() < 0.5 ? 1 : -1, x0 = dir === 1 ? -30 : 30;
  p.place(x0, 2, dir === 1 ? Math.PI / 2 : -Math.PI / 2), p.speed = 1.25 + Math.random() * 0.3;
  let c2 = { p, stage: "arrive", t: 0, seat: null, q: -1 };
  customers.push(c2), p.walkTo([{ x: dir === 1 ? -0.8 : 0.8, z: 2 }], () => {
    let qi = freeQueue();
    if (qi < 0) {
      leaveCustomer(c2);
      return;
    }
    c2.q = qi, c2.stage = "toQueue", npcGo(p, w.queue[qi], () => {
      c2.stage = "queue", c2.t = 2.5 + Math.random() * 3, p.faceHeading(Math.PI);
    });
  });
}
function freeQueue() {
  let used = new Set(customers.filter((c2) => c2.stage === "toQueue" || c2.stage === "queue").map((c2) => c2.q));
  for (let i = 0; i < world.queue.length; i++) if (!used.has(i)) return i;
  return -1;
}
function leaveCustomer(c2) {
  c2.stage = "leave", c2.seat && (c2.seat.taken = false, c2.seat = null), c2.p.sitting = false;
  let dir = Math.random() < 0.5 ? 1 : -1, out = world.door.out;
  c2.p.walkTo([
    ...insideShop(c2.p.x, c2.p.z) ? path(c2.p.root.position, out) ?? [out] : [],
    { x: out.x + dir, z: 2 },
    { x: 32 * dir, z: 2 }
  ], () => {
    c2.stage = "gone";
  });
}
function updateCustomers(dt) {
  let w = world;
  for (let c2 of customers) if (c2.stage === "queue") {
    if (c2.t -= dt, c2.t <= 0) {
      let seat = w.seats.find((s) => !s.taken && Math.random() < 0.85);
      seat && Math.random() < 0.8 ? (seat.taken = true, c2.seat = seat, c2.stage = "toSeat", npcGo(c2.p, seat.approach, () => {
        c2.p.walkTo([{ x: seat.x, z: seat.z }], () => {
          seat.sit ? (c2.p.sitHeight = seat.y, c2.p.sit(seat.h)) : c2.p.faceHeading(seat.h), c2.stage = "seated", c2.t = 9 + Math.random() * 12;
        });
      })) : leaveCustomer(c2);
    }
  } else if (c2.stage === "seated" && (c2.t -= dt, c2.t <= 0)) {
    c2.p.sitting = false;
    let a = c2.seat;
    c2.p.place(a.approach.x, a.approach.z, c2.p.heading), leaveCustomer(c2);
  }
  for (let A of customers.filter((x) => x.stage === "gone")) removePerson(A.p);
  customers = customers.filter((c2) => c2.stage !== "gone"), spawnT -= dt;
  let crowd = crowdLevel();
  spawnT <= 0 && !closing && (spawnT = 13 - crowd * 10 + Math.random() * 3, customers.filter((c2) => c2.stage !== "leave").length < Math.min(w.seats.length + 3, 4 + crowd * 10) && spawnCustomer()), updatePeds(dt);
}
function updatePeds(dt) {
  pedT -= dt, pedT <= 0 && (pedT = 0.8 + Math.random() * 1.6, peds.length < pedCap() && spawnPed());
  for (let q of peds.filter((x) => !x.p.path.length)) removePerson(q.p);
  peds = peds.filter((q) => q.p.path.length);
}
var STAFF_LINES = [
  (n) => `${n}: "Steady so far, boss. The lunch rush is coming."`,
  (n) => `${n}: "We're low on a couple of things. I'll flag it."`,
  (n) => `${n}: "Regulars keep asking when you're in. They like seeing you."`,
  (n) => `${n}: "All good back here."`
];
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h ^= s.charCodeAt(i), h = Math.imul(h, 16777619);
  return h >>> 0;
}
function seeded(seed) {
  let s = seed || 1;
  return () => ((s = Math.imul(s ^ s >>> 15, 2246822507) ^ Math.imul(s ^ s >>> 13, 3266489909)) >>> 0) / 4294967296;
}
function buildStaff() {
  for (let s of staff) removePerson(s.p);
  if (staff = [], !state || !world) return;
  let w = world, biz = businessOf(state.business), uniform = new THREE7.Color(biz.accent).multiplyScalar(0.55).getStyle(), team = state.roster.filter((m) => m.role !== "manager"), spots = [...w.staffSpots.slice(0, state.business === "barber" ? 1 : 3), ...w.backStaffSpots];
  team.slice(0, spots.length).forEach((m, r) => {
    let look = {
      ...randomLook(seeded(hashStr(m.name))),
      clothes: uniform,
      accessory: "apron",
      sleeves: "short",
      bottom: "pants"
    }, p = addPerson(new Person(look)), sp = spots[r];
    p.place(sp.x, sp.z, sp.h), staff.push({
      p,
      name: m.name,
      home: sp,
      line: () => STAFF_LINES[Math.floor(Math.random() * STAFF_LINES.length)](m.name.split(" ")[0]) + ` (skill ${m.skill}, morale ${Math.round(m.morale)})`
    });
  }), state.business === "barber" && state.barbers.slice(0, 3).forEach((b, r) => {
    let z = [-4.8, -2.9, -1][r], look = {
      ...randomLook(seeded(hashStr(b.name))),
      clothes: "#2b2b2e",
      accessory: "scissorsPin",
      bottom: "pants"
    }, p = addPerson(new Person(look)), sp = { x: 4.95, z: z + 0.5, h: Math.PI / 2 };
    p.place(sp.x, sp.z, sp.h), staff.push({
      p,
      name: b.name,
      home: sp,
      line: () => `${b.name.split(" ")[0]}: "Chair's paid up. Book's filling."`
    });
  });
}
var CAST_EXTRA = {
  regular: { bottom: "skirt", height: 0.94 },
  landlord: { bottom: "skirt" },
  influencer: { sleeves: "short", height: 0.97 },
  accountant: { height: 0.97 },
  inspector: { height: 1 },
  banker: { height: 1.03, build: 1.08 },
  neighbor: { sleeves: "short", build: 1.15, height: 1.05 },
  contractor: { sleeves: "short", build: 1.08 },
  supplier: { build: 1.05 },
  rival: { height: 1.04 },
  manager: { sleeves: "short" }
};
function castLook(id) {
  return { ...CAST[id].look, ...CAST_EXTRA[id] };
}
function settle(npc) {
  let h = npc.home;
  h.sit ? (npc.p.sitHeight = h.sitY ?? 0.47, npc.p.sit(h.h)) : npc.p.faceHeading(h.h);
}
function ensureCast(id) {
  let npc = cast.get(id);
  if (npc) return npc;
  let home = HOMES[id] ?? { x: 0, z: 3, h: 0 }, p = addPerson(new Person(castLook(id)));
  return p.place(home.x, home.z, home.h), npc = { id, p, cards: [], home, spot: null }, cast.set(id, npc), settle(npc), npc;
}
function spawnCardCast() {
  if (!state || !world) return;
  let w = world, used = /* @__PURE__ */ new Map();
  for (let id of Object.keys(HOMES)) ensureCast(id);
  state.currentCards.forEach((card, A) => {
    if (state.completedCards.includes(A)) return;
    let speaker = card.speaker === "narrator" ? "manager" : card.speaker, npc = ensureCast(speaker);
    if (npc.cards.push(A), npc.cards.length > 1) return;
    let venue = card.venue ?? "inside";
    if (speaker === "accountant" && venue === "office") {
      npc.spot = null;
      return;
    }
    let k = used.get(venue) ?? 0;
    used.set(venue, k + 1);
    let list = w.spots[venue], base = list[k % list.length], sp = { x: base.x + Math.floor(k / list.length) * 0.8, z: base.z, h: base.h };
    npc.spot = sp;
    let p = npc.p;
    p.sitting = false, p.speed = 2, npcGo(p, sp, () => p.faceHeading(sp.h));
  });
}
function releaseNpc(npc) {
  let p = npc.p;
  p.speed = 1.5, npc.spot = null;
  let h = npc.home;
  if (Math.hypot(p.x - h.x, p.z - h.z) < 0.4) {
    settle(npc);
    return;
  }
  npcGo(p, h, () => settle(npc));
}
var Pr = performance.now(), pinch0 = 0, Ha = -1;
function Dr() {
  if (!state) return;
  let e = Math.max(0, Math.ceil((ca - (state.activeMs || 0)) / 6e4));
  e !== Ha && (Ha = e, $2("clockLeft").textContent = e <= 1 ? "under a minute left" : `${e} min left`);
}
function Wl() {
  let e = performance.now(), t = Math.min(e - Pr, 1e3);
  Pr = e, !(!state || mode !== "play" || closing || traveling || document.hidden) && (state.activeMs = (state.activeMs || 0) + t, pinch0 += t, pinch0 > 15e3 && (pinch0 = 0, save()), Dr(), state.activeMs >= ca && !dialogOpen && !panelOpen && !mapOpen && !busy && (toast(`Twenty minutes on the clock. Priya is closing the books on ${monthName(state.month + 1)}.`), closeMonth()));
}
function applyWorldState() {
  if (!state || !world) return;
  world.setSeason(calendarMonth(state.month + 1)), world.setRival(state.competitors[0]?.name ?? null);
  let m = currentMenu(state);
  world.setMenu(m.heading, m.lines.map((l) => ({ name: l.name, price: formatPrice(l.price), isNew: l.isNew })), m.note), world.setRenovating(state.renovationMonthsLeft > 0);
}
function startMonth(fresh) {
  if (!(!state || !world)) {
    if (!state.currentCards.length) {
      let cards = drawCards(state), intro = monthOpen(state);
      state = {
        ...state,
        currentCards: cards,
        completedCards: [],
        monthIntro: intro,
        monthStory: [intro]
      }, save();
    }
    applyWorldState();
    for (let npc of cast.values()) npc.cards = [], npc.spot = null, npc.p.stop(), npc.p.place(npc.home.x, npc.home.z, npc.home.h), settle(npc);
    for (let c2 of customers) removePerson(c2.p);
    customers = [];
    for (let t of world.seats) t.taken = false;
    world.seats.filter((s) => s.x > 13).forEach((s) => s.taken = true), buildStaff(), spawnCardCast(), tod = progress() * 0.85, world.setTime(tod), fresh && player && (player.place(0, 2.7, Math.PI), fpYaw = Math.PI, fpPitch = 0, cam.target.set(0, 1, 2.7)), Oe(state), refreshTasks(), Ha = -1, Dr(), slate(`${monthName(state.month + 1)}, year ${yearOf(state.month + 1)}`, state.monthIntro);
  }
}
function progress() {
  return !state || !state.currentCards.length ? 0 : state.completedCards.length / state.currentCards.length;
}
function venueName(v) {
  return { street: "Street", inside: "Shop floor", back: "Back room", office: "Office" }[v ?? "inside"];
}
function refreshTasks() {
  if (!state) return;
  let items = state.currentCards.map((card, i) => {
    let speaker = card.speaker === "narrator" ? "manager" : card.speaker, name = CAST[speaker].name, r = state.completedCards.includes(i);
    return {
      label: name,
      where: venueName(card.venue),
      done: r,
      onClick: () => {
      let n = cast.get(speaker);
      n && goToPerson(n);
    }
    };
  }), left = state.currentCards.length - state.completedCards.length;
  items.push({
    label: "Close the month with Priya",
    where: "Office",
    done: false,
    final: true,
    onClick: () => {
    let n = cast.get("accountant");
    n && goToPerson(n);
  }
  }), renderTasks(items, left ? `${left} waiting on you` : "Ready to close");
}
function markDone(idx) {
  !state || state.completedCards.includes(idx) || (state = { ...state, completedCards: [...state.completedCards, idx] });
}
function finishCard(npc, idx) {
  state && (markDone(idx), npc.cards = npc.cards.filter((c2) => c2 !== idx), save(), npc.cards.length || releaseNpc(npc), Oe(state), refreshTasks());
}
function playCard(npc) {
  if (!state) return;
  let idx = npc.cards[0], card = state.currentCards[idx];
  if (!card) return;
  if (state.completedCards.includes(idx)) {
    finishCard(npc, idx);
    return;
  }
  let spec = cardDialogSpec(card, state), thinking = false, thinkIdx = spec.options.length;
  spec.options = [...spec.options, { label: "Give me a second to think", hint: "Ask your mentor, then come back" }];
  startTalk(npc.p), openDialog({
    ...spec,
    onLine: (on2) => on2 ? npc.p.talk() : npc.p.quiet(),
    onPick: (i) => {
    if (i === thinkIdx) return thinking = true, null;
    if (state.completedCards.includes(idx)) return null;
    let before = state;
    state = applyOption(state, card, i), markDone(idx), save();
    let delta = state.cash - before.cash;
    Oe(state), delta && toast(`${delta > 0 ? "Cash in" : "Spent"} ${money(Math.abs(delta))}`, delta > 0 ? "good" : ""), applyWorldState();
    let n = card.options[i];
    return ue(n?.cost || n?.action ? "cash" : "tap"), (card.fromEvent ? eventResponseLine(card.id, i).line : card.options[i]?.result) || null;
  },
    onClose: () => {
    if (endTalk(), thinking) {
      thinkItOver(card);
      return;
    }
    finishCard(npc, idx);
  }
  });
}
// "Give me a second to think": the card stays open for later, and the decision goes to the mentor.
function thinkItOver(card) {
  const options = card.options.map((o, i) => `${i + 1}) ${o.label}${o.cost ? ` ($${Math.round(o.cost).toLocaleString()})` : ""}`).join("; ");
  const question = `I'm deciding: "${card.title}". Options: ${options}. Which is best for my business right now, and why?`.slice(0, 390);
  const m = window.__bizsimMentor;
  if (m && m.ready && m.askAbout) m.askAbout(question);
  else toast("Take your time. The card stays open for when you come back.");
}
// ---------------- Priya's office: you sit in the chair across the desk, in first person ----------------
// Priya sits at z = -9.45 facing the desk. The owner's chair is behind the desk at z = -11.55, so you face her.
var OFFICE_CHAIR = { x: 4.4, z: -11.55, heading: 0, sitY: 0.47 };
var seatScene = null, closeRequested = false;
function sitAcrossFromPriya(then) {
  if (!state || !player || seatScene) {
    then();
    return;
  }
  let fade = $2("fade");
  seatScene = { view, yaw: cam.yaw, x: player.x, z: player.z, h: player.heading };
  closeRequested = false, player.stop(), pending = null, exitPointerLock();
  $2("fadeText").textContent = "Taking a seat\u2026", fade.classList.add("on");
  setTimeout(() => {
    if (!seatScene || !player) return;
    player.place(OFFICE_CHAIR.x, OFFICE_CHAIR.z, OFFICE_CHAIR.heading), player.sitHeight = OFFICE_CHAIR.sitY, player.sit(OFFICE_CHAIR.heading);
    Yo("first"), fpYaw = OFFICE_CHAIR.heading, fpPitch = -0.05, $2("crosshair").hidden = true;
    fade.classList.remove("on");
    setTimeout(then, 450);
  }, 450);
}
function standUp() {
  let s = seatScene;
  if (seatScene = null, closeRequested = false, !s || !player) return;
  player.sitting = false, player.place(s.x, s.z, s.h);
  Yo(s.view), cam.yaw = s.yaw, cam.target.set(player.x, 1.1, player.z);
}
function closeMonthDialog(npc) {
  if (!state) return;
  let left = state.currentCards.length - state.completedCards.length, name = monthName(state.month + 1);
  startTalk(npc.p), openDialog({
    name: "Priya",
    role: "your accountant",
    color: CAST.accountant.look.clothes,
    title: "Close the month",
    lines: left ? [`${left === 1 ? "Someone is" : `${left} people are`} still waiting on a decision from you. Close ${name} anyway? Whatever you skip just doesn't happen.`] : [`Receipts are in, the till's counted. Ready to close out ${name}?`],
    options: [
      { label: `Close ${name}`, hint: "Run the month and read the numbers" },
      { label: "Not yet", hint: "Keep working the shop" }
    ],
    onLine: (on2) => on2 ? npc.p.talk() : npc.p.quiet(),
    onPick: (i) => (i === 0 && (closeRequested = true, setTimeout(closeMonth, 50)), null),
    onClose: () => {
      endTalk();
      closeRequested || standUp(); // "Not yet": get up again. Closing the month keeps you seated through the recap.
    }
  });
}
function closeMonth() {
  if (!state || !world || closing) return;
  closing = true, exitPointerLock();
  let fade = $2("fade");
  $2("fadeText").textContent = "Closing the books\u2026", fade.classList.add("on"), setTimeout(() => {
    let outcome = endMonth(state);
    ue(outcome.record.profit >= 0 ? "cash" : "bad");
    let story = monthRecap(outcome.record, outcome.state);
    state = outcome.state;
    for (let npc of cast.values()) npc.cards.length && (npc.cards = [], releaseNpc(npc));
    refreshTasks(), state.gameOver ? store.del(SAVE_KEY) : save(), fade.classList.remove("on"), tod = 1, world.setTime(1), Oe(state);
    let next = state.gameOver ? "the results" : `${monthName(state.month + 1)}`;
    openPanel(`${monthName(outcome.record.month)} closes`, recapHtml(outcome, story, next), void 0, { noClose: true }), $2("recapGo").addEventListener("click", () => {
      if (ue("tap"), closePanel(), closing = false, standUp(), state.gameOver) {
        showEnd();
        return;
      }
      fade.classList.add("on"), $2("fadeText").textContent = `${monthName(state.month + 1)}`, setTimeout(() => {
        startMonth(true), fade.classList.remove("on");
      }, 700);
    });
  }, 750);
}
function showEnd() {
  if (!state) return;
  mode = "end", exitPointerLock();
  let score = scoreGame(state), el = $2("end");
  el.innerHTML = endHtml(state, score), el.hidden = false;
  for (let id of ["hud", "tasks", "minimap", "crosshair"]) $2(id).hidden = true;
  $2("endAgain").addEventListener("click", () => {
    el.hidden = true, store.del(SAVE_KEY), state = null, showSetup();
  });
}
var talkPartner = null;
function startTalk(p) {
  player && (ue("tap", 0.35), player.stop(), pending = null, talkPartner = p, p.stop(), p.sitting || p.face(player.x, player.z), player.face(p.x, p.z), p.lookTarget = player.root.position, cA() || exitPointerLock());
}
function endTalk() {
  talkPartner && (talkPartner.lookTarget = null, talkPartner.quiet()), talkPartner = null, cam.focus = null;
}
function chat(p, t, o, A, a) {
  startTalk(p), p.wave(), setTimeout(() => p.rest(), 1400), openDialog({
    name: t,
    role: o,
    color: A,
    lines: a,
    onLine: (on2) => on2 ? p.talk() : p.quiet(),
    onClose: endTalk
  });
}
function residentChat(npc) {
  if (!state) return;
  let t = state, phase = phaseDisplay(t.macro.phase).label.toLowerCase(), c2 = CAST[npc.id], last = t.history[t.history.length - 1], lines = {
    neighbor: [
      t.macro.phase === "boom" ? "Memberships are flying out the door. People have money right now. Spend some of yours on the place while it lasts." : t.macro.phase === "recession" ? "Cancellations every morning. Folks are tightening up. Watch your fixed costs, that's all I'll say." : `Economy feels ${phase} from where I stand. Foot traffic past my door looks about the same as yours.`,
      t.reputation > 65 ? "My members talk about your place after spin class. That's free advertising." : "Want a tip? Get out on the street and shake hands. The market square is where this block talks."
    ],
    regular: [
      t.reputation > 70 ? "Best spot on the block, dear. I tell everyone at bridge club." : t.reputation < 40 ? "I'll keep coming, dear. But people are talking, and not kindly. Fix it." : "Still settling in, aren't you? You'll find your feet.",
      t.fatigue > 55 ? "Same things on offer every time I come in. Surprise me, would you?" : "This bench is lovely this time of day. Come sit when you need to think."
    ],
    banker: [
      t.loan ? `You owe us ${money(t.loan)} at ${t.interestRate.toFixed(1)}%. Rates are drifting with the economy, which is ${phase}.` : `Your account is clean. If you need a line of credit, the door's open. Current rate is ${t.interestRate.toFixed(1)}%.`,
      "Walk into the branch any time to borrow or pay down. It takes a little groundwork on your end."
    ],
    accountant: [last ? `Last month you ${last.profit >= 0 ? "made" : "lost"} ${money(Math.abs(last.profit))}. The full breakdown is in the books.` : "First month. I'll keep the receipts straight, you keep the customers happy."],
    manager: [
      t.morale < 50 ? "Team's worn thin, boss. A bonus or a lighter week would go a long way." : "Floor's covered. If you want to help, the kitchen could use hands at lunch.",
      `We've got ${t.staff} on the roster. Morale's around ${Math.round(t.morale)}.`
    ],
    supplier: [
      t.supplierDealMonths > 0 ? `Your contract has ${t.supplierDealMonths} more months at the locked rate. Best deal on my route.` : "Prices are moving with the economy. When I get a good contract to offer, you'll hear it first.",
      "Truck's loaded for the restaurants down Oak. Busy week."
    ],
    contractor: [
      t.renovationMonthsLeft > 0 ? "Your reno is on schedule. Mostly." : `Your place is tier ${t.storeTier}. When you want to grow it, I'm the one you call.`,
      "This frame goes up a floor a month if the steel shows up."
    ],
    inspector: [
      t.inspectionDue ? "You're on my list this season. Keep the back room clean and the team staffed." : "Just walking the district. Clean kitchens make for quiet days.",
      `Your premises look about ${Math.round(t.condition)} out of 100 from the street.`
    ],
    landlord: [
      `Rent's ${money(t.rentCurrent)} a month on your lease, ${t.leaseMonthsLeft} months to go before it re-prices.`,
      "I keep my buildings in good order. I expect the same from my tenants."
    ],
    influencer: [
      t.reputation > 60 ? "Your place keeps popping up on my feed. People like it." : "I post where the vibe is. Make me want to post you.",
      "This caf\xE9 has the best light on the block. Content gold."
    ],
    rival: [
      t.competitors.length ? `${t.competitors[0].name} is doing just fine, thanks for asking.` : "Just looking around. Nice block. Lot of potential.",
      "May the better shop win."
    ]
  };
  chat(npc.p, c2.name, c2.role, c2.look.clothes, lines[npc.id] ?? ["Busy day. Talk later."]);
}
function interFor(npc) {
  let c2 = CAST[npc.id], p = npc.p, card = npc.cards.length ? state.currentCards[npc.cards[0]] : void 0;
  if (card) return {
    key: `cast:${npc.id}`,
    x: p.x,
    z: p.z,
    r: 1.7,
    label: `Talk to ${c2.name}`,
    sub: card.title,
    enabled: true,
    run: () => playCard(npc),
    person: p,
    priority: 2
  };
  if (npc.id === "accountant") {
    let left = state.currentCards.length - state.completedCards.length;
    return {
      key: "cast:accountant",
      x: p.x,
      z: p.z,
      r: 1.7,
      label: "Close the month with Priya",
      sub: left ? `${left} still waiting` : "Everything is handled",
      enabled: true,
      run: () => sitAcrossFromPriya(() => closeMonthDialog(npc)),
      person: p,
      priority: 2
    };
  }
  return {
    key: `cast:${npc.id}`,
    x: p.x,
    z: p.z,
    r: 1.6,
    label: `Chat with ${c2.name}`,
    sub: c2.role,
    enabled: true,
    run: () => residentChat(npc),
    person: p
  };
}
function activityInter(id, anchor) {
  let o = world.anchors[anchor];
  if (!o || !state) return null;
  let act = ACTIVITIES.find((x) => x.id === id), ok = canDoActivity(state, id);
  return {
    key: id,
    x: o.x,
    z: o.z,
    r: o.r,
    mesh: o.mesh,
    label: act.label(state.business),
    sub: ok.ok ? act.hint : ok.why,
    enabled: ok.ok,
    run: () => {
    let check = canDoActivity(state, id);
    if (!check.ok) {
      toast(check.why, "bad"), ue("bad", 0.4);
      return;
    }
    busy = {
      t: 1.6,
      face: { x: o.x, z: o.z },
      done: () => {
      let r = doActivity(state, id);
      state = r.state, toast(r.line, "good"), ue("good"), Oe(state), save();
    }
    };
  }
  };
}
function interactions() {
  if (!state || !world) return [];
  let w = world, out = [];
  for (let npc of cast.values()) out.push(interFor(npc));
  for (let n of staff) out.push({
    key: `staff:${n.name}`,
    x: n.p.x,
    z: n.p.z,
    r: 1.4,
    label: `Chat with ${n.name.split(" ")[0]}`,
    sub: "your staff",
    enabled: true,
    person: n.p,
    run: () => chat(n.p, n.name, "on your team", n.p.look.clothes, [n.line()])
  });
  for (let [id, anchor] of [
    ["serve", "register"],
    ["clean", "sink"],
    ["help", "prep"],
    ["books", "desk"],
    ["scout", "rival"],
    ["network", "market"]
  ]) {
    let it = activityInter(id, anchor);
    it && out.push(it);
  }
  let menu = w.anchors.menu;
  out.push({
    key: "menu",
    x: menu.x,
    z: menu.z,
    r: menu.r,
    mesh: menu.mesh,
    label: "Read the menu board",
    sub: "what you charge",
    enabled: true,
    run: () => openPanel(currentMenu(state).heading, menuHtml(state))
  });
  let bank = w.anchors.bank;
  out.push({
    key: "bank",
    x: bank.x,
    z: bank.z,
    r: bank.r,
    label: "Walk into Civic Savings",
    sub: `borrow or repay \xB7 ${LOAN_AP} AP to borrow`,
    enabled: true,
    run: openBank
  });
  let ads = w.anchors.ads;
  out.push({
    key: "ads",
    x: ads.x,
    z: ads.z,
    r: ads.r,
    mesh: ads.mesh,
    label: "Book an ad",
    sub: `now: ${MARKETING_TIERS.find((t) => t.id === state.marketingTier).name}`,
    enabled: true,
    run: openAds
  });
  let bench2 = w.anchors.bench, br = canTakeBreak(state);
  return out.push({
    key: "bench",
    x: bench2.x,
    z: bench2.z,
    r: bench2.r,
    mesh: bench2.mesh,
    label: "Take a real break",
    sub: br.ok ? "full energy; your manager runs the shop" : br.why,
    enabled: br.ok,
    run: () => {
    let check = canTakeBreak(state);
    if (!check.ok) {
      toast(check.why, "bad"), ue("bad", 0.4);
      return;
    }
    state = takeBreak(state), toast("You actually rested. Full tank.", "good"), ue("good"), Oe(state), save();
  }
  }), out;
}
function openBank() {
  exitPointerLock();
  let render = () => {
    let el = openPanel("Civic Savings", bankHtml(state));
    el.querySelector("#bankBorrow")?.addEventListener("click", () => {
      state.ap < LOAN_AP || (state = { ...borrow(state), ap: state.ap - LOAN_AP }, toast(`Borrowed ${money(5e3)}`, "good"), ue("cash"), Oe(state), save(), render());
    }), el.querySelector("#bankRepay")?.addEventListener("click", () => {
      state = repay(state), toast("Paid down the loan", "good"), ue("cash"), Oe(state), save(), render();
    });
  };
  render();
}
function openAds() {
  exitPointerLock();
  let render = () => {
    openPanel("Advertising", adsHtml(state)).querySelectorAll("[data-tier]").forEach((b) => b.addEventListener("click", () => {
      let id = b.dataset.tier, t = MARKETING_TIERS.find((x) => x.id === id), needsAp = t.cost > 0 && state.marketingTier !== id;
      needsAp && state.ap < ADS_AP || (state = { ...state, marketingTier: id, ap: state.ap - (needsAp ? ADS_AP : 0) }, toast(id === "none" ? "Ads switched off" : `${t.name} booked`, "good"), ue(id === "none" ? "tap" : "cash"), Oe(state), save(), render());
    }));
  };
  render();
}
var nearest = null;
function updatePrompt() {
  let el = $2("prompt");
  if (!player || dialogOpen || panelOpen || busy || mode !== "play" || traveling || closing) {
    el.hidden = true, nearest = null;
    return;
  }
  let best = null, bestScore = 1 / 0, fx = Math.sin(fpYaw), fz = Math.cos(fpYaw);
  for (let it of interactions()) {
    let dx = it.x - player.x, dz = it.z - player.z, d = Math.hypot(dx, dz);
    if (d > it.r) continue;
    let score = d - (it.priority ?? 0) * 0.6;
    view === "first" && d > 0.01 && (score -= (dx * fx + dz * fz) / d * 0.8), score < bestScore && (bestScore = score, best = it);
  }
  (best?.key !== nearest?.key || best && nearest && (best.sub !== nearest.sub || best.label !== nearest.label)) && best && (el.innerHTML = `<kbd>E</kbd><span>${best.label}</span>${best.sub ? `<small>${best.sub}</small>` : ""}`, el.classList.toggle("off", !best.enabled)), nearest = best, el.hidden = !best;
}
function goTo(it) {
  if (!player || dialogOpen || panelOpen || busy || closing || traveling) return;
  if (Math.hypot(player.x - it.x, player.z - it.z) <= it.r * 0.9) {
    it.run();
    return;
  }
  let r = path(player.root.position, { x: it.x, z: it.z });
  if (!r) {
    toast("You can't get there from here.", "bad"), ue("bad", 0.4);
    return;
  }
  pending = it;
  let far = Math.hypot(player.x - it.x, player.z - it.z) > 14;
  player.speed = far ? RUN : WALK, player.walkTo(r);
}
function goToPerson(npc) {
  if (!player) return;
  if (Math.hypot(player.x - npc.p.x, player.z - npc.p.z) < 22) {
    goTo(interFor(npc));
    return;
  }
  let p = npc.p, fx = Math.sin(p.heading), fz = Math.cos(p.heading), free = world.nav.nearestFree(p.x + fx * 1.2, p.z + fz * 1.2), x = free ? world.nav.wx(free[0]) : p.x + fx * 1.2, z = free ? world.nav.wz(free[1]) : p.z + fz * 1.2;
  travelTo({ name: CAST[npc.id].name, x, z, h: Math.atan2(p.x - x, p.z - z) }, () => goTo(interFor(npc)));
}
function travelTo(place, after) {
  if (!player || !world || dialogOpen || closing || traveling) return;
  traveling = true, ue("tap", 0.35), closeMap();
  let fade = $2("fade");
  $2("fadeText").textContent = `Heading to ${place.name}`, fade.classList.add("on"), setTimeout(() => {
    player.stop(), pending = null, player.place(place.x, place.z, place.h), fpYaw = place.h, fpPitch = 0, cam.target.set(place.x, 1, place.z), cam.yaw = place.h + Math.PI, fade.classList.remove("on"), traveling = false, after?.();
  }, 520);
}
var mapBase = null, MAPPAD = 4;
function mapExtent() {
  return {
    x0: BOUNDS.x0 - MAPPAD,
    z0: BOUNDS.z0 - MAPPAD,
    x1: BOUNDS.x1 + MAPPAD,
    z1: BOUNDS.z1 + MAPPAD
  };
}
var MAP_COLORS = {
  road: "#3c434b",
  walk: "#8d9296",
  building: "#c9bfae",
  park: "#7aa05a",
  lot: "#57606a",
  site: "#a58a62",
  shop: ""
};
function paintMapBase(scale) {
  let e = mapExtent(), c2 = document.createElement("canvas");
  c2.width = Math.ceil((e.x1 - e.x0) * scale), c2.height = Math.ceil((e.z1 - e.z0) * scale);
  let g = c2.getContext("2d");
  g.fillStyle = "#d9d4c7", g.fillRect(0, 0, c2.width, c2.height);
  let rect = (r, color) => {
    g.fillStyle = color, g.fillRect((r.x0 - e.x0) * scale, (r.z0 - e.z0) * scale, (r.x1 - r.x0) * scale, (r.z1 - r.z0) * scale);
  }, order = ["walk", "road", "park", "lot", "site", "building", "shop"];
  for (let k of order) for (let n of world.mapRects) n.kind === k && rect(n, k === "shop" ? businessOf(world.opts.business).accent : MAP_COLORS[k]);
  g.strokeStyle = "rgba(0,0,0,0.18)", g.lineWidth = 1;
  for (let r of world.mapRects) (r.kind === "building" || r.kind === "shop") && g.strokeRect((r.x0 - e.x0) * scale + 0.5, (r.z0 - e.z0) * scale + 0.5, (r.x1 - r.x0) * scale - 1, (r.z1 - r.z0) * scale - 1);
  return c2;
}
function markers() {
  let out = [];
  for (let npc of cast.values()) npc.cards.length && state?.currentCards[npc.cards[0]] ? out.push({ x: npc.p.x, z: npc.p.z, kind: "need" }) : npc.id === "accountant" && out.push({ x: npc.p.x, z: npc.p.z, kind: "close" });
  return out;
}
function drawMarker(g, x, y, kind, s) {
  g.beginPath(), kind === "need" ? (g.fillStyle = "#ff8a3d", g.arc(x, y, 5 * s, 0, Math.PI * 2), g.fill(), g.fillStyle = "#1b1208", g.font = `800 ${8 * s}px system-ui`, g.textAlign = "center", g.textBaseline = "middle", g.fillText("!", x, y + 0.5)) : kind === "close" && (g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#f2b632", g.fillRect(x - 4.5 * s, y - 4.5 * s, 9 * s, 9 * s), g.fillStyle = "#1b1208", g.font = `800 ${8 * s}px system-ui`, g.textAlign = "center", g.textBaseline = "middle", g.fillText("$", x, y + 0.5));
}
function drawYou(g, x, y, heading, s) {
  g.save(), g.translate(x, y), g.rotate(-heading + Math.PI), g.fillStyle = "#ffffff", g.strokeStyle = "#131a21", g.lineWidth = 2, g.beginPath(), g.moveTo(0, -7 * s), g.lineTo(5 * s, 6 * s), g.lineTo(0, 3 * s), g.lineTo(-5 * s, 6 * s), g.closePath(), g.stroke(), g.fill(), g.restore();
}
function updateMinimap() {
  let mm = $2("minimap");
  if (mm.hidden || !world || !player) return;
  let W = mm.width, H = mm.height, scale = 2.2;
  mapBase || (mapBase = paintMapBase(scale));
  let e = mapExtent(), g = mm.getContext("2d"), px = (player.x - e.x0) * scale, pz = (player.z - e.z0) * scale;
  g.fillStyle = "#d9d4c7", g.fillRect(0, 0, W, H), g.drawImage(mapBase, W / 2 - px, H / 2 - pz);
  for (let m of markers()) drawMarker(g, W / 2 + (m.x - player.x) * scale, H / 2 + (m.z - player.z) * scale, m.kind, 1);
  drawYou(g, W / 2, H / 2, view === "first" ? fpYaw : player.heading, 1);
}
function openMap2() {
  if (!world || !player || mode !== "play" || dialogOpen) return;
  exitPointerLock(), $2("help").hidden = true;
  let scale = 4, base = paintMapBase(scale), e = mapExtent(), cv = openMap(world.places.map((p) => ({ id: p.id, name: p.name })), (id) => {
    let p = world.places.find((q) => q.id === id);
    p && travelTo(p);
  }).querySelector("canvas");
  cv.width = base.width, cv.height = base.height;
  let a = cv.getContext("2d");
  (() => {
    a.drawImage(base, 0, 0), a.font = '600 13px "Atkinson Hyperlegible", system-ui', a.textAlign = "center", a.textBaseline = "middle";
    for (let p of world.places) {
      let x = (p.x - e.x0) * scale, y = (p.z - e.z0) * scale;
      a.fillStyle = "#131a21", a.beginPath(), a.arc(x, y, 5, 0, Math.PI * 2), a.fill(), a.fillStyle = "#f1ede3", a.beginPath(), a.arc(x, y, 2.5, 0, Math.PI * 2), a.fill();
    }
    a.font = '600 11px "Atkinson Hyperlegible", system-ui';
    for (let s of world.mapRects) if (s.label) {
      let r = ((s.x0 + s.x1) / 2 - e.x0) * scale, n = ((s.z0 + s.z1) / 2 - e.z0) * scale;
      if (a.measureText(s.label).width > (s.x1 - s.x0) * scale - 4) continue;
      a.fillStyle = "rgba(19,26,33,0.8)", a.fillText(s.label, r, n);
    }
    a.fillStyle = "rgba(19,26,33,0.55)", a.font = "700 12px system-ui", a.fillText("MAIN ST", (-50 - e.x0) * scale, (8 - e.z0) * scale), a.save(), a.translate((38 - e.x0) * scale, (-30 - e.z0) * scale), a.rotate(-Math.PI / 2), a.fillText("OAK AVE", 0, 0), a.restore();
    for (let m of markers()) drawMarker(a, (m.x - e.x0) * scale, (m.z - e.z0) * scale, m.kind, 1.5);
    drawYou(a, (player.x - e.x0) * scale, (player.z - e.z0) * scale, view === "first" ? fpYaw : player.heading, 1.5);
  })(), cv.addEventListener("click", (ev) => {
    let r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * cv.width / scale + e.x0, z = (ev.clientY - r.top) / r.height * cv.height / scale + e.z0, best = world.places[0], bd = 1 / 0;
    for (let p of world.places) {
      let d = Math.hypot(p.x - x, p.z - z);
      d < bd && (bd = d, best = p);
    }
    bd < 9 && travelTo(best);
  });
}
function Yo(v) {
  view = v, world && (world.firstPerson = v === "first"), player && player.setVisible(v === "third"), v === "first" && player && (fpYaw = player.heading, fpPitch = 0), v === "third" && (cA() || K.mode === "free" || exitPointerLock(), cam.yaw = fpYaw + Math.PI), $2("crosshair").hidden = v !== "first" || mode !== "play", $2("btnView").innerHTML = (v === "first" ? "3rd person" : "1st person") + (touchy ? "" : '<kbd class="key">V</kbd>'), $2("btnView").setAttribute("aria-pressed", String(v === "first")), updateLockHint(), world && world.setTime(tod), resize();
}
function exitPointerLock() {
  document.pointerLockElement && (K.game = true, document.exitPointerLock?.());
}
var lockBlocked = false;
function updateLockHint() {
  $2("lockHint").hidden = !((view === "first" && K.mode === "drag" || cA()) && mode === "play" && !document.pointerLockElement && !touchy && !lockBlocked && !dialogOpen && !panelOpen && !mapOpen && $2("help").hidden);
}
function lockFailed() {
  performance.now() - K.softAt < 1500 || (lockBlocked || toast(K.mode === "lock" ? "Mouse capture is blocked here, so the mouse steers from the sides of the screen instead." : "Mouse capture is blocked here. Drag to look around and click to use things."), lockBlocked = true, updateLockHint());
}
function tryLock() {
  try {
    let r = canvas2.requestPointerLock?.();
    r && typeof r.catch == "function" && r.catch(lockFailed);
  } catch {
    lockFailed();
  }
}
document.addEventListener("pointerlockchange", updateLockHint);
var K = {
  mode: "drag", // the cursor is never captured: drag to look around, click to walk and use things
  auto: true,
  game: false,
  softAt: 0,
  over: false,
  mx: 0,
  my: 0,
  told: false,
  cur: ""
};
function cA() {
  return K.mode === "lock" && !touchy;
}
function sf() {
  return !touchy && (K.mode === "free" || K.mode === "lock" && lockBlocked);
}
function beginPlay() {
  if (!cA() || lockBlocked || document.pointerLockElement === canvas2) return;
  K.softAt = performance.now();
  let e = (t) => {
    t && (t.name === "SecurityError" || /sandbox/i.test(t.message || "")) && (K.softAt = 0, lockFailed());
  };
  try {
    let t = canvas2.requestPointerLock?.();
    t && typeof t.catch == "function" && t.catch(e);
  } catch (t) {
    e(t);
  }
}
function Ft() {
  K.auto && mode === "play" && !dialogOpen && !panelOpen && !mapOpen && !closing && !traveling && $2("help").hidden && beginPlay(), updateLockHint();
}
var rf = { lock: "Locked", free: "Free", drag: "Drag" };
function Tr() {
  let e = $2("btnMouse");
  e && (e.hidden = true); // there is only one mouse mode now, so the Mouse: switch is hidden
}
function Ra(e) {
  K.cur !== e && (K.cur = e, canvas2.style.cursor = e);
}
function nf(e) {
  if (!sf() || !K.over || mode !== "play" || dialogOpen || panelOpen || mapOpen || closing || traveling || busy) {
    Ra("");
    return;
  }
  let t = canvas2.getBoundingClientRect(), o = (K.mx - t.left) / Math.max(1, t.width) * 2 - 1, A = (K.my - t.top) / Math.max(1, t.height) * 2 - 1, a = (n, i) => {
    let l = Math.abs(n);
    return l <= i ? 0 : Math.sign(n) * Math.pow(Math.min(1, (l - i) / (1 - i)), 1.4);
  }, s = a(o, 0.34), r = a(A, 0.62);
  Ra(s < 0 ? "w-resize" : s > 0 ? "e-resize" : ""), view === "first" ? (fpYaw -= s * 2.3 * e, fpPitch = Math.max(-1.3, Math.min(1.3, fpPitch - r * 1.2 * e))) : (cam.yaw -= s * 2.3 * e, cam.pitch = Math.max(0.22, Math.min(1.35, cam.pitch + r * 0.7 * e)));
}
document.addEventListener("pointerlockchange", () => {
  document.pointerLockElement === canvas2 ? (K.auto = true, K.told || (K.told = true, toast("Your mouse steers now. Tab shows the cursor, Esc frees it."))) : (K.game || (K.auto = false), K.game = false);
}), canvas2.addEventListener("pointerleave", () => K.over = false), document.addEventListener("pointerlockerror", lockFailed);
var keys = /* @__PURE__ */ new Set();
window.addEventListener("keydown", (e) => {
  if (e.target?.tagName === "INPUT") return;
  let t = e.key.toLowerCase();
  if (t === "tab" && mode === "play" && cA() && !lockBlocked && !panelOpen && !mapOpen && !closing && !traveling) {
    e.preventDefault(), document.pointerLockElement ? exitPointerLock() : (K.auto = true, beginPlay()), updateLockHint();
    return;
  }
  if ((t === "h" || e.key === "?") && mode === "play" && !dialogOpen && !panelOpen && !mapOpen && !closing && !traveling) {
    e.preventDefault(), $2("btnHelp").click();
    return;
  }
  if (t === "shift" && keys.add("shift"), closing || traveling) {
    ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "e", "enter"].includes(t) && e.preventDefault();
    return;
  }
  if (mode === "play" && !dialogOpen) {
    if (t === "escape" && (panelOpen && !panelLocked || mapOpen)) {
      e.preventDefault(), panelLocked || closePanel(), closeMap();
      return;
    }
    if (panelOpen || mapOpen) {
      t === "m" && mapOpen && closeMap();
      return;
    }
    if ((t === "e" || t === "enter" || t === " ") && nearest && !seatScene) {
      e.preventDefault(), nearest.run();
      return;
    }
    if (t === "b") {
      openBooks();
      return;
    }
    if (t === "m") {
      openMap2();
      return;
    }
    if (t === "v") {
      Yo(view === "first" ? "third" : "first");
      return;
    }
  }
  ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(t) && (keys.add(t), e.preventDefault(), mode === "play" && !document.pointerLockElement && Ft());
}), window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase())), window.addEventListener("blur", () => keys.clear());
var pointers = /* @__PURE__ */ new Map(), dragged = false, markerT = 0;
canvas2.addEventListener("pointerdown", (e) => {
  if (document.pointerLockElement !== canvas2 && (canvas2.setPointerCapture(e.pointerId), pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }), dragged = false, pointers.size === 2)) {
    let [t, o] = [...pointers.values()];
    markerT = Math.hypot(t.x - o.x, t.y - o.y);
  }
}), canvas2.addEventListener("pointermove", (e) => {
  if (document.pointerLockElement === canvas2) {
    if (dialogOpen || panelOpen) return;
    view === "first" ? (fpYaw -= e.movementX * 24e-4, fpPitch = Math.max(-1.3, Math.min(1.3, fpPitch - e.movementY * 24e-4))) : mode === "play" && (cam.yaw -= e.movementX * 32e-4, cam.pitch = Math.max(0.22, Math.min(1.35, cam.pitch + e.movementY * 24e-4)));
    return;
  }
  e.pointerType === "mouse" && (K.mx = e.clientX, K.my = e.clientY, K.over = !e.buttons);
  let t = pointers.get(e.pointerId);
  if (!t) return;
  let o = e.clientX - t.x, A = e.clientY - t.y;
  if (t.x = e.clientX, t.y = e.clientY, pointers.size === 2) {
    let [a, s] = [...pointers.values()], r = Math.hypot(a.x - s.x, a.y - s.y);
    markerT && view === "third" && (cam.dist = clampDist(cam.dist * (markerT / r))), markerT = r, dragged = true;
    return;
  }
  Math.hypot(e.clientX - t.sx, e.clientY - t.sy) > 7 && (dragged = true), dragged && mode === "play" && (view === "first" ? (fpYaw -= o * 5e-3, fpPitch = Math.max(-1.3, Math.min(1.3, fpPitch - A * 4e-3))) : (cam.yaw -= o * 65e-4, cam.pitch = Math.max(0.22, Math.min(1.35, cam.pitch + A * 4e-3))));
}), canvas2.addEventListener("pointerup", (e) => {
  if (document.pointerLockElement === canvas2) {
    if (dialogOpen) {
      let o = document.getElementById("dlgOpts");
      e.button === 0 && (!o || o.hidden) && document.getElementById("dlgLine")?.click();
      return;
    }
    mode === "play" && e.button === 0 && clickCenter();
    return;
  }
  let t = pointers.get(e.pointerId);
  if (pointers.delete(e.pointerId), pointers.size < 2 && (markerT = 0), !(!t || dragged || mode !== "play" || e.button > 0)) {
    if ((view === "first" && K.mode === "drag" || cA()) && !touchy && !lockBlocked && !dialogOpen && !panelOpen) {
      K.auto = true, tryLock();
      return;
    }
    ff(e.clientX, e.clientY);
  }
}), canvas2.addEventListener("pointercancel", (e) => pointers.delete(e.pointerId)), canvas2.addEventListener("wheel", (e) => {
  e.preventDefault(), view === "third" && (cam.dist = clampDist(cam.dist * (1 + Math.sign(e.deltaY) * 0.1)));
}, { passive: false }), canvas2.addEventListener("contextmenu", (e) => e.preventDefault());
var clampDist = (d) => Math.max(3.5, Math.min(30, d)), ray = new THREE7.Raycaster(), ndc = new THREE7.Vector2();
function pickAt(nx, ny) {
  if (!world) return null;
  ndc.set(nx, ny), ray.setFromCamera(ndc, camera);
  let hits = ray.intersectObjects(world.clickables.filter((o) => o.visible !== false && o !== player?.hit), true), all = interactions();
  for (let h of hits.slice(0, 3)) {
    let o = h.object;
    for (; o; ) {
      let person = o.userData.person, it = all.find((i) => person && i.person === person || !person && i.mesh === o);
      if (it) return it;
      if (person) break;
      o = o.parent;
    }
  }
  return null;
}
function clickCenter() {
  if (!player || dialogOpen || panelOpen || busy || closing || traveling) return;
  let it = pickAt(0, 0);
  it ? goTo(it) : nearest && nearest.run();
}
function ff(cx, cy) {
  if (!world || !player || dialogOpen || panelOpen || busy || closing || traveling) return;
  let o = canvas2.getBoundingClientRect(), nx = (cx - o.left) / o.width * 2 - 1, ny = -((cy - o.top) / o.height) * 2 + 1, it = pickAt(nx, ny);
  if (it) {
    goTo(it);
    return;
  }
  let plane = new THREE7.Plane(new THREE7.Vector3(0, 1, 0), 0), pt = new THREE7.Vector3(), hit = false, solid = sceneryHit();
  if (solid) {
    let nav = world.nav, reach = nav.areaAt(nav.ci(player.x), nav.cj(player.z)), d = ray.ray.direction, hl2 = Math.hypot(d.x, d.z) || 1;
    for (let t = 0; t < 45; t += 0.25) {
      let x = solid.point.x - d.x / hl2 * t, z = solid.point.z - d.z / hl2 * t, i = nav.ci(x), j2 = nav.cj(z);
      if (nav.freeCell(i, j2) && (!reach || nav.areaAt(i, j2) === reach)) {
        pt.set(x, 0, z), hit = true;
        break;
      }
    }
  }
  if (hit || ray.ray.intersectPlane(plane, pt)) {
    pending = null;
    let u = Math.max(BOUNDS.x0 + 0.5, Math.min(BOUNDS.x1 - 0.5, pt.x)), f = Math.max(BOUNDS.z0 + 0.5, Math.min(BOUNDS.z1 - 0.5, pt.z)), r2 = path(player.root.position, { x: u, z: f });
    if (!r2) {
      marker(u, f, true);
      return;
    }
    let end = r2[r2.length - 1];
    player.speed = Math.hypot(end.x - player.x, end.z - player.z) > 14 ? RUN : WALK, player.walkTo(r2), marker(end.x, end.z);
  }
}
function sceneryHit() {
  if (!world) return null;
  for (let h of ray.intersectObjects(world.scene.children, true)) {
    let m = h.object;
    if (m.isPoints || m === markerMesh || m.material === world.skyMat || m.material?.visible === false) continue;
    let o = m, ok = true;
    for (; o; ) {
      if (!o.visible || o.userData.person) {
        ok = false;
        break;
      }
      o = o.parent;
    }
    if (ok) return h.point.y < 0.05 ? null : h;
  }
  return null;
}
var markerMesh = null, gA = 0;
function marker(x, z, blocked = false) {
  world && (markerMesh || (markerMesh = new THREE7.Mesh(new THREE7.RingGeometry(0.22, 0.32, 24).rotateX(-Math.PI / 2), new THREE7.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8, depthWrite: false }))), markerMesh.material.color.set(blocked ? "#ff7466" : "#ffffff"), world.scene.add(markerMesh), markerMesh.position.set(x, groundY(x, z) + 0.03, z), gA = 0.8);
}
window.addEventListener("pointerdown", or, true), window.addEventListener("keydown", or, true);
var Ur = () => `Sound: ${ar() ? "On" : "Off"}`;
$2("btnSound").textContent = Ur(), $2("btnSound").addEventListener("click", () => {
  Fl(!ar()), $2("btnSound").textContent = Ur(), ue("tap");
}), $2("prompt").addEventListener("click", () => {
  if (seatScene) return;
  !closing && !traveling && nearest?.run();
}), $2("btnBooks").addEventListener("click", () => openBooks()), $2("btnMap").addEventListener("click", () => openMap2()), $2("minimap").addEventListener("click", () => openMap2()), $2("btnView").addEventListener("click", () => Yo(view === "first" ? "third" : "first")), $2("btnHelp").addEventListener("click", () => {
  let e = $2("help");
  e.hidden = !e.hidden, e.hidden ? setTimeout(Ft, 0) : exitPointerLock(), $2("btnHelp").setAttribute("aria-expanded", String(!e.hidden)), $2("btnGfx").textContent = `Graphics: ${gfx === "high" ? "High" : "Fast"}`;
}), Tr(), $2("btnMouse")?.addEventListener("click", () => {
  K.mode = K.mode === "lock" ? "free" : K.mode === "free" ? "drag" : "lock", store.set("bizsim3d.mouselook", K.mode), Tr(), Ra(""), K.mode === "lock" ? (K.auto = true, $2("help").hidden = true, $2("btnHelp").setAttribute("aria-expanded", "false"), beginPlay()) : exitPointerLock(), updateLockHint();
});
for (let e of ["hud", "tasks"]) $2(e).addEventListener("click", () => setTimeout(Ft, 0));
$2("btnGfx").addEventListener("click", () => {
  gfx = gfx === "high" ? "fast" : "high", store.set(GFX_KEY, gfx), store.set(GFX_KEY + ".chosen", "1"), Qe.done = true, $2("btnGfx").textContent = `Graphics: ${gfx === "high" ? "High" : "Fast"}`, buildComposer();
}), $2("btnTitle").addEventListener("click", () => {
  mode !== "play" || dialogOpen || closing || (save(), closePanel(), state = null, showSetup());
}), $2("tasksToggle").addEventListener("click", () => {
  let e = $2("tasks");
  e.classList.toggle("min");
  let t = e.classList.contains("min");
  $2("tasksToggle").textContent = t ? "Show" : "Hide", $2("tasksToggle").setAttribute("aria-expanded", String(!t));
});
function openBooks() {
  state && mode === "play" && !dialogOpen && (exitPointerLock(), openPanel(`The books \xB7 ${monthName(state.month + 1)}`, booksHtml(state)));
}
var tags = /* @__PURE__ */ new Map(), v3 = new THREE7.Vector3();
function updateTags() {
  if (!world || mode !== "play" || !state || !player) {
    for (let s of tags.values()) s.hidden = true;
    return;
  }
  let seen = /* @__PURE__ */ new Set(), w = canvas2.clientWidth, h = canvas2.clientHeight, show = (p, html, cls, onClick) => {
    seen.add(p.id);
    let el = tags.get(p.id);
    el || (el = document.createElement("div"), el.className = "tag", el.addEventListener("click", () => el.go?.()), $2("labels").appendChild(el), tags.set(p.id, el)), el.go = onClick, el.dataset.html !== html && (el.innerHTML = html, el.dataset.html = html), el.className = `tag ${cls}`, v3.set(p.x, p.root.position.y + (p.sitting ? 1.55 : 2) * p.scale, p.z).project(camera);
    let vis = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    el.hidden = !vis || dialogOpen || traveling, vis && (el.style.transform = `translate(${(v3.x + 1) / 2 * w}px, ${(1 - v3.y) / 2 * h}px) translate(-50%, -100%)`);
  }, range = view === "first" ? 18 : 30;
  for (let npc of cast.values()) {
    let c2 = CAST[npc.id], d = Math.hypot(npc.p.x - player.x, npc.p.z - player.z), done = state.completedCards.length >= state.currentCards.length;
    npc.cards.length && state.currentCards[npc.cards[0]] ? d < 60 && show(npc.p, `<span class="bang">!</span>${c2.name}`, "", () => goToPerson(npc)) : npc.id === "accountant" && d < 40 ? show(npc.p, `${done ? '<span class="bang" style="background:var(--accent)">$</span>' : ""}Priya`, done ? "" : "quiet", () => goToPerson(npc)) : d < Math.min(range, 10) && show(npc.p, c2.name, "quiet", () => goTo(interFor(npc)));
  }
  for (let s of staff) Math.hypot(s.p.x - player.x, s.p.z - player.z) < 5 && show(s.p, s.name.split(" ")[0], "quiet", () => {
    let it = interactions().find((i) => i.person === s.p);
    it && goTo(it);
  });
  for (let [id, el] of tags) seen.has(id) || (el.hidden = true);
}
function cf(e) {
  if (!world) return;
  let t = world.nav;
  for (let o of people) {
    if (o.sitting || !o.path.length) continue;
    let A = o.path[0], a = A.x - o.x, s = A.z - o.z, r = Math.hypot(a, s);
    if (r < 0.05) continue;
    a /= r, s /= r;
    let n = 0, i = 0;
    for (let g of people) {
      if (g === o) continue;
      let c = g.x - o.x, v = g.z - o.z, m = c * c + v * v;
      if (m > 3.3 || m < 1e-6) continue;
      let P = Math.sqrt(m), h = c * a + v * s, w = -c * s + v * a;
      if (h > -0.2 && h < 1.6 && Math.abs(w) < 0.65) {
        let B = w >= 0 ? -1 : 1, C = (1 - Math.max(0, h) / 1.6) * (1 - Math.abs(w) / 0.65);
        n += -s * B * C, i += a * B * C;
      }
      P < 0.55 && (n -= c / P * (0.55 - P) * 3, i -= v / P * (0.55 - P) * 3);
    }
    if (!n && !i) continue;
    let l = o.speed * e * 0.9, u = o.x + n * l, f = o.z + i * l;
    t.isFree(u, f) && (o.root.position.x = u, o.root.position.z = f);
  }
  for (let o of people) o !== player && (o.root.visible = !(view === "first" && player && Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 0.7));
}
function occludedDist(target, yaw, pitch, dist) {
  if (!world || !player) return dist;
  let occ = insideShop(player.x, player.z) ? world.occluders : [...world.occluders, world.shopOccluder], dx = Math.sin(yaw) * Math.cos(pitch), dz = Math.cos(yaw) * Math.cos(pitch), dy = Math.sin(pitch);
  for (let i = 1; i <= 28; i++) {
    let t = i / 28 * dist, x = target.x + dx * t, z = target.z + dz * t, y = target.y + dy * t;
    for (let b of occ) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.h) return Math.max(2.2, t - 0.8);
  }
  return dist;
}
var Qe = { t0: 0, frames: 0, stage: 0, done: false };
function df() {
  if (store.get(GFX_KEY + ".chosen")) {
    Qe.done = true;
    return;
  }
  Qe.t0 = performance.now() + 2500, Qe.frames = 0, Qe.done = false;
}
function wf() {
  if (Qe.done || mode !== "play" || !Qe.t0 || document.hidden) return;
  let e = performance.now();
  if (e < Qe.t0) return;
  Qe.frames++;
  let t = (e - Qe.t0) / 1e3;
  if (t < 4) return;
  let o = Qe.frames / t;
  if (o >= 28) {
    Qe.done = true;
    return;
  }
  if (gfx === "high") gfx = "fast", store.set(GFX_KEY, gfx), buildComposer(), toast(`Switched to Fast graphics to keep things smooth (${Math.max(1, Math.round(o))} fps on High). You can change it in the ? menu.`);
  else {
    Qe.done = true;
    return;
  }
  Qe.stage++, Qe.t0 = e + 1500, Qe.frames = 0;
}
var clock = new THREE7.Clock(), MAX_DT = window.__maxDt ?? 0.05, fwd = new THREE7.Vector3(), curDist = PLAY_VIEW.dist, curPitch = PLAY_VIEW.pitch;
function frame() {
  requestAnimationFrame(frame);
  let e = performance.now();
  rr(e);
  let dt = Math.min(MAX_DT, clock.getDelta());
  if (!world) return;
  wf(), nf(dt), Tf(dt);
  let o = world;
  if (player && mode === "play") {
    let mx = 0, mz = 0;
    if (!dialogOpen && !panelOpen && !mapOpen && !busy && !seatScene && !traveling && ((keys.has("w") || keys.has("arrowup")) && (mz -= 1), (keys.has("s") || keys.has("arrowdown")) && (mz += 1), (keys.has("a") || keys.has("arrowleft")) && (mx -= 1), (keys.has("d") || keys.has("arrowright")) && (mx += 1)), mx || mz) {
      pending = null, player.stop();
      let len = Math.hypot(mx, mz), yaw = view === "first" ? fpYaw + Math.PI : cam.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw), dx = (mx * cy + mz * sy) / len, dz = (-mx * sy + mz * cy) / len, sp = keys.has("shift") ? RUN : WALK + 0.6, p = { x: player.x + dx * sp * dt, z: player.z + dz * sp * dt };
      collide(p, 0.28, o.colliders);
      for (let m of people) {
        if (m === player) continue;
        let ox = p.x - m.x, oz = p.z - m.z, d = Math.hypot(ox, oz);
        d < 0.52 && d > 1e-4 && (p.x = m.x + ox / d * 0.52, p.z = m.z + oz / d * 0.52);
      }
      let moved = Math.hypot(p.x - player.x, p.z - player.z);
      view === "first" ? player.setHeading(fpYaw) : player.face(p.x, p.z), player.root.position.x = p.x, player.root.position.z = p.z, player.animate(dt, moved / dt, groundY);
    } else if (player.update(dt, groundY, o.colliders), view === "first" && player.path.length) {
      let r = player.heading - fpYaw;
      r = Math.atan2(Math.sin(r), Math.cos(r)), fpYaw += r * Math.min(1, dt * 4);
    } else view === "first" && !talkPartner && player.setHeading(fpYaw);
    if (pending?.person) {
      let tp = pending.person;
      if (pending.x = tp.x, pending.z = tp.z, repathT -= dt, repathT <= 0 && Math.hypot(player.x - tp.x, player.z - tp.z) > pending.r * 0.85) {
        repathT = 0.6, player.speed = Math.hypot(player.x - tp.x, player.z - tp.z) > 4 ? RUN : WALK;
        let n = path(player.root.position, { x: tp.x, z: tp.z });
        n ? player.walkTo(n) : (pending = null, player.stop());
      }
    }
    if (pending && Math.hypot(player.x - pending.x, player.z - pending.z) <= pending.r * 0.85) {
      let it = pending;
      pending = null, player.stop(), it.run();
    } else pending && !player.path.length && (pending = null);
    if (busy) {
      if (busy.face && (player.face(busy.face.x, busy.face.z), view === "first")) {
        let want = Math.atan2(busy.face.x - player.x, busy.face.z - player.z);
        fpYaw += Math.atan2(Math.sin(want - fpYaw), Math.cos(want - fpYaw)) * Math.min(1, dt * 5);
      }
      if (player.work(), busy.t -= dt, busy.t <= 0) {
        let b = busy;
        busy = null, player.quiet(), b.done();
      }
    }
  }
  for (let a of people) a !== player && a.update(dt, groundY);
  if (cf(dt), Wl(), state && mode === "play" ? updateCustomers(dt) : mode === "setup" && updatePeds(dt), updateCars(dt), state && mode === "play") {
    let a = Math.min(1, (state.activeMs || 0) / ca), s = previewOwner ?? (closing ? 1 : 0.05 + Math.max(progress(), a) * 0.78);
    tod += (s - tod) * Math.min(1, dt * 0.6), o.setTime(tod);
  }
  if (mode === "play" && player && view === "first") {
    if (talkPartner) {
      let hx = talkPartner.x - player.x, hz = talkPartner.z - player.z, u = Math.atan2(hx, hz);
      fpYaw += Math.atan2(Math.sin(u - fpYaw), Math.cos(u - fpYaw)) * Math.min(1, dt * 5);
      let eyeT = talkPartner.root.position.y + (talkPartner.sitting ? 1.2 : 1.6) * talkPartner.scale, wantP = Math.atan2(eyeT - player.eyeHeight, Math.hypot(hx, hz));
      fpPitch += (wantP - fpPitch) * Math.min(1, dt * 5);
    }
    let eye = player.eyeHeight, lx = Math.sin(fpYaw) * Math.cos(fpPitch), lz = Math.cos(fpYaw) * Math.cos(fpPitch), ly = Math.sin(fpPitch);
    camera.position.set(player.x + Math.sin(fpYaw) * 0.12, eye, player.z + Math.cos(fpYaw) * 0.12), camera.lookAt(camera.position.x + lx, camera.position.y + ly, camera.position.z + lz), cam.target.set(player.x, 1, player.z);
  } else {
    if (mode === "play" && player) {
      cam.target.set(player.x, 1.1, player.z); // always dead centre: no easing, no side offset
    } else cam.orbit && (cam.yaw = 0.35 + Math.sin(performance.now() * 8e-5) * 0.55);
    let dist = cam.focus ? Math.min(cam.dist, cam.focusDist) : cam.dist, pitch = cam.focus ? Math.min(cam.pitch, 0.45) : cam.pitch;
    mode === "play" && (dist = occludedDist(cam.target, cam.yaw, pitch, dist)), curDist += (dist - curDist) * Math.min(1, dt * (dist < curDist ? 10 : 3)), curPitch += (pitch - curPitch) * Math.min(1, dt * 4), fwd.set(Math.sin(cam.yaw) * Math.cos(curPitch), Math.sin(curPitch), Math.cos(cam.yaw) * Math.cos(curPitch)), camera.position.copy(cam.target).addScaledVector(fwd, curDist), camera.lookAt(cam.target);
  }
  markerMesh && gA > 0 && (gA -= dt, markerMesh.material.opacity = Math.max(0, gA), markerMesh.scale.setScalar(1 + (0.8 - gA) * 0.6), gA <= 0 && markerMesh.removeFromParent());
  let pInside = !!player && mode === "play" && insideShop(player.x, player.z);
  o.update(dt, cam.target, camera.position, pInside, player ? player.root.position : cam.target), camera.updateMatrixWorld(), updatePrompt(), updateTags(), minimapT -= dt, minimapT <= 0 && (minimapT = 0.1, updateMinimap()), Ee && gfx === "high" ? Ee.render(dt) : renderer.render(o.scene, camera), zo.lastWork = performance.now() - e;
}
var minimapT = 0, previewOwner = null, PRESET_LOOKS = [
  ...OWNER_PRESETS.map((p) => ({ ...p.look, accessory: void 0, sleeves: "long", pants: "#2d3440" })),
  {
    skin: "#a86a45",
    hair: "long",
    hairColor: "#14100e",
    clothes: "#c25f7a",
    pants: "#1f2328",
    sleeves: "short",
    bottom: "pants"
  },
  {
    skin: "#f6d5b8",
    hair: "bun",
    hairColor: "#d1a866",
    clothes: "#2f6f7a",
    pants: "#5a5550",
    sleeves: "long",
    bottom: "skirt"
  },
  {
    skin: "#4f3122",
    hair: "bald",
    hairColor: "#14100e",
    clothes: "#d1c4a8",
    pants: "#3a3a3e",
    sleeves: "short"
  }
], sel = { business: "coffee", location: "average", look: { ...PRESET_LOOKS[0] }, name: "" };
try {
  let raw = JSON.parse(store.get(PREF_KEY) ?? "{}");
  Object.assign(sel, raw);
} catch {
}
BUSINESSES.some((e) => e.id === sel.business) || (sel.business = "coffee"), LOCATIONS.some((e) => e.id === sel.location) || (sel.location = "average");
var VA = null, portraits = [];
function renderPortraits() {
  if (portraits.length) return;
  let size = 160, rt2 = new THREE7.WebGLRenderTarget(size, size, { samples: 4 });
  rt2.texture.colorSpace = THREE7.SRGBColorSpace;
  let scene = new THREE7.Scene();
  scene.background = new THREE7.Color("#2a3642"), scene.add(new THREE7.HemisphereLight("#ffffff", "#55606a", 1.6));
  let key = new THREE7.DirectionalLight("#fff4e6", 2.4);
  key.position.set(1.5, 2.5, 3), scene.add(key);
  let cam2 = new THREE7.PerspectiveCamera(30, 1, 0.1, 20);
  cam2.position.set(0.25, 1.62, 1.55), cam2.lookAt(0, 1.52, 0);
  let buf = new Uint8Array(size * size * 4), cv = document.createElement("canvas");
  cv.width = cv.height = size;
  let g = cv.getContext("2d");
  for (let look of PRESET_LOOKS) {
    let p = new Person({ ...look, height: 1 });
    p.place(0, 0, 0.25), p.animate(0.016, 0, () => 0), scene.add(p.root), renderer.setRenderTarget(rt2), renderer.render(scene, cam2), renderer.readRenderTargetPixels(rt2, 0, 0, size, size, buf);
    let img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    g.putImageData(img, 0, 0), portraits.push(cv.toDataURL("image/png")), scene.remove(p.root);
  }
  renderer.setRenderTarget(null), rt2.dispose();
}
function showSetup() {
  mode = "setup", closing = false, busy = null, pending = null, cam.focus = null, cam.orbit = true, cam.pitch = 0.3, cam.dist = 9.5, cam.target.set(1.2, 1.7, 2.4), exitPointerLock();
  for (let id of ["hud", "tasks", "help", "prompt", "slate", "minimap", "crosshair", "lockHint"]) $2(id).hidden = true;
  closeMap(), view === "first" && (view = "third", resize()), rebuildPreview(), renderSetup();
}
function rebuildPreview() {
  buildWorld(sel.business, sel.location, sel.name || ""), player = null, placePreviewOwner(), world.setTime(0.3), world.setSeason(3);
  for (let i = 0; i < 8; i++) spawnPed(true);
}
function placePreviewOwner() {
  VA && removePerson(VA), VA = addPerson(new Person(sel.look)), VA.place(1.6, 2.5, 0.35);
}
function renderSetup() {
  renderPortraits();
  let el = $2("setup");
  el.innerHTML = setupHtml(sel, !!loadSave(), portraits, PRESET_LOOKS, { skins: SKINS, hairs: HAIRS, outfits: OUTFITS, styles: STYLES }), el.hidden = false;
  let persist = () => store.set(PREF_KEY, JSON.stringify(sel)), rerender = (rebuild) => {
    persist(), rebuild && rebuildPreview(), renderSetup();
  }, relook = () => {
    persist(), placePreviewOwner(), renderSetup();
  };
  el.querySelectorAll("[data-biz]").forEach((b) => b.addEventListener("click", () => {
    sel.business = b.dataset.biz, rerender(true);
  })), el.querySelectorAll("[data-loc]").forEach((b) => b.addEventListener("click", () => {
    sel.location = b.dataset.loc, rerender(true);
  })), el.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    sel.look = { ...PRESET_LOOKS[Number(b.dataset.preset)] }, relook();
  })), el.querySelectorAll("[data-skin]").forEach((b) => b.addEventListener("click", () => {
    sel.look = { ...sel.look, skin: b.dataset.skin }, relook();
  })), el.querySelectorAll("[data-hair]").forEach((b) => b.addEventListener("click", () => {
    sel.look = { ...sel.look, hair: b.dataset.hair }, relook();
  })), el.querySelectorAll("[data-haircolor]").forEach((b) => b.addEventListener("click", () => {
    sel.look = { ...sel.look, hairColor: b.dataset.haircolor }, relook();
  })), el.querySelectorAll("[data-outfit]").forEach((b) => b.addEventListener("click", () => {
    sel.look = {
      ...sel.look,
      clothes: b.dataset.outfit,
      pants: PANTS[OUTFITS.indexOf(b.dataset.outfit) % PANTS.length]
    }, relook();
  }));
  let nameIn = $2("ownerName"), startBtn = $2("startRun"), check = () => {
    let ok = nameIn.value.trim().length > 0;
    startBtn.disabled = !ok, $2("nameHint").hidden = ok;
  };
  check(), nameIn.addEventListener("input", check), nameIn.addEventListener("change", () => {
    sel.name = nameIn.value.trim(), persist(), world?.setShopName(shopNameFor(sel.business, sel.name));
  }), startBtn.addEventListener("click", () => {
    if (sel.name = nameIn.value.trim(), !sel.name) {
      nameIn.focus();
      return;
    }
    persist();
    let avatar = { skin: 0, hair: 0, hairColor: 0, look: { ...sel.look } };
    beginPlay(), ja(ki(sel.business, sel.location, sel.name, avatar), true);
  }), $2("continueRun")?.addEventListener("click", () => {
    let s = loadSave();
    s && (beginPlay(), ja(s, false));
  });
}
function ja(e, t) {
  let o = null;
  if (!t) {
    let a = Ki(e);
    a.monthsPassed > 0 && (o = a.state.awayRecap, e = { ...a.state, awayRecap: null });
  }
  state = e, o && (e.gameOver ? store.del(SAVE_KEY) : save()), $2("setup").hidden = true;
  let A = $2("fade");
  $2("fadeText").textContent = t ? "Opening day" : "Back to work", A.classList.add("on"), setTimeout(() => {
    mode = "play", seatScene = null, closeRequested = false, buildWorld(e.business, e.location, e.ownerName), VA = null, cam.orbit = false, cam.pitch = PLAY_VIEW.pitch, cam.dist = PLAY_VIEW.dist, cam.yaw = PLAY_VIEW.yaw, curDist = PLAY_VIEW.dist, curPitch = PLAY_VIEW.pitch, player = addPerson(new Person(ownerLook(e))), player.speed = WALK, player.place(0, 2.7, Math.PI), cam.target.set(0, 1, 2.7), curDist = cam.dist, curPitch = cam.pitch;
    for (let a = 0; a < pedCap() * 0.7; a++) spawnPed(true);
    if ($2("hud").hidden = false, $2("tasks").hidden = false, window.innerWidth < 640 && ($2("tasks").classList.add("min"), $2("tasksToggle").textContent = "Show", $2("tasksToggle").setAttribute("aria-expanded", "false")), $2("minimap").hidden = window.innerWidth < 700, Yo(view), df(), state.gameOver) {
      A.classList.remove("on"), o && toast(o), showEnd();
      return;
    }
    startMonth(true), o && openPanel("While you were away", ml(o)).querySelector("#awayGo")?.addEventListener("click", () => {
      ue("tap"), closePanel();
    }), t && setTimeout(() => {
      Sf() || ($2("help").hidden = false, $2("btnHelp").setAttribute("aria-expanded", "true"), $2("btnGfx").textContent = `Graphics: ${gfx === "high" ? "High" : "Fast"}`, setTimeout(() => $2("help").hidden = true, 14e3));
    }, 400), A.classList.remove("on"), canvas2.focus({ preventScroll: true });
  }, 650);
}
async function boot(data) {
  resize();
  try {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
  }
  $2("loading").hidden = true, frame();
  let hot2 = data;
  hot2?.state && !hot2.state.gameOver ? ja(hot2.state, false) : showSetup();
}
window.claude?.hot?.snapshot?.(() => ({ state: mode === "play" ? state : null })), window.__maxDt && (window.__bizsimDrs = zo, window.__bizsimMl = K, window.__bizsimView = () => ({ view, heading: fpYaw, look: fpPitch }), window.__bizsimSet = (e) => (state = { ...state, ...e }, Oe(state), applyWorldState(), state), window.__bizsimTut = () => ({ on: F.on, i: F.i, id: Bt[F.i]?.id }), window.__bizsimDrsTick = rr, window.__bizsimRenderer = renderer, window.__bizsim = {
  player: () => player,
  state: () => state,
  world: () => world,
  cam,
  camera,
  setView: Yo,
  travelTo,
  openMap: openMap2,
  cars: () => cars,
  gfx: () => gfx,
  soundsLoaded: Hl,
  walker: (e, t, o, A) => {
  let a = addPerson(new Person(randomLook()));
  return a.place(e, t, 0), a.speed = 1.3, a.walkTo([{ x: o, z: A }]), a;
},
  addActive: (e) => {
  state && (state.activeMs = (state.activeMs || 0) + e);
},
  tod: (e) => {
  previewOwner = e;
}
});
var hot = window.claude?.hot;
hot?.ready ? hot.ready((d) => boot(d)) : boot(hot?.data ?? null);
var ZA = [["D", 0], ["C", 6e4], ["B", 16e4], ["A", 4e5], ["S", 7e5]], $A = 4, _A = 3, Wr = { restaurant: 1, coffee: 1, bakery: 1 };
function Vr(e) {
  let t = Math.abs(e), o = e < 0 ? "-" : "", A = (a) => a.replace(/\.0$/, "");
  return t >= 1e6 ? `${o}$${A((t / 1e6).toFixed(t >= 1e7 ? 0 : 1))}M` : t >= 1e4 ? `${o}$${A((t / 1e3).toFixed(t >= 1e5 ? 0 : 1))}k` : money(e);
}
function Zr(e) {
  for (let [t, o] of ZA) if (e < o) return { grade: t, at: o };
  return null;
}
function mf(e) {
  let t = 0;
  for (let [, o] of ZA) e >= o && (t = o);
  return t;
}
function $r(e) {
  return `<div class="g-ladder">${ZA.map(([t, o]) => `<div class="${t === e ? "you" : ""}"><b>${t}</b><small>${o ? Vr(o) + "+" : "start"}</small>${t === "S" ? "<em>franchise material</em>" : t === e ? "<em>you are here</em>" : ""}</div>`).join("")}</div>`;
}
function Pf(e) {
  let t = $2("bizValue"), o = $2("bizGrade");
  if (!t || !o || !e) return;
  let A = scoreGame(e);
  t.textContent = Vr(A.valuation), o.textContent = A.grade, o.dataset.g = A.grade;
}
var Jt = { open: false };
function Df() {
  let e = state, t = businessOf(e.business), o = scoreGame(e), A = Zr(o.valuation), a = mf(o.valuation), s = A ? Math.max(3, Math.min(100, (o.valuation - a) / (A.at - a) * 100)) : 100, r = Math.round(t.renovationCost * e.macro.cpi), n = Math.round(t.productLineCost * e.macro.cpi), i = !!Wr[e.business], l = e.storeTier >= MAX_STORE_TIER ? null : e.storeTier + 1, u = e.renovationMonthsLeft > 0 ? `Under construction: ${e.renovationMonthsLeft} month${e.renovationMonthsLeft > 1 ? "s" : ""} to go` : l ? e.cash < r ? `Need ${money(r)} cash` : e.ap < $A ? `Need ${$A} AP (work the shop to earn AP)` : "" : "Fully renovated", f = e.productLines >= MAX_PRODUCT_LINES ? "Menu is full" : e.cash < n ? `Need ${money(n)} cash` : e.ap < _A ? `Need ${_A} AP (work the shop to earn AP)` : "", g = (MARKETING_TIERS.find((h) => h.id === e.marketingTier) || {}).name || "None", c = l === 2 ? i ? "an outdoor patio with tables your customers will use" : "outdoor benches and planters" : l === 3 ? "more outdoor seating, planters and string lights" : "", v = Math.round(TIER_CAPACITY_MULT[e.storeTier - 1] * 100), m = l ? Math.round(TIER_CAPACITY_MULT[l - 1] * 100) : 0, P = e.milestones || [];
  return `
  <div class="g-head">
    <div class="g-val"><span class="lbl">Business value</span><b class="num">${money(o.valuation)}</b><span class="gchip" data-g="${o.grade}">${o.grade}</span></div>
    <span class="meter g-meter"><i style="width:${s.toFixed(0)}%"></i></span>
    <p class="note">${A ? `Next: <b>grade ${A.grade}</b> at ${money(A.at)}.` : "Top grade reached. Investors are calling."} Your value grows with <b>monthly profit</b> (boosted by <b>reputation</b>), plus cash, shop size and loyal regulars, minus loans.</p>
    ${$r(o.grade)}
  </div>
  <h3 class="sec-h">Ways to grow</h3>
  <div class="g-rows">
    <div class="g-row"><div><b>Bigger shop</b> <span class="pill">Tier ${e.storeTier} of ${MAX_STORE_TIER}</span>
      <small>${l ? `Room for ${Math.round((m / v - 1) * 100)}% more customers, plus ${c}. ${money(r)} + ${$A} AP, about two months of work.` : "Your shop is as big as it gets on this street."}</small></div>
      <button class="primary g-btn" id="gReno" type="button" ${u ? "disabled" : ""}>Renovate</button>${u ? `<em>${esc(u)}</em>` : ""}</div>
    <div class="g-row"><div><b>New menu item</b> <span class="pill">${e.productLines} of ${MAX_PRODUCT_LINES}</span>
      <small>Every sale earns about 6% more and regulars get excited. It shows up on your menu board with a star. ${money(n)} + ${_A} AP.</small></div>
      <button class="primary g-btn" id="gMenu" type="button" ${f ? "disabled" : ""}>Launch</button>${f ? `<em>${esc(f)}</em>` : ""}</div>
    <div class="g-row"><div><b>Advertising</b> <span class="pill">Now: ${esc(g)}</span>
      <small>More people walk in. Signs and banners go up outside your shop. ${ADS_AP} AP to book, plus a monthly cost.</small></div>
      <button class="secondary g-btn" id="gAds" type="button">Book ads</button></div>
    <div class="g-row"><div><b>Bank loan</b> <span class="pill">Owed: ${money(e.loan)}</span>
      <small>Borrow to grow faster, then pay it down. Loans lower your value until they're repaid. ${LOAN_AP} AP to borrow.</small></div>
      <button class="secondary g-btn" id="gBank" type="button">Visit the bank</button></div>
    <div class="g-row"><div><b>Reputation</b> <span class="pill">${Math.round(e.reputation)} / 100</span>
      <small>Good decisions, a clean shop and happy staff raise it. Higher reputation brings more customers and multiplies your value.</small></div>
      <span class="meter g-meter small"><i style="width:${Math.round(e.reputation)}%"></i></span></div>
  </div>
  <h3 class="sec-h">Milestones <span class="g-sub">+1 AP each</span></h3>
  <ul class="g-ms">${Ja.map((h) => `<li class="${P.includes(h.id) ? "done" : ""}"><i></i>${esc(h.label)}</li>`).join("")}</ul>
  <p class="note">Coming later: franchise into one of the empty storefronts on your street.</p>`;
}
function No() {
  if (!state || !world || mode !== "play" || dialogOpen || closing || traveling) return;
  exitPointerLock(), mapOpen && closeMap();
  let e = () => {
    let t = openPanel("Grow your business", Df(), () => {
      Jt.open = false;
    });
    Jt.open = true, t.classList.add("g-panel"), t.querySelector("#gReno")?.addEventListener("click", () => {
      let o = renovate(state);
      o === state || state.ap < $A || (state = { ...o, ap: state.ap - $A }, toast("Renovation started. Two months of dust, then a bigger shop.", "good"), ue("cash"), Oe(state), save(), applyWorldState(), e());
    }), t.querySelector("#gMenu")?.addEventListener("click", () => {
      let o = launchProductLine(state);
      o === state || state.ap < _A || (state = { ...o, ap: state.ap - _A }, toast("New item on the menu. Look for the star on your menu board.", "good"), ue("cash"), Oe(state), save(), applyWorldState(), e());
    }), t.querySelector("#gAds")?.addEventListener("click", () => {
      Jt.open = false, openAds();
    }), t.querySelector("#gBank")?.addEventListener("click", () => {
      Jt.open = false, openBank();
    });
  };
  e();
}
var Ja = [
  {
    id: "profit",
    label: "Turn a profit for a month",
    test: (e) => e.history.some((t) => t.profit > 0)
  },
  { id: "menu", label: "Add a new menu item", test: (e) => e.productLines >= 1 },
  { id: "ads", label: "Run your first ad", test: (e) => e.marketingTier !== "none" },
  { id: "rep65", label: "Reach 65 reputation", test: (e) => e.reputation >= 65 },
  { id: "tier2", label: "Open your patio (shop tier 2)", test: (e) => e.storeTier >= 2 },
  {
    id: "gradeC",
    label: "Business worth $60k (grade C)",
    test: (e) => scoreGame(e).valuation >= 6e4
  },
  {
    id: "gradeB",
    label: "Business worth $160k (grade B)",
    test: (e) => scoreGame(e).valuation >= 16e4
  },
  { id: "tier3", label: "Full renovation (shop tier 3)", test: (e) => e.storeTier >= 3 },
  {
    id: "gradeA",
    label: "Business worth $400k (grade A)",
    test: (e) => scoreGame(e).valuation >= 4e5
  },
  {
    id: "gradeS",
    label: "Franchise material (grade S, $700k)",
    test: (e) => scoreGame(e).valuation >= 7e5
  }
];
function Cf() {
  if (!state || mode !== "play" || closing || state.gameOver) return;
  let e = state.milestones || [], t = Ja.filter((o) => !e.includes(o.id) && o.test(state));
  if (t.length) {
    state = {
      ...state,
      milestones: [...e, ...t.map((o) => o.id)],
      ap: Math.min(AP_CAP, state.ap + t.length)
    };
    for (let o of t) toast(`Milestone: ${o.label} \xB7 +1 AP`, "good");
    ue("good"), Oe(state), save(), Jt.open && $2("panel")?.querySelector(".g-ms") && ($2("panel").querySelector(".g-ms").outerHTML = `<ul class="g-ms">${Ja.map((o) => `<li class="${(state.milestones || []).includes(o.id) ? "done" : ""}"><i></i>${esc(o.label)}</li>`).join("")}</ul>`);
  }
}
var be = { month: null, value: null, grade: null, pending: null };
function Qf() {
  if (state) {
    if (be.month === null || state.month < be.month) {
      let e = scoreGame(state);
      be.month = state.month, be.value = e.valuation, be.grade = e.grade;
      return;
    }
    if (state.month > be.month) {
      let e = scoreGame(state);
      be.pending = {
        value: e.valuation,
        delta: e.valuation - be.value,
        grade: e.grade,
        up: ZA.findIndex((t) => t[0] === e.grade) > ZA.findIndex((t) => t[0] === be.grade)
      }, be.month = state.month, be.value = e.valuation, be.grade = e.grade;
    } else if (!closing) {
      let e = scoreGame(state);
      be.value = e.valuation, be.grade = e.grade;
    }
    if (be.pending && mode === "play" && !closing && !panelOpen && !dialogOpen && !traveling) {
      let e = be.pending;
      be.pending = null, toast(`Business value ${money(e.value)} (${e.delta >= 0 ? "up" : "down"} ${money(Math.abs(e.delta))} this month)`, e.delta >= 0 ? "good" : "bad"), e.up && (toast(`Grade up! You're running a grade ${e.grade} business now.`, "good"), ue("good"));
    }
  }
}
var Me = { world: null, tier: 0, adsKey: "", adsGroup: null };
function _r(e, t, o, A, a) {
  let s = mat("#6b4a33", 0.7), r = mat("#2f3236", 0.5, 0.4), n = new THREE7.Group();
  n.position.set(o, 0, A), n.rotation.y = a, t.add(n), e.box(0.4, 0.05, 0.4, s, 0, 0.42, 0, n), e.box(0.4, 0.42, 0.05, s, 0, 0.47, -0.18, n), e.cyl(0.025, 0.03, 0.42, r, 0, 0, 0, n, 8);
}
function bf(e, t, o, A) {
  let a = mat("#2f3236", 0.5, 0.4), s = mat("#efe9dc", 0.45);
  e.cyl(0.04, 0.05, 0.72, a, o, 0, A, t, 10), e.cyl(0.32, 0.32, 0.04, s, o, 0.72, A, t, 22), e.cyl(0.22, 0.22, 0.03, a, o, 0, A, t, 16);
  let r = e.cyl(0.035, 0.03, 0.08, mat("#f7f3ea", 0.4), o + 0.1, 0.76, A - 0.04, t, 10);
  r.castShadow = false;
}
function Ef(e, t, o, A) {
  let a = mat("#7a5636", 0.7), s = mat("#2f3236", 0.5, 0.4);
  e.box(1.4, 0.07, 0.42, a, o, 0.42, A, t), e.box(1.4, 0.36, 0.06, a, o, 0.5, A - 0.2, t);
  for (let r of [-0.6, 0.6]) e.box(0.06, 0.42, 0.38, s, o + r, 0, A, t);
}
function en(e, t, o, A, a = 0.9) {
  e.box(a, 0.42, 0.42, mat("#3d4a3c", 0.8), o, 0, A, t);
  let s = mat("#4f8a3c", 0.8), r = [mat("#e86a5a", 0.6), mat("#f2c14e", 0.6), mat("#f4f1ea", 0.6)];
  for (let n = 0; n < 4; n++) {
    let i = o - a / 2 + 0.14 + n * (a - 0.28) / 3, l = new THREE7.Mesh(new THREE7.IcosahedronGeometry(0.16, 0), s);
    l.position.set(i, 0.52, A), l.scale.set(1, 0.8, 1), l.castShadow = true, t.add(l);
    let u = new THREE7.Mesh(new THREE7.SphereGeometry(0.06, 8, 6), r[n % 3]);
    u.position.set(i + 0.05, 0.66, A + 0.06), t.add(u);
  }
}
function Mf(e, t) {
  let o = new THREE7.MeshStandardMaterial({ color: "#fff2c4", emissive: "#ffd36b", emissiveIntensity: 1.6, roughness: 0.4 }), A = mat("#222222", 0.6);
  for (let a = 0; a <= 26; a++) {
    let s = a / 26, r = -6.6 + s * 13.2, n = 2.42 - Math.abs(Math.sin(s * Math.PI * 2)) * 0.22, i = new THREE7.Mesh(new THREE7.SphereGeometry(0.05, 8, 6), o);
    if (i.position.set(r, n, 1.95), i.castShadow = false, t.add(i), a < 26) {
      let l = -6.6 + (a + 1) / 26 * 13.2, u = 2.42 - Math.abs(Math.sin((a + 1) / 26 * Math.PI * 2)) * 0.22, f = Math.hypot(l - r, u - n), g = new THREE7.Mesh(new THREE7.BoxGeometry(f, 0.012, 0.012), A);
      g.position.set((r + l) / 2, (n + u) / 2 + 0.05, 1.95), g.rotation.z = Math.atan2(u - n, l - r), g.castShadow = false, t.add(g);
    }
  }
}
function yf(e, t, o) {
  let A = !!Wr[o], a = t >= 3 ? [-4.4, -2.6, 2.6, 4.4] : [-4.4, 4.4], s = new THREE7.Group();
  Me.patio && (Me.patio.removeFromParent(), Me.patio = null), e.scene.add(s);
  for (let r of a) A ? (bf(e, s, r, 1.45), _r(e, s, r - 0.55, 1.45, Math.PI / 2), _r(e, s, r + 0.55, 1.45, -Math.PI / 2)) : Ef(e, s, r, 1.38);
  t >= 3 && (en(e, s, -5.85, 1.35, 0.7), en(e, s, 5.85, 1.35, 0.7), Mf(e, s)), batch(s), Me.patio = s;
  for (let r of a) {
    if (Me.seated.has(r)) continue;
    Me.seated.add(r);
    let n = A ? { x0: r - 0.85, z0: 1.12, x1: r + 0.85, z1: 1.72 } : { x0: r - 0.72, z0: 1.12, x1: r + 0.72, z1: 1.62 };
    if (e.colliders.push(n), e.nav?.addBox?.(n, 0.15), A) for (let [i, l] of [[r - 0.55, Math.PI / 2], [r + 0.55, -Math.PI / 2]]) e.seats.push({ x: i, z: 1.45, h: l, y: 0.45, sit: true, taken: false, approach: { x: i, z: 2.05 } });
    else for (let i of [r - 0.35, r + 0.35]) e.seats.push({ x: i, z: 1.4, h: 0, y: 0.45, sit: true, taken: false, approach: { x: i, z: 2.05 } });
  }
}
function xf(e, t, o) {
  if (Me.adsGroup && (Me.adsGroup.removeFromParent(), Me.adsGroup = null), !t || t === "none") return;
  let A = new THREE7.Group();
  e.scene.add(A), Me.adsGroup = A;
  let a = {
    coffee: ["FRESH", "coffee + pastries"],
    bakery: ["FRESH", "baked every morning"],
    restaurant: ["TONIGHT", "chef's specials"],
    convenience: ["OPEN", "late every day"],
    barber: ["WALK-INS", "welcome today"]
  }[o] || ["OPEN", "come on in"], s = mat("#3a2a1e", 0.7), r = new THREE7.MeshStandardMaterial({ map: paperTexture(a[0], a[1]), roughness: 0.85 }), n = new THREE7.Group();
  n.position.set(-1.45, 0, 1.5), n.rotation.y = 0.35, A.add(n);
  for (let i of [1, -1]) {
    let l = new THREE7.Group();
    l.rotation.x = i * 0.16, l.position.z = i * 0.07, n.add(l), e.box(0.62, 0.95, 0.04, s, 0, 0, 0, l);
    let u = new THREE7.Mesh(new THREE7.PlaneGeometry(0.52, 0.72), r);
    u.position.set(0, 0.52, i * 0.025), i < 0 && (u.rotation.y = Math.PI), l.add(u);
  }
  if (t === "campaign") {
    let i = new THREE7.MeshStandardMaterial({ map: paperTexture(a[0], a[1]), roughness: 0.9 }), l = mat("#2f3236", 0.5, 0.4);
    for (let u of [-6.78, 6.78]) {
      let f = new THREE7.Mesh(new THREE7.PlaneGeometry(0.5, 1.05), i);
      f.position.set(u, 1.75, 1.13), A.add(f), e.box(0.6, 0.03, 0.05, l, u, 2.28, 1.12, A, false);
    }
  }
}
function kf() {
  if (!world || !state) return;
  Me.world !== world && (Me = {
    world,
    tier: 1,
    adsKey: "",
    adsGroup: null,
    patio: null,
    seated: /* @__PURE__ */ new Set()
  });
  let e = state.storeTier || 1;
  e !== Me.tier && (e >= 2 && yf(world, e, state.business), Me.tier = e);
  let t = `${state.marketingTier}|${state.business}`;
  t !== Me.adsKey && (xf(world, state.marketingTier, state.business), Me.adsKey = t);
}
var tn = "bizsim3d.tutorial", F = { on: false, i: 0, snap: null, phase: 0, beacon: null, t: 0, wait: 0 };
function If() {
  try {
    return !!localStorage.getItem(tn);
  } catch {
    return false;
  }
}
function zf(e) {
  try {
    localStorage.setItem(tn, e);
  } catch {
  }
}
function Ka() {
  if (!state) return null;
  for (let e = 0; e < state.currentCards.length; e++) {
    if (state.completedCards.includes(e)) continue;
    let t = state.currentCards[e].speaker, o = t === "narrator" ? "manager" : t, A = cast.get(o);
    if (A) return { id: o, name: CAST[o]?.name ?? "them", p: A.p };
  }
  return null;
}
function Hf() {
  let e = typeof K < "u" ? K.mode : "drag";
  return e === "lock" ? "Move the mouse to look around" : e === "free" ? "Push the mouse toward the sides of the screen to turn" : "Drag with the mouse to look around";
}
var Bt = [
  {
    id: "welcome",
    welcome: true,
    title: () => `Welcome to your ${businessOf(state.business).name.toLowerCase()}`,
    body: () => {
  let e = scoreGame(state);
  return `<p>You have <b>${money(state.cash)}</b>, an empty shop and <b>${state.maxMonths} months</b>. Your goal: make it <b>the most valuable business on the street</b>.</p>
      ${$r(e.grade)}
      <p class="c-loop"><span>1 \xB7 Handle the people who need you</span><span>2 \xB7 Work the shop to earn AP</span><span>3 \xB7 Spend on growth</span><span>4 \xB7 Close the month, watch your value climb</span></p>`;
},
    done: () => false
  },
  {
    id: "move",
    title: () => "Get your bearings",
    body: () => `<p>${Hf()}, and walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>. Hold <kbd>Shift</kbd> to run.</p>`,
    done: (e) => player && Math.hypot(player.x - e.x, player.z - e.z) > 3
  },
  {
    id: "talk",
    title: () => "Someone needs you",
    body: () => {
  let e = Ka();
  return e ? `<p>People with an orange <b>!</b> need a decision from you. Walk up to <b>${esc(e.name)}</b> (follow the arrow) and press <kbd>E</kbd>.</p>` : "<p>Walk up to anyone with an orange <b>!</b> and press <kbd>E</kbd>.</p>";
},
    target: () => Ka()?.p ?? null,
    skipIf: () => !Ka() && !dialogOpen && state.completedCards.length === F.base.completed,
    done: () => dialogOpen || state.completedCards.length > F.base.completed
  },
  {
    id: "decide",
    title: () => "Make the call",
    body: () => "<p>Press <kbd>Space</kbd> to hear them out, then pick an answer with <kbd>1</kbd>\u2013<kbd>3</kbd>. Choices move your <b>cash</b>, <b>reputation</b> and <b>team</b>. There's rarely a perfect answer.</p>",
    done: () => state.completedCards.length > F.base.completed && !dialogOpen,
    retreat: () => !dialogOpen && state.completedCards.length === F.base.completed
  },
  {
    id: "work",
    title: () => "Work the shop, earn AP",
    skippable: true,
    body: () => "<p>Head inside to the <b>register</b> (follow the arrow) and press <kbd>E</kbd> to work a shift. Work earns <b>Action Points (AP)</b>, shown up top. You spend AP to grow: ads, loans, renovations and new menu items. Work costs energy, so take breaks.</p>",
    target: () => world?.anchors?.register ? { x: world.anchors.register.x, z: world.anchors.register.z, y: 1.1 } : null,
    done: () => F.worked || state.month > F.base.month
  },
  {
    id: "books",
    title: () => "Know your numbers",
    skippable: true,
    body: () => "<p>Press <kbd>B</kbd> to open your books: customers, sales, costs and profit. Close them when you're done.</p>",
    done: () => F.sawBooks && !panelOpen
  },
  {
    id: "grow",
    title: () => "Plan your growth",
    body: () => "<p>Press <kbd>G</kbd> (or the Grow button) to see your growth plan: your business value, what each upgrade does and what it costs. Upgrades show up on your street: a patio, signs, banners and more customers.</p>",
    done: () => F.sawGrow && !panelOpen
  },
  // "Meet your mentor": done once the player has asked the mentor something and closed its panel.
  // If the mentor script failed to start, the step passes by itself so nobody gets stuck.
  (() => {
    let baseline = null;
    return {
      id: "mentor",
      title: () => "Meet your mentor",
      body: () => '<p>Stuck at any point? <b>Mentor</b> reads your numbers and tells you what to do next. Open it, ask <b>What should I do?</b>, then close it to continue. <button type="button" class="primary" data-mentor-open>Open the mentor</button></p>',
      done: () => {
        const m = window.__bizsimMentor;
        if (!m || !m.ready) { baseline = null; return true; }
        if (baseline === null) baseline = m.uses;
        if (m.uses > baseline && !m.open) { baseline = null; return true; }
        return false;
      }
    };
  })(),
  {
    id: "close",
    title: () => "Close the month",
    body: () => {
  let e = state.currentCards.length - state.completedCards.length;
  return `<p>${e ? `Handle the ${e} ${e === 1 ? "person" : "people"} left on your list, then see` : "Everyone's handled. See"} <b>Priya</b> in the office (follow the arrow) to close the month. You'll see your profit and your new business value.</p>`;
},
    target: () => cast.get("accountant")?.p ?? null,
    done: () => state.month > F.base.month
  },
  {
    id: "finish",
    final: true,
    title: () => "You've got the hang of it",
    body: () => {
  let e = scoreGame(state), t = Zr(e.valuation);
  return `<p>Your business is worth <b>${money(e.valuation)}</b> (grade <b>${e.grade}</b>).${t ? ` Reach ${money(t.at)} for grade ${t.grade}.` : ""} Repeat the loop each month, chase the milestones in <kbd>G</kbd>, and aim for an <b>A</b>. Stuck any time? Tap <b>Mentor</b>. You can replay this tutorial from the <b>?</b> menu.</p>`;
},
    done: () => false
  }
];
function Jo() {
  return {
    x: player ? player.x : 0,
    z: player ? player.z : 0,
    ap: state.ap,
    acts: state.activitiesDone?.length ?? 0,
    completed: state.completedCards.length,
    month: state.month,
    seen: false
  };
}
function An() {
  !state || !world || (F.on = true, F.i = 0, F.snap = Jo(), F.base = Jo(), F.worked = false, F.sawBooks = false, F.sawGrow = false, F.acts = state.activitiesDone?.length ?? 0, F.wait = 0, $2("slate").hidden = true, $2("help").hidden = true, $2("btnHelp").setAttribute("aria-expanded", "false"), Wa(), exitPointerLock(), ue("tap"));
}
function qa(e = "done") {
  F.on = false, zf(e), $2("coach").hidden = true, $2("coach").className = "", Va(null), Ft?.();
}
function Ko() {
  if (!F.on) return;
  let e = Bt[F.i];
  if (e.final) return qa("done");
  for (F.i++; F.i < Bt.length - 1 && Bt[F.i].skipIf?.(); ) F.i++;
  F.snap = Jo(), Wa(), e.welcome && Ft?.(), F.i > 1 && ue("good", 0.35);
}
function Wa() {
  let e = Bt[F.i], t = $2("coach"), o = Bt.length - 2;
  !e || !t || (t.className = e.welcome ? "welcome" : e.final ? "final" : "", $2("slate").hidden = true, t.innerHTML = `<div class="c-top"><span>${e.welcome ? "BizSim \xB7 how to play" : e.final ? "Tutorial complete" : `Step ${F.i} of ${o}`}</span><button type="button" class="c-skip" id="coachSkip">${e.final ? "Close" : "Skip tutorial"}</button></div>
    <h4>${esc(e.title())}</h4>${e.body()}
    ${e.welcome ? '<div class="c-row"><button type="button" class="primary" id="coachGo">Show me how <kbd>Space</kbd></button></div>' : e.final ? `<div class="c-row"><button type="button" class="primary" id="coachGo">Let's go <kbd>Space</kbd></button><button type="button" class="secondary" id="coachGrow">Open my growth plan</button></div>` : e.skippable ? '<div class="c-row"><button type="button" class="c-skip" id="coachStep">Skip this step</button></div>' : ""}`, t.hidden = false, $2("coachSkip").onclick = () => qa(e.final ? "done" : "skipped"), $2("coachGo") && ($2("coachGo").onclick = () => Ko()), $2("coachStep") && ($2("coachStep").onclick = () => Ko()), $2("coachGrow") && ($2("coachGrow").onclick = () => {
    qa("done"), No();
  }));
}
function Va(e) {
  if (!e || !world) {
    F.beacon && (F.beacon.removeFromParent(), F.beacon = null);
    return;
  }
  if (!F.beacon || F.beacon.parent !== world.scene) {
    let n = new THREE7.Group(), i = new THREE7.MeshBasicMaterial({ color: "#ff8a3d", transparent: true, opacity: 0.95, depthTest: false }), l = new THREE7.Mesh(new THREE7.ConeGeometry(0.16, 0.34, 18), i);
    l.rotation.x = Math.PI, l.renderOrder = 10, n.add(l);
    let u = new THREE7.Mesh(new THREE7.RingGeometry(0.42, 0.52, 32), new THREE7.MeshBasicMaterial({
      color: "#ff8a3d",
      transparent: true,
      opacity: 0.6,
      side: THREE7.DoubleSide,
      depthWrite: false
    }));
    u.rotation.x = -Math.PI / 2, u.name = "ring", n.add(u), world.scene.add(n), F.beacon = n;
  }
  let t = F.beacon, o = e.root !== void 0, A = e.x, a = e.z, s = o ? e.root.position.y + (e.sitting ? 1.75 : 2.25) * (e.scale || 1) : e.y ?? 1.2;
  t.position.set(A, 0, a), t.children[0].position.y = s + 0.28 + Math.sin(F.t * 4) * 0.08;
  let r = t.getObjectByName("ring");
  r.position.y = 0.03, r.scale.setScalar(1 + F.t * 1.2 % 1 * 0.35), r.material.opacity = 0.6 * (1 - F.t * 1.2 % 1);
}
function Ff(e) {
  if (!F.on) return;
  F.t += e;
  let t = Bt[F.i], o = $2("coach"), A = state.activitiesDone?.length ?? 0;
  if (A > F.acts && (F.worked = true), F.acts = A, panelOpen && !F.sawBooks && /^The books/.test($2("panel")?.querySelector("h2")?.textContent || "") && (F.sawBooks = true), Jt.open && (F.sawGrow = true), mode !== "play") {
    o.hidden = true, Va(null);
    return;
  }
  if (o.hidden = false, Va(t.target ? t.target() : null), F.wait -= e, F.wait <= 0 && (F.wait = 0.5, !t.welcome && !t.final && Lf()), t.done(F.snap)) return Ko();
  t.retreat && t.retreat() && (F.i--, F.snap = Jo(), Wa());
}
function Lf() {
  let e = Bt[F.i], t = $2("coach"), o = t?.querySelector("h4");
  if (!o) return;
  let A = e.body();
  if (t.dataset.body === A) return;
  t.dataset.body = A;
  let s = o.nextElementSibling;
  s && s.tagName === "P" && (s.outerHTML = A);
}
function Tf(e) {
  Ff(e), Za.t -= e, Za.t <= 0 && (Za.t = 0.5, kf(), Cf(), Qf());
}
var Za = { t: 0 };
function Sf() {
  return If() ? false : (An(), true);
}
window.addEventListener("keydown", (e) => {
  if (e.target?.tagName === "INPUT" || mode !== "play") return;
  let t = e.key.toLowerCase(), o = F.on ? Bt[F.i] : null;
  if (o && (o.welcome || o.final) && (t === " " || t === "enter")) {
    e.preventDefault(), e.stopPropagation(), Ko();
    return;
  }
  t === "g" && !dialogOpen && !closing && !traveling && (e.preventDefault(), e.stopPropagation(), Jt.open && panelOpen ? closePanel() : !panelOpen && No());
}, true), $2("btnGrow")?.addEventListener("click", () => No()), $2("valueCell")?.addEventListener("click", () => No()), $2("btnTutorial")?.addEventListener("click", () => {
  $2("help").hidden = true, $2("btnHelp").setAttribute("aria-expanded", "false"), An();
});
