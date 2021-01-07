const Binance = require('binance-api-node').default;
const redis = require("redis");
const util = require('util');

let store = redis.createClient();
store.get = util.promisify(store.get);
store.set = util.promisify(store.set);


const client = Binance({
    apiKey: 'API-KEY',
    apiSecret: 'API-KEY',
});


(async () => {

    const setOrder = async (coin, orderPrice, condition, op, qty = 0) => {
        let message = `Order to ${op} ${coin} has been set at price ${orderPrice}`
        if (condition) {
            console.log(message, '-', 'attempt')
            try {
                await client.orderTest({
                    symbol: coin,
                    side: op,
                    quantity: qty,
                    price: orderPrice,
                })
                console.log(message, '-', 'complete')
            } catch (e) {
                console.log(message, '-', 'failed reason:', e.message )
            }
        }
    }


    let coin = 'UNFIUSDT'
    let qty = 100

    await store.set("startPrice", 0);
    await store.set("bought", false);

    await client.exchangeInfo().then(rules => {
        rules.symbols.forEach(async symbol => {
            if (symbol.symbol == coin) {
                console.log(symbol.filters);
                await store.set("precision", symbol.baseAssetPrecision);
                await store.set("min", Number.parseFloat(symbol.filters[0].minPrice).toString());
            }
        })
    })

    client.ws.ticker(coin, async ticker => {

        Promise.all([
            store.get("bought"),
            store.get("startPrice"),
            store.get("precision"),
            store.get("min"),
        ]).then(async (values) => {

            let bought = values[0] === "true"
            let startPrice = Number.parseFloat(values[1])
            let precision = Number.parseInt(values[2]) - 4
            let min = values[3].split('.')[1].length 

            let price = Number.parseFloat(ticker.curDayClose)
            let stopLoss = {
                condition: price < startPrice ,
                price: startPrice - (startPrice * 0.02)
            }
            let stopProfit = {
                condition: price > startPrice * 1.5,
                price: startPrice * 1.51
            }
            console.log(stopLoss, stopProfit);
            if (!bought) {
                await setOrder(coin, (price * 1.01).toFixed(min), true, "BUY")
                await store.set("startPrice", price * 1.01);
                await store.set("bought", true);
            } else {
                await setOrder(coin, stopLoss.price.toFixed(min), stopLoss.condition, "SELL", qty)
                await setOrder(coin, stopProfit.price.toFixed(min), stopProfit.condition, "SELL", qty)
            }
        }).catch(error => {
            console.log(error.message)
        })

    })

})();