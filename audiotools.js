/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// load modules and initialize some vars
const fs = require('fs');
const child_process = require('child_process');
const leds = require('./ledshelper.js');

var lastvadStatus = 0;
var dtStartSilence, totalSilencetime;

module.exports =  {

    /**
     * Holds a reference to the microphone.
     */
    microphone: null,

    wakeword: null,

    config: null,

    _wspush: null,

    streamServer:null,

    logging: null,

    end_sound_played: null,

    shelloutAsync: (command, params) => child_process.spawn(command, params.split(' ')),

    shelloutSync: (command, params) => child_process.spawnSync(command, params.split(' ')),

    setup: function(wakeword, config, logging){

        if (process.platform === "linux") {
            this.shelloutSync('amixer',  "-c 2 set PCM 100%");
            this.shelloutSync('amixer',  "-c 3 set PCM 100%");
        }

        this.config = config;
        this.wakeword = wakeword;
        this.logging = logging;
        this.wakeword.deviceName = this.config.micdevicename;
        this.microphone = wakeword.getMic();
        this.microphone.pause();
        if ((process.env.VAANI_BOOTS || 1) < 2)
            this.playaudio('resources/start.wav');
        this.microphone.resume();
    },

    playaudio: function(path){
        if (process.platform === "darwin") {
            this.shelloutSync('play', path);
        } else {
            this.shelloutSync('aplay', ['-D', this.config.spkdevicename, path].join(' '));
        }
    },

    greeting: function(){
        this.end_sound_played = false;
        this.microphone.pause();
        this.playaudio('resources/hi.wav');
        this.microphone.resume();
        dtStartSilence = totalSilencetime = null;
    },

    endsound: function(){
        this.microphone.pause();
        // for situations when the server has VAD and respond before the client VAD
        // detects silence, we need to prevent the client from playing the beep twice
        if (!this.end_sound_played) {
            this.playaudio('resources/end_spot.wav');
            this.end_sound_played = true;
        }
        this.microphone.resume();
    },

    vad: function (data) {
        if (!data) {
            return this.config.MAX_SIL_TIME;
        }

        var vadStatus = this.wakeword.decoder.processWebrtcVad(data);

        if (lastvadStatus === 1 && vadStatus === 0){
            dtStartSilence = Date.now();
        } else if (lastvadStatus === 0 && vadStatus === 0 && dtStartSilence){
            totalSilencetime = Date.now() - dtStartSilence;
        } else if (lastvadStatus === 0 && vadStatus === 1) {
            totalSilencetime = 0;
        }

        lastvadStatus = vadStatus;
        return totalSilencetime;
    },

    playresponse: function(){
        this.microphone.pause();
        // we check if the file is empty. if is, we play the sorry message
        if (fs.statSync('output.wav').size === 0)
            this.playaudio('resources/error.wav');
        else
            this.playaudio('output.wav');
        this.microphone.resume();
        this.wakeword.resume();
        leds.listening();
        this.logging.addmetric("tts", "play", "ok", 1);
    },

    playerror: function(){
        leds.error();
        this.microphone.pause();
        this.playaudio('resources/sorry.wav');
        this.microphone.resume();
        leds.listening();
        this.logging.addmetric("tts", "play", "error", -1);
    },

    // Convert a gain (in decibels) to an amplitude amplification factor. See:
    // http://www.sengpielaudio.com/calculator-FactorRatioLevelDecibel.htm
    amplificationFactor: function(gain) {
        return Math.sqrt(Math.pow(10, gain/10));
    },

    //
    // Amplify data by the specified gain, modifying the buffer in place.
    //
    //  - data is a Node Buffer object that contains little-endian signed
    //    16-bit values.
    //  - factor is the desired amplification. The samples will be multiplied
    //    by this number.
    //
    amplify: function(data, factor) {
        // View the bytes in the buffer as signed 16 bit values
        var samples = new Int16Array(data.buffer,
                                     data.byteOffset,
                                     data.byteLength / 2);

        // Now do the multiplication, clipping values rather than
        // wrapping around.
        for(var i = 0; i < samples.length; i++) {
            var s = samples[i];
            s = Math.round(s * factor);
            if (s > 32767) s = 32767
            else if (s < -32768) s = -32768
            samples[i] = s;
        }
    }
}
