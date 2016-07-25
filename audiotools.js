/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// load modules and initialize some vars
const fs = require('fs');
const child_process = require('child_process');
var lastvadStatus = 0;
var dtStartSilence, totalSilencetime;

module.exports =  {

    /**
     * Holds a reference for the microphone.
     */
    microphone: null,

    wakeword: null,

    config: null,

    sox: null,

    _wspush: null,

    streamServer:null,

    shelloutAsync: (command, params) => child_process.spawn(command, params.split(' ')),

    shelloutSync: (command, params) => child_process.spawnSync(command, params.split(' ')),

    setup: function(wakeword, config){

        if (process.platform === "linux") {
            this.shelloutSync('amixer',  "-c 2 set PCM 100%");
            this.shelloutSync('amixer',  "-c 3 set PCM 100%");
        }

        this.config = config;
        this.wakeword = wakeword;
        this.wakeword.deviceName = this.config.micdevicename;
        this.microphone = wakeword.getMic();
        this.microphone.pause();
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

    setupSox: function() {

        // if not a valid value and no gain is being applied, we return
        if ((this.config.micgain === 0))
            return;

        this.sox = child_process.spawn('sox', [
            '-t', 'raw',
            '-b', '16',
            '-e', 'signed',
            '-c', '1',
            '-r', '16000',
            '-',
            '-t', 'raw',
            '-b', '16',
            '-e', 'signed',
            '-c', '1',
            '-r', '16000',
            '-',
            'vol', this.config.micgain + "dB"
        ]);

        this.sox.stdout.on('data', (data) => {
            console.log('data sox');
            this.streamServer.write(data);
            this._wspush();
        } );
        this.sox.stdout.on('close', () => { console.log('close sox'); });
        this.sox.stdin .on('error', (error) => {
            console.log("error sox", error);
        } );
    },

    feedSox: function(data,streamServer,_wspush){
        this.streamServer = streamServer;
        this._wspush = _wspush;
        this.sox.stdin.write(data);
    },

    greeting: function(){
        this.microphone.pause();
        this.playaudio('resources/hi.wav');
        this.microphone.resume();
        dtStartSilence = totalSilencetime = null;
    },

    endsound: function(){
        if (this.config.micgain) this.sox.kill();
        this.microphone.pause();
        this.playaudio('resources/end_spot.wav');
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
        this.playaudio('output.wav');
        this.microphone.resume();
        this.wakeword.resume();
    },

    playerror: function(){
        this.microphone.pause();
        this.playaudio('resources/sorry.wav');
        this.microphone.resume();
    }
}
