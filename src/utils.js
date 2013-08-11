;(function(window) {
    /**
     * Given a WebGl context, shader source and either VERTEX_SHADER or FRAGMENT_SHADER, compile the shader and return it
     */
    function createShader(gl, src, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            var t = type === gl.VERTEX_SHADER ? 'vertex' : 'fragent';
            throw new Error('compiling ' + t + ' shader: ' + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    /**
     * Given a WebGl context, vertex shader source and fragment shader source, return a shader program
     */
    function createProgram(gl, vsrc, fsrc) {
        var program = gl.createProgram();
        var vshader = createShader(gl, vsrc, gl.VERTEX_SHADER);
        var fshader = createShader(gl, fsrc, gl.FRAGMENT_SHADER);
        gl.attachShader(program, vshader);
        gl.attachShader(program, fshader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('linking program: ' + gl.getProgramInfoLog(program));
        }
        return program;
    }

    /**
     * Given a WebGL context and a data array, create a buffer for that data and push it to the GPU
     */
    function pushData(gl, data) {
        if(data instanceof Array) {
            data = new Float32Array(data);
        }
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    }

    /**
     * Given a WebGL context, a shader program, an attrib name, and a count of components, update the attrib pointer
     */
    function updateAttrib(gl, program, name, components) {
        var loc = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, components, gl.FLOAT, false, 0, 0);
    }

    window.createShader = createShader;
    window.createProgram = createProgram;
    window.pushData = pushData;
    window.updateAttrib = updateAttrib;
})(window);
