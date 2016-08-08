/**
 * Created by anatal on 8/7/16.
 */

const child_process = require('child_process');

var _child_process;

const shelloutAsync = (command, params) => {
    if (_child_process) _child_process.kill();
    _child_process = child_process.spawn(command, params.split(' '));
}

module.exports = {

    processing: function () {
        shelloutAsync('node', 'leds.js --processing');
    },

    deviceready: function () {
        shelloutAsync('node', 'leds.js --deviceready');
    },

    response: function () {
        shelloutAsync('node', 'leds.js --response');
    },

    listening: function () {
        shelloutAsync('node', 'leds.js --listening');
    },

    error: function () {
        shelloutAsync('node', 'leds.js --error');
    },
}

