const { ipcRenderer } = require('electron')

let app = new Vue({
    el: '#app',
    vuetify: new Vuetify(),
    data: {
        usd: 0 ,
        coin: 'BNBUSDT',
        stop: true ,
    },
    created: () => {
        ipcRenderer
    },
    methods: {
        start: function () {
            this.stop = !this.stop
            ipcRenderer.invoke('stop')
        },
        close: function () {
            ipcRenderer.invoke('close')
        }
    }
})

