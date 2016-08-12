const Concat = require('concat-stream');
const ChildProcess = require('child_process');
const Fs = require('fs');
const Mic = require('mic');
const Path = require('path');
const PocketSphinx = require('pocketsphinx').ps;
const Which = require('which');

const stateEnum = {
    STOPPED: 'stopped',
    LOADING: 'loading',
    PRELISTEN: 'pre-listening',
    LISTENING: 'listening',
    STREAMING: 'streaming',
    PAUSED: 'paused'
};

/**
 * Wakeword module.
 * @module wakeword
 */
module.exports = {

    /**
     * The file name to output PocketSphinx logs to.
     * null will output to stdout.
     */
    logFile: null,

    /**
     * The file name to use for passing wake words to PocketSphinx.
     */
    keywordFile: 'wakewords.txt',

    /**
     * The microphone device name, when applicable.
     */
    deviceName: 'default',

    /**
     * The time between voice processing calls, in milliseconds.
     */
    sampleTime: 100,

    /**
     * The PocketSphinx decoder object being used. Setting this to null when
     * in the stopped state will cause it to be recreated.
     */
    decoder: null,

    /**
     * The current state. Can be <code>stopped</code>, <code>loading</code>,
     * <code>listening</code> or <code>paused</code>.
     * @readonly
     */
    state: stateEnum.STOPPED,

    lastScore: null,

    // Private properties.
    sphinxConfig: null,
    lastWords: [],
    detected: null,
    pendingState: null,

    logging : null,

    /**
     * Retrieves the PocketSphinx configuration. This configuration will be used
     * whenever the next PocketSphinx decoder is created.
     *
     * @returns {Promise.Object} A Promise that resolves a PocketSphinx
     *   configuration object.
     */
    getPsConfig: function() {
        return new Promise((resolve, reject) => {
            if (this.sphinxConfig) {
                resolve(this.sphinxConfig);
                return;
            }

            Which('pocketsphinx_continuous', (e, path) => {
                if (e) {
                    reject(e);
                    return;
                }

                path = Path.join(Path.dirname(path), '..', 'share',
                    'pocketsphinx', 'model', 'en-us');
                if (!Fs.statSync(path).isDirectory()) {
                    reject(`Pocketsphinx en-us model not found at '${path}'`);
                    return;
                }

                var config = this.sphinxConfig = PocketSphinx.Decoder.defaultConfig();
                config.setString("-hmm", Path.join(path, 'en-us'));
                config.setString("-dict", Path.join(path, 'cmudict-en-us.dict'));
                config.setString("-lm", Path.join(path, 'en-us.lm.bin'));
                if (this.logFile) {
                    config.setString('-logfn', this.logFile);
                }

                resolve(this.sphinxConfig);
            });
        });
    },

    /**
     * Retrieves the PocketSphinx decoder. If one hasn't been created yet, one
     * will be created.
     *
     * @returns {Promise.Object} A Promise that resolves a PocketSphinx decoder
     *   object.
     */
    getDecoder: function() {
        return new Promise((resolve, reject) => {
            this.getPsConfig().then(() => {
                if (!this.decoder) {
                    this.decoder = new PocketSphinx.Decoder(this.sphinxConfig);
                }
                resolve(this.decoder);
            });
        });
    },

    /**
     * Retrieves a microphone object. If one hasn't been created yet, one will
     * be created.
     *
     * @returns {Object} A microphone object.
     */
    getMic: function() {
        if (!this.mic) {
            this.mic = Mic(
                { rate: '16000',
                    channels: '1',
                    encoding: 'signed-integer',
                    device: this.deviceName });
            this.mic.getAudioStream().on('error', e => {
                console.error('Error streaming from microphone', e);
            });
        }

        return this.mic;
    },

    /**
     * This callback handles microphone data after a successful wake word
     * recognition.
     *
     * @callback onwakeCallback
     * @param {Object} data Data from the microphone.
     * @param {string} word The word that was recognised.
     */

    /**
     * Listens for the specified wake words. Once a word has been recognised,
     * microphone data will be continuously streamed to the {@link onwake}
     * callback until it is cancelled.
     *
     * @example
     * var wakeTime;
     * var rawStream = null;
     * Wakeword.listen(['record'], 0.87, (data, word) => {
   *   if (!rawStream) {
   *     wakeTime = Date.now();
   *     rawStream = Fs.createWriteStream('recording.raw', {
   *       defaultEncoding: 'binary'
   *     });
   *   }
   *
   *   rawStream.write(data);
   *
   *   if (Date.now() - wakeTime > 5000) {
   *     Wakeword.stop();
   *     rawStream.end();
   *   }
   * });
     *
     * @param {Array.<string>} words An array of wake words
     * @param {number} scoreThreshold The recognition score threshold (e.g. 0.87)
     * @param {onwakeCallback} onwake The callback to handle microphone data
     */
    listen: function(words, scoreThreshold, kwsThreshold, onwake, onready) {
        switch (this.state) {
            case stateEnum.LOADING:
                this.pendingState = {
                    state: stateEnum.LISTENING,
                    words: words,
                    scoreThreshold: scoreThreshold,
                    onwake: onwake };
                return;

            case stateEnum.STREAMING:
            case stateEnum.LISTENING:
            case stateEnum.PAUSED:
                this.stop();
                break;
        }

        this.state = stateEnum.LOADING;

        this.getDecoder().then(() => {
            var startListening = () => {
                if (this.pendingState) {
                    var pendingState = this.pendingState;
                    this.pendingState = null;

                    switch (pendingState.state) {
                        case stateEnum.LISTENING:
                            this.state = stateEnum.STOPPED;
                            this.listen(pendingState.words, pendingState.scoreThreshold,
                                pendingState.onwake);
                            return;

                        case stateEnum.STOPPED:
                            this.state = stateEnum.STOPPED;
                            return;

                        default:
                            console.error('Stopping, invalid pending state',
                                pendingState.state);
                            this.state = stateEnum.STOPPED;
                            return;
                    }
                }

                this.decoder.setKws('wakeword', this.keywordFile);
                this.decoder.setSearch('wakeword');
                this.decoder.startUtt();
                onready();
                this.state = stateEnum.PRELISTEN;
                this.record(data => {
                    if (!this.detected) {
                        this.decoder.processRaw(data, false, false);

                        var now = Date.now();
                        var hyp = this.decoder.hyp();
                        if (hyp && hyp.hypstr) {
                            this.decoder.endUtt();
                            if (this._checkScore(scoreThreshold)) {
                                this.logging.addmetric("wakeword", "spot", "ok_score", this.lastScore);
                                this.detected = hyp.hypstr;
                                this.state = stateEnum.STREAMING;
                            } else {
                                this.logging.addmetric("wakeword", "spot", "low_score", this.lastScore);
                                this.decoder.startUtt();
                            }
                        }
                        return;
                    }

                    onwake(data, this.detected);
                });
            };

            if (JSON.stringify(this.lastWords) === JSON.stringify(words)) {
                startListening();
            } else {
                // pocketsphinx doesn't allow for multiple keywords or configurable
                // threshold via any public API except for the keyword file.
                Fs.open(this.keywordFile, 'w', (e, file) => {
                    if (e) {
                        console.error('Error opening keyword file', e);
                        this.state = stateEnum.STOPPED;
                        return;
                    }

                    for (var word of words) {
                        Fs.write(file, `${word}/${kwsThreshold}/\n`);
                    }

                    Fs.close(file, e => {
                        if (e) {
                            console.error('Error closing keyword file', e);
                            this.state = stateEnum.STOPPED;
                            return;
                        }

                        startListening();
                    });
                });
            }
        });
    },

    _checkScore: function(threshold) {
        var seg = this.decoder.seg().iter().next();
        if (!seg) {
            return false;
        }
        this.lastScore = this.decoder.getLogmath().exp(seg.prob);
        console.log("Kws Score:", this.lastScore);
        return this.decoder.getLogmath().exp(seg.prob) >= threshold;
    },

    /**
     * Pauses microphone recording.
     */
    pause: function() {
        switch (this.state) {
            case stateEnum.STREAMING:
            case stateEnum.LISTENING:
                this.mic.pause();
                this.state = stateEnum.PAUSED;
                break;

            case stateEnum.PAUSED:
                break;

            default:
                console.warn('Attempted to pause from invalid state: ', this.state);
        }
    },

    /**
     * Resumes microphone recording. If called after recognising a wake word,
     * this will stop streaming to the <code>onwake</code> callback and resume
     * listening for the last requested wake words.
     */
    resume: function() {
        switch (this.state) {
            case stateEnum.LISTENING:
                break;

            case stateEnum.STREAMING:
                if (this.detected && this.detected.length > 0) {
                    this.decoder.startUtt();
                    this.detected = null;
                }
                break;

            case stateEnum.PAUSED:
                this.mic.resume();
                this.state = this.detected ? stateEnum.STREAMING : stateEnum.LISTENING;
                break;

            default:
                console.warn('Attempted to resume from invalid state: ', this.state);
        }
    },

    /**
     * This callback handles microphone data when recording.
     *
     * @callback recordCallback
     * @param {Object} data Data from the microphone.
     */

    /**
     * Streams microphone data to the given {@link callback}.
     *
     * @param {recordCallback} callback The callback to handle microphone data
     */
    record: function(callback) {
        if (this.state !== stateEnum.STOPPED &&
            this.state !== stateEnum.PRELISTEN) {
            console.warn('Attempted to record from invalid state: ' + this.state);
            return;
        }

        var buffer = Concat(callback);
        var speechSampleTime = Date.now();
        var stream = this.getMic().getAudioStream();
        var lastmin;

        stream.on('data', data => {
            var now = Date.now();
            buffer.write(data);
            if (now - speechSampleTime > this.sampleTime) {
                buffer.end();
                buffer = Concat(callback);
                speechSampleTime = now;
            }
            if ((new Date(now).getSeconds() === 0) && (new Date(now).getMinutes() !== lastmin)) {
                lastmin = new Date(now).getMinutes();
                this.logging.addmetric("heartbeat", "hb", "ok", 1);
            }
        });

        this.state = (this.state === stateEnum.STOPPED) ?
            stateEnum.STREAMING : stateEnum.LISTENING;
        this.mic.start();
    },

    /**
     * Stops microphone recording and wake word recognition.
     */
    stop: function() {
        switch (this.state) {
            case stateEnum.STOPPED:
                return;

            case stateEnum.LOADING:
                this.pendingState = { state: stateEnum.STOPPED };
                return;
        }

        this.mic.getAudioStream().removeAllListeners();
        this.mic.stop();
        this.mic = null;  // XXX Doesn't seem like mic is reusable after stopping

        if (!this.detected) {
            this.decoder.endUtt();
        }
        this.detected = null;
        this.state = stateEnum.STOPPED;
    }
};
