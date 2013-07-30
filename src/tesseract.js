;(function(window) {
    var gl;
    var rx = 0, ry = 0, rz = 0;
    var p;
    var geo;
    var program;

    function rad(deg) { return deg * Math.PI / 180; };
    function deg(rad) { return rad / Math.PI * 180; };

    var requestAnimationFrame =
        window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame;

    var cube = new Geometry([
        // front
        [0,  25, 0, 1],
        [0,  0,  0, 1],
        [25, 25, 0, 1],

        [25, 25, 0, 1],
        [0,  0,  0, 1],
        [25, 0,  0, 1],

        // right
        [25, 25,  0, 1],
        [25, 0,   0, 1],
        [25, 25, -25, 1],

        [25, 25, -25, 1],
        [25, 0,   0, 1],
        [25, 0,  -25, 1],

        // back
        [25, 25, -25, 1],
        [25,  0, -25, 1],
        [0,  25, -25, 1],

        [0,  25, -25, 1],
        [25, 0, -25, 1],
        [0,  0, -25, 1],

        // left
        [0,  25, -25, 1],
        [0,  0,  -25, 1],
        [0,  25,   0, 1],

        [0,  25,  0, 1],
        [0,  0,  -25, 1],
        [0,  0,   0, 1],

        // top
        [0,  0,  0, 1],
        [0,  0, -25, 1],
        [25,  0, 0, 1],

        [25, 0, 0, 1],
        [0,  0, -25, 1],
        [25, 0, -25, 1],

        // bottom
        [0,  25, -25, 1],
        [0,  25,  0, 1],
        [25, 25, -25, 1],

        [25, 25, -25, 1],
        [0,  25,  0, 1],
        [25, 25,  0, 1]
    ].map(function(arr) { return vec4.fromValues.apply(vec4, arr); }));

    function handle(evt) {
        switch(evt.keyCode) {
            case 87: /* W */ rx+=1; break;
            case 83: /* S */ rx-=1; break;

            case 65: /* A */ ry-=1; break;
            case 68: /* D */ ry+=1; break;

            case 81: /* Q */ rz-=1; break;
            case 69: /* E */ rz+=1; break;

            // case 37: /* left */  break;
            // case 38: /* up */    break;
            // case 39: /* right */ break;
            // case 40: /* down  */ break;

            default: // console.log(evt.keyCode);
            break;
        }
        console.log('['+rx+','+ry+','+rz+']');
    }

    function main() {
        // compatibility boilerplate
        if(!window.WebGLRenderingContext) {
            document.body.innerHTML = "<p>uh oh, looks like your browser doesn't support <a href='http://get.webgl.org/'>WebGL</a></p>";
            return;
        }
        var canvas = document.getElementById('canvas');
        gl = canvas.getContext('experimental-webgl');
        if(!gl) {
            document.body.innerHTML = "<p>uh oh, failed to initialize WebGL! <a href='http://get.webgl.org/troubleshooting'>halp</a></p>";
            return;
        }

        gl.disable(gl.CULL_FACE);

        // set up shaders
        var vshader = document.getElementById('vertex').textContent;
        var fshader = document.getElementById('fragment').textContent;
        program = createProgram(gl, vshader, fshader);
        gl.useProgram(program);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        var oblique = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0.5*Math.sin(rad(-50)), 0.5*Math.sin(rad(-50)), 0, 0,
            0, 0, 0, 1
        ]);

        var projection = mat4.create();
        mat4.ortho(projection, 0, canvas.width, 0, canvas.height, -canvas.width/2, canvas.width/2);

        mat4.multiply(projection, projection, oblique);

        var loc = gl.getUniformLocation(program, 'upersp');
        gl.uniformMatrix4fv(loc, false, projection);

        geo = makeGrid(2, 100, 25, 4, 13);

        var t = mat4.create();
        mat4.translate(t, t, vec3.fromValues(75, 50, 0));
        geo.transform(t);

        pushData(gl, geo.flatten());
        updateAttrib(gl, program, 'pos', 4);
        loc = gl.getUniformLocation(program, 'ucolor');
        gl.uniform4fv(loc, new Float32Array([1, 1, 0, 1]));
        gl.drawArrays(gl.TRIANGLES, 0, geo.count());

    }

    window.main = main;
})(window);
