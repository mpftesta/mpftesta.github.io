(function () {
      "use strict";

      var vrDisplay = null;
      var projectionMat = mat4.create();
      var poseMat = mat4.create();
      var viewMat = mat4.create();
      var vrPresentButton = null;
      var nextButton = null;
      // ================================================================
      // WebGL and WebAudio scene setup. This code is not WebVR specific.
      // ================================================================

      // WebGL setup.
      var webglCanvas = document.getElementById("webgl-canvas");
      var gl = null;
      var panorama = null;
      var arrayPos = 1;
      var arrayMax = 16;
      var posString = "";
      //var stats = null;

      function getParameterByName(name, url) {
          if (!url) url = window.location.href;
          name = name.replace(/[\[\]]/g, "\\$&");
          var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
              results = regex.exec(url);
          if (!results) return null;
          if (!results[2]) return '';
          return decodeURIComponent(results[2].replace(/\+/g, " "));
        }

      function init (preserveDrawingBuffer) {
        var glAttribs = {
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: preserveDrawingBuffer
        };
        gl = webglCanvas.getContext("webgl", glAttribs);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        var startPos = getParameterByName('start');

        panorama = new VRPanorama(gl);

        if (startPos == null || startPos == ""){
          panorama.setImage("media/textures/spc/spc_001.JPG");
          arrayPos = 1;
        }
        else {
          panorama.setImage("media/textures/spc/spc_"+startPos+".JPG");
          arrayPos = parseInt(startPos);
        }

        //For FPS Stats
        //stats = new WGLUStats(gl);

        // Wait until we have a WebGL context to resize and start rendering.
        window.addEventListener("resize", onResize, false);
        onResize();
        window.requestAnimationFrame(onAnimationFrame);
      }

      // ================================
      // WebVR-specific code begins here.
      // ================================

      function toggleTo(preserveDrawingBuffer, nextThing){
        var glAttribs = {
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: preserveDrawingBuffer
        };
        gl = webglCanvas.getContext("webgl", glAttribs);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        panorama = new VRPanorama(gl);
        panorama.setImage(nextThing);

        //For FPS Stats
        //stats = new WGLUStats(gl);

        // Wait until we have a WebGL context to resize and start rendering.
        window.addEventListener("resize", onResize, false);
        onResize();
        window.requestAnimationFrame(onAnimationFrame);

      }

      function onNext () {
        arrayPos = arrayPos + 1;
        if (arrayPos > arrayMax) {
          arrayPos = 1;
        }
        posString = String(("00"+arrayPos.toString()).slice(-3));
        toggleTo(true, "media/textures/spc/spc_"+posString+".JPG");
      }

      function onBack () {
        arrayPos = arrayPos - 1;
        if (arrayPos < 1) {
          arrayPos = 16;
        }
        posString = String(("00"+arrayPos.toString()).slice(-3));
        toggleTo(true, "media/textures/spc/spc_"+posString+".JPG");
      }

      function onHome () {
        window.location.href = "http://mpftesta.github.io";
      }


      function onVRRequestPresent () {
        vrDisplay.requestPresent([{ source: webglCanvas }]).then(function () {
        }, function () {
          VRSamplesUtil.addError("requestPresent failed.", 2000);
        });
      }

      function onVRExitPresent () {
        vrDisplay.exitPresent().then(function () {
        }, function () {
          VRSamplesUtil.addError("exitPresent failed.", 2000);
        });
      }

      function onVRPresentChange () {
        onResize();

        if (vrDisplay.isPresenting) {
          if (vrDisplay.capabilities.hasExternalDisplay) {
            VRSamplesUtil.removeButton(vrPresentButton);
            vrPresentButton = VRSamplesUtil.addButton("Exit VR", "E", "media/icons/cardboard64.png", onVRExitPresent);
          }
        } else {
          if (vrDisplay.capabilities.hasExternalDisplay) {
            VRSamplesUtil.removeButton(vrPresentButton);
            vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "media/icons/cardboard64.png", onVRRequestPresent);
          }
        }
      }

      if (navigator.getVRDisplays) {
        navigator.getVRDisplays().then(function (displays) {
          if (displays.length > 0) {
            vrDisplay = displays[0];

            init(true);

            VRSamplesUtil.addButton("Back", "Z", null, onBack);
            VRSamplesUtil.addButton("Next", "X", null, onNext);
            VRSamplesUtil.addButton("Home", "H", null, onHome);
            if (!vrDisplay.stageParameters) {
              VRSamplesUtil.addButton("Reset Pose", "R", null, function () { vrDisplay.resetPose(); });
            }

            if (vrDisplay.capabilities.canPresent)
              vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "media/icons/cardboard64.png", onVRRequestPresent);

            window.addEventListener('vrdisplaypresentchange', onVRPresentChange, false);
          } else {
            init(false);
            VRSamplesUtil.addInfo("WebVR supported, but no VRDisplays found.", 3000);
          }
        });
      } else if (navigator.getVRDevices) {
        init(false);
        VRSamplesUtil.addError("Your browser supports WebVR but not the latest version. See <a href='http://webvr.info'>webvr.info</a> for more info.");
      } else {
        init(false);
        VRSamplesUtil.addError("Your browser does not support WebVR. See <a href='http://webvr.info'>webvr.info</a> for assistance.");
      }

      function onResize () {
        if (vrDisplay && vrDisplay.isPresenting) {
          var leftEye = vrDisplay.getEyeParameters("left");
          var rightEye = vrDisplay.getEyeParameters("right");

          webglCanvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
          webglCanvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
        } else {
          webglCanvas.width = webglCanvas.offsetWidth * window.devicePixelRatio;
          webglCanvas.height = webglCanvas.offsetHeight * window.devicePixelRatio;
        }
      }

      function getPoseMatrix (out, pose) {
        // When rendering a panorama ignore the pose position. You want the
        // users head to stay centered at all times. This would be terrible
        // advice for any other type of VR scene, by the way!
        var orientation = pose.orientation;
        if (!orientation) { orientation = [0, 0, 0, 1]; }
        mat4.fromQuat(out, orientation);
      }

      function renderSceneView (poseInMat, eye) {
        if (eye) {
          // FYI: When rendering a panorama do NOT offset the views by the IPD!
          // That will make the viewer feel like their head is trapped in a tiny
          // ball, which is usually not the desired effect.
          mat4.perspectiveFromFieldOfView(projectionMat, eye.fieldOfView, 0.1, 1024.0);
          mat4.invert(viewMat, poseInMat);
        } else {
          mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
          mat4.invert(viewMat, poseInMat);
        }

        panorama.render(projectionMat, viewMat);
      }

      function onAnimationFrame (t) {
        //For FPS stats
        //stats.begin();

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (vrDisplay) {
          vrDisplay.requestAnimationFrame(onAnimationFrame);

          var pose = vrDisplay.getPose();
          getPoseMatrix(poseMat, pose);

          if (vrDisplay.isPresenting) {
            gl.viewport(0, 0, webglCanvas.width * 0.5, webglCanvas.height);
            renderSceneView(poseMat, vrDisplay.getEyeParameters("left"));

            gl.viewport(webglCanvas.width * 0.5, 0, webglCanvas.width * 0.5, webglCanvas.height);
            renderSceneView(poseMat, vrDisplay.getEyeParameters("right"));

            vrDisplay.submitFrame(pose);
          } else {
            gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
            renderSceneView(poseMat, null);
            //stats.renderOrtho();
          }
        } else {
          window.requestAnimationFrame(onAnimationFrame);

          // No VRDisplay found.
          gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
          mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
          mat4.identity(viewMat);
          panorama.render(projectionMat, viewMat);

          //stats.renderOrtho();
        }

        //stats.end();
      }
      })();