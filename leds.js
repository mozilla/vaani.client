/**
 * Created by anatal on 7/28/16.
 */

var LedBar = require('nascent-ledbar');

var interval = 250;

module.exports = {


    appstarted: function(){
        LedBar.turnOffLeds();
        const turngreen = (a) => {
            LedBar.setLed(a, 0, 255, 0, 0);
        };
        for (var a=0; a<LedBar.getNumLeds(); ++a) {
            setInterval(turngreen(a), interval);
        }
    },

    deviceready: function(){
        LedBar.turnOffLeds();
    },

    keyworddeteted: function(){
        LedBar.turnOffLeds();
    },

    processing: function(){
        LedBar.turnOffLeds();
    },

    playingresponse: function(){
        LedBar.turnOffLeds();
    }

}

