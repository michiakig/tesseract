;(function(window) {
    var gl;
    var program;

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

    /**
     * thing that can be drawn.
     * includes an index and count for the position vertex array
     * a color, a type (gl.TRIANGLES, gl.TRIANGLE_STRIP, etc) and a model matrix
     */
    function Thing(idx, ct, color, type, model) {
        this.idx = idx;
        this.ct = ct;
        this.color = color;
        this.type = type;
        this.model = model;
    }
    Thing.prototype.draw = function(gl, pgm) {
        var loc = gl.getUniformLocation(program, 'umodel');
        gl.uniformMatrix4fv(loc, false, this.model);

        loc = gl.getUniformLocation(pgm, 'ucolor');
        gl.uniform4fv(loc, this.color);
        gl.drawArrays(this.type, this.idx, this.ct);
    };

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
        var gridColor = new Float32Array([1, 1, 0, 1]);
        var model = mat4.create();
        mat4.translate(model, model, vec3.fromValues(50, 50, 0));
        var gridThing = new Thing(0, grid.count(), gridColor, gl.TRIANGLES, model);

        var cube = makeCube(25);
        var cubeColor = new Float32Array([0, 0.8, 0, 1]);
        model = mat4.create();
        mat4.translate(model, model, vec3.fromValues(50, 50, 25));
        var cubeThing = new Thing(grid.count(), cube.count(), cubeColor, gl.TRIANGLES, model);

        var wireframe = makeWireframeCube(25);
        var wireframeColor = new Float32Array([1, 1, 1, 1]);
        model = mat4.create();
        mat4.translate(model, model, vec3.fromValues(50, 50, 25));
        var wireframeThing = new Thing(gridThing.ct + cubeThing.ct, wireframe.count(), wireframeColor, gl.LINE_STRIP, model);

        var geo = grid.union(cube, wireframe);
        pushData(gl, geo.flatten());
        updateAttrib(gl, program, 'pos', 4);

        gridThing.draw(gl, program);
        cubeThing.draw(gl, program);
        wireframeThing.draw(gl, program);
    }

    window.main = main;
})(window);
