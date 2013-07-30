;(function(window) {
    var gl;
    var p;
    var program;

    function rad(deg) { return deg * Math.PI / 180; };
    function deg(rad) { return rad / Math.PI * 180; };

    var requestAnimationFrame =
        window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame;

    function handle(evt) {
        switch(evt.keyCode) {
            case 87: /* W */ break;
            case 83: /* S */ break;
            case 65: /* A */ break;
            case 68: /* D */ break;
            case 81: /* Q */ break;
            case 69: /* E */ break;

            case 37: /* left */  break;
            case 38: /* up */    break;
            case 39: /* right */ break;
            case 40: /* down  */ break;

            default: // console.log(evt.keyCode);
            break;
        }
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

        // prepare and load projection matrix
        var oblique = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0.5*Math.sin(rad(-50)), 0.5*Math.sin(rad(-50)), 0, 0,
            0, 0, 0, 1
        ]);
        var ortho = mat4.create();
        mat4.ortho(ortho, 0, canvas.width, 0, canvas.height, -canvas.width/2, canvas.width/2);
        mat4.multiply(ortho, ortho, oblique);
        var loc = gl.getUniformLocation(program, 'uproj');
        gl.uniformMatrix4fv(loc, false, ortho);

        // create game grid
        var grid = makeGrid(2, 100, 25, 4, 13);
        var t = mat4.create();
        mat4.translate(t, t, vec3.fromValues(75, 50, 0));
        grid.transform(t);
        pushData(gl, grid.flatten());
        updateAttrib(gl, program, 'pos', 4);

        loc = gl.getUniformLocation(program, 'ucolor');
        gl.uniform4fv(loc, new Float32Array([1, 1, 0, 1]));
        gl.drawArrays(gl.TRIANGLES, 0, grid.count());
    }

    window.main = main;
})(window);
