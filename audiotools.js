
// then all required modules
const fs = require('fs');
const child_process = require('child_process');

// and set some vars
var lastvadStatus = 0;
var dtStartSilence, totalSilencetime;
var promisesox, soxpromiseresolve, soxpromisesreject ;

module.exports =  {

    /**
     * Holds a reference for the microphone.
     */
    microphone: null,

    wakeword: null,

    config: null,

    sox: null,

    shelloutAsync: (command, params) => child_process.spawn(command, params.split(' ')),

    shelloutSync: (command, params) => child_process.spawnSync(command, params.split(' ')),

    setup: function(wakeword, config){

        this.config = config;
        this.wakeword = wakeword;
        this.wakeword.deviceName = this.config.micdevicename;
        this.microphone = wakeword.getMic();
        this.microphone.pause();
        this.shelloutSync('play', 'resources/start.wav');
        this.microphone.resume();
    },

    setupSox: function() {

        // if not a valid value and no gain is being applied, we return
        if ((this.config.micgain == 0))
            return;

        this.sox = child_process.spawn('sox', [
            '-d',
            '-q',
            '-b', '16',
            '-r', '16000',
            '-c', '1',
            '-t', 'raw',
            '-',
            'vol', this.config.micgain + "dB"
        ]);

        this.sox.stdout.on('data', (data) => { soxpromiseresolve(data); } );
        this.sox.stdout.on('close', () => { });
        this.sox.stdin .on('error', (error) => { soxpromisesreject(error); } );
    },

    feedSox: function(data){
        var promisesox = new Promise((resolve, reject) => {
            soxpromiseresolve = resolve;
            soxpromisesreject = reject;
        });
        this.sox.stdin.write(data);
        return promisesox;
    },

    greeting: function(){
        this.microphone.pause();
        this.shelloutSync('play', 'resources/hi.wav');
        this.microphone.resume();
        dtStartSilence = totalSilencetime = null;
    },

    endsound: function(){
        if (this.config.micgain) this.sox.kill();
        this.microphone.pause();
        this.shelloutSync('play', 'resources/end_spot.wav');
        this.microphone.resume();
    },

    vad: function (data) {
        if (!data) {
            return config.MAX_SIL_TIME;
        }

        var vadStatus = this.wakeword.decoder.processWebrtcVad(data);

        if (lastvadStatus == 1 && vadStatus == 0){
            dtStartSilence = Date.now();
        } else if (lastvadStatus == 0 && vadStatus == 0 && dtStartSilence){
            totalSilencetime = Date.now() - dtStartSilence;
        } else if (lastvadStatus == 0 && vadStatus == 1) {
            totalSilencetime = 0;
        }

        lastvadStatus = vadStatus;
        return totalSilencetime;
    },

    playresponse: function(){
        this.microphone.pause();
        this.shelloutSync('play', 'output.wav');
        this.microphone.resume();
        this.wakeword.resume();
    }
}