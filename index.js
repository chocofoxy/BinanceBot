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

    const setOrder = async (coin, orderPrice, condition, op, qty = 0, cb) => {
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
                cb()
                console.log(message, '-', 'complete')
            } catch (e) {
                console.log(message, '-', 'failed reason:', e.message)
            }
        }
    }

    const setOrderOCO = async (coin, profitPrice, lossPrice , op, qty = 0 , cb ) => {
        let message = `Order to ${op} ${coin} has been set at price ${profitPrice} or ${lossPrice}`
        console.log(message, '-', 'attempt')
        try {
            await client.orderOco({
                symbol: coin,
                side: op,
                quantity: qty,
                price: profitPrice ,
                stopPrice: lossPrice,
                stopLimitPrice: lossPrice ,
            })
            cb()
            console.log(message, '-', 'complete')
        } catch (e) {
            console.log(message, '-', 'failed reason:', e.message)
        }
    }

    let coin = 'BNBUSDT'
    let usd = 50

    await store.set("startPrice", 0);
    await store.set("bought", false);
    await store.set("sold", false);
    await store.set("qty", 0);

    await client.exchangeInfo().then(rules => {
        rules.symbols.forEach(async symbol => {
            if (symbol.symbol == coin) {
                console.log(symbol.filters);
                await store.set("precision", symbol.baseAssetPrecision);
                await store.set("lotSize", symbol.filters[2].minQty);
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
            store.get("sold"),
            store.get("qty"),
            store.get("lotSize")
        ]).then(async (values) => {

            let bought = values[0] === "true"
            let sold = values[4] === "true"
            let startPrice = Number.parseFloat(values[1])
            let qty = Number.parseFloat(values[5])
            let precision = Number.parseInt(values[2]) - 4
            let minPrice = values[3].split('.')[1].length
            let minQty = (values[6].split('.')[1]).split('1')[0].length
            let price = Number.parseFloat(ticker.curDayClose)
            
            let limit = {
                stopLoss: (startPrice - (startPrice * 0.02)).toFixed(minPrice) ,
                stopProfit: (startPrice * 1.51).toFixed(minPrice)
            }
            
            if (!bought && price > 0) {
                qty = (usd / (price * 1.01).toFixed(minPrice)  ).toFixed(minQty)
                console.log(qty)
                await setOrder(coin, (price * 1.01).toFixed(minPrice), true, "BUY", qty , async () =>{
                    await store.set("startPrice", price * 1.01);
                    await store.set("bought", true);
                    await store.set("qty", qty);
                })
            } else if ( !sold ) {
                await setOrderOCO(coin, limit.stopProfit , limit.stopLoss ,"SELL", qty, async () =>{
                    await store.set("sold", true);
                })
            }

            if ( price >= startPrice.toFixed(minPrice) && bought )
                console.log(`Buying order at ${price} expected to be successful`)
            else if ( (price >= limit.stopProfit || price <= limit.stopLoss) && sold)
                console.log(`Selling order at ${price} expected to be successful`)

        }).catch(error => {
            console.log(error.message)
        })

    })

})();