;(function(window) {
    function rad(deg) { return deg * Math.PI / 180; };
    function deg(rad) { return rad / Math.PI * 180; };

    /**
     * Geometry objects wrap a collection of vertices, and support
     * transforming them as a group
     */
    function Geometry(data) {
        if(data) {
            this.data = data;
        } else {
            this.data = [];
        }
    }

    /**
     * Apply this matrix to all vertices in the geometry
     */
    Geometry.prototype.transform = function(mat) {
        this.data.forEach(function(vtx) {
            vec4.transformMat4(vtx, vtx, mat);
        });
        return this;
    };

    /**
     * Return this Geometry's vertices, in one Float32Array
     */
    Geometry.prototype.flatten = function() {
        var res = new Float32Array(this.data.length * 4);
        for(var i = 0; i < this.data.length; i++) {
            res.set(this.data[i], i * 4);
        }
        return res;
    };

    Geometry.prototype.clone = function() {
        var res = [];
        this.data.forEach(function(vtx) {
            res.push(vec4.clone(vtx));
        });
        return new Geometry(res);
    };

    Geometry.prototype.union = function() {
        var res = [];
        function p(vtx) {
            res.push(vec4.clone(vtx));
        }
        this.data.forEach(p);
        for(var i = 0; i < arguments.length; i++) {
            arguments[i].data.forEach(p);
        }
        return new Geometry(res);
    };

    Geometry.prototype.count = function() {
        return this.data.length;
    };

    /**
     * Constructor functions for various geometries
     */

    /**
     * convert an Array to a vec4 (i.e. Float32Array)
     */
    function toVec4(arr) {
        return vec4.fromValues.apply(vec4, arr);
    }

    function lineSquare() {
        var left = rectangle(0, 0, 3, 50);
        var top = left.clone();

        var rotate = mat4.create();
        rotate = mat4.rotateZ(rotate, rotate, -Math.PI/2);
        var translate = mat4.create();
        translate = mat4.translate(translate, translate, vec4.fromValues(0, 3, 0, 1));

        top.transform(rotate);
        top.transform(translate);

        var bot = top.clone();
        translate = mat4.translate(translate, mat4.create(), vec4.fromValues(0, 47, 0, 1));
        bot.transform(translate);

        var right = left.clone();
        right.transform(mat4.translate(mat4.create(), mat4.create(), vec4.fromValues(47, 0, 0, 1)));

        var square = right.union(bot, left, top);
        return square;
    }

    /**
     * Make geometry for a (false) cube. doesn't include back, bottom
     * or left faces as the cube will never rotate
     */
    function makeCube(w) {
        return new Geometry([
            // front
            [0,  w, 0, 1],
            [0,  0,  0, 1],
            [w, w, 0, 1],

            [w, w, 0, 1],
            [0,  0,  0, 1],
            [w, 0,  0, 1],

            // right
            [w, w,  0, 1],
            [w, 0,   0, 1],
            [w, w, -w, 1],

            [w, w, -w, 1],
            [w, 0,   0, 1],
            [w, 0,  -w, 1],

            // top
            [0,  w, -w, 1],
            [0,  w,  0, 1],
            [w, w, -w, 1],

            [w, w, -w, 1],
            [0,  w,  0, 1],
            [w, w,  0, 1]
        ].map(toVec4));
    }

    /**
     * Make geometry for the grid -- width and length refer to the individual lines
     * floorsize is the spaces in the floor (i.e. 4 for 4x4) and height the number of rows
     */
    function makeGrid(width, length, blocksize /* FIXME ? */, floorsize, height) {
        /*

         create geometry for each individual axis, where:

             Y
             |
             |
             |_____X
            /
           /
          Z

         */

        var yaxis = new Geometry([
            [0, 0, 0, 1],
            [0, blocksize * height, 0, 1],
            [width, blocksize * height, 0, 1],
            [width, blocksize * height, 0, 1],
            [width, 0, 0, 1],
            [0, 0, 0, 1]
        ].map(toVec4));

        var xaxis = new Geometry([
            [0, 0, 0, 1],
            [0, width, 0, 1],
            [length, width, 0, 1],
            [length, width, 0, 1],
            [length, 0, 0, 1],
            [0, 0, 0, 1]
        ].map(toVec4));

        var zaxis = new Geometry([
            [0, 0, 0, 1],
            [0, width, 0, 1],
            [0, width, length, 1],
            [0, width, length, 1],
            [0, 0, length, 1],
            [0, 0, 0, 1]
        ].map(toVec4));

        // duplicate and transform to make grids

        var X = 0, Y = 1, Z = 2; // sugar
        var x, y, z; // indices
        var t = mat4.create(), g, v = vec3.create();
        var res = [];

        // x-axis extended in Z direction
        for(x = 0; x <= floorsize; x++) {
            v[Z] = x * blocksize;
            mat4.identity(t);
            mat4.translate(t, t, v);
            g = xaxis.clone();
            g.transform(t);
            res.push(g);
        }
        v[Z] = 0;
        // x-axis extended in Y direction
        for(x = 0; x <= height; x++) {
            v[Y] = x * blocksize;
            mat4.identity(t);
            mat4.translate(t, t, v);
            g = xaxis.clone();
            g.transform(t);
            res.push(g);
        }
        v[Y] = 0;
        // z-axis extended in X direction
        for(z = 0; z <= floorsize; z++) {
            v[X] = z * blocksize;
            mat4.identity(t);
            mat4.translate(t, t, v);
            g = zaxis.clone();
            g.transform(t);
            res.push(g);
        }
        v[X] = 0;
        // z-axis extended in Y direction
        for(z = 0; z <= height; z++) {
            v[Y] = z * blocksize;
            mat4.identity(t);
            mat4.translate(t, t, v);
            g = zaxis.clone();
            g.transform(t);
            res.push(g);
        }
        v[Y] = 0;
        // y-axis extended in X direction
        for(y = 0; y <= floorsize; y++) {
            v[X] = y * blocksize;
            mat4.identity(t);
            mat4.translate(t, t, v);
            g = yaxis.clone();
            g.transform(t);
            res.push(g);
        }
        v[X] = 0;
        // y-axis extended in Z direction
        for(y = 0; y <= floorsize; y++) {
            v[Z] = y * blocksize;
            mat4.identity(t);
            mat4.translate(t, t, v);
            g = yaxis.clone();
            g.transform(t);
            res.push(g);
        }
        return res.reduce(function(acc, x) { return acc.union(x); });
    }

    window.Geometry = Geometry;
    window.makeGrid = makeGrid;
    window.makeCube = makeCube;
    window.deg = deg;
    window.rad = rad;

})(window);
