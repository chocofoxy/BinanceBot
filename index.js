const Binance = require('binance-api-node').default;

class TradingBot {

    startPrice = 0
    bought = false
    sold = false
    qty = 0
    coin = 'BTCUSDT'
    usd = 50
    lotSize = 0
    min = 0
    limitOptions = {}
    limits = {}

    constructor(
        apiKey = 'API-KEY',
        apiSecret = 'API-KEY'
    ) {
        this.client = Binance({
            apiKey: apiKey ,
            apiSecret: apiSecret,
        })
        this.setLimits()
    }

    subscribe () {
        this.client.ws.ticker(this.coin, async ticker => {

            let price = Number.parseFloat(ticker.curDayClose)


            if (!this.bought && price > 0) {
                let qty = ( this.usd / (price * 1.01).toFixed(this.minPrice)  ).toFixed(this.minQty)
                console.log(qty, this.minQty , this.minPrice)
                await this.setOrder(this.coin, (price * 1.01).toFixed(this.minPrice), true, "BUY", qty , async () =>{
                    this.startPrice = price * 1.01
                    this.bought = true
                    this.qty = qty
                    this.updateLimits()
                })
            } else if ( !this.sold ) {
                await this.setOrderOCO(this.coin, this.limit.stopProfit ,  this.limit.stopLoss ,"SELL", this.qty, async () =>{
                    this.sold = true
                })
            }

            if ( price >= this.startPrice.toFixed(this.minPrice) && this.bought )
                console.log(`Buying order at ${price} expected to be successful`)
            else if ( (price >=  this.limit.stopProfit || price <=  this.limit.stopLoss) && this.sold)
                console.log(`Selling order at ${price} expected to be successful`)
            
        })
    }

    async getCoinRules () {
        await this.client.exchangeInfo().then(rules => {
            rules.symbols.forEach(async symbol => {
                if (symbol.symbol == this.coin) {
                    console.log(symbol.filters);
                    this.minPrice = this.min_Price(symbol.filters[0].minPrice);
                    this.minQty = this.min_Qty(symbol.filters[2].minQty);
                }
            })
        })
    }


    async start(options) {
        this.coin = options.coin 
        this.usd = options.usd
        await this.getCoinRules()
        this.subscribe()
    }


    min_Qty ( qty ) {
        qty = qty.split('1')[0]
        return qty.length == 0 ? 0  : qty.split('.')[1].length
    }

    min_Price ( price ) {
        price = price.split('1')[0]
        return price.length == 0 ? 0 : price.split('.')[1].length
    }

    async setOrder (coin, orderPrice, condition, op, qty = 0, cb) {
        let message = `Order to ${op} ${coin} has been set at price ${orderPrice}`
        if (condition) {
            console.log(message, '-', 'attempt')
            try {
                await this.client.orderTest({
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

    async setOrderOCO (coin, profitPrice, lossPrice , op, qty = 0 , cb ) {
        let message = `Order to ${op} ${coin} has been set at price ${profitPrice} or ${lossPrice}`
        console.log(message, '-', 'attempt')
        try {
            await this.client.orderOco({
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

    setLimits(options = { loss: 0.02 , profit: 0.5 }) {
        this.limitOptions = options 
        this.updateLimits()
    }

    updateLimits () {
        this.limit = {
            stopLoss: (this.startPrice - (this.startPrice *  this.limitOptions.loss )).toFixed(this.minPrice) ,
            stopProfit: (this.startPrice * ( this.limitOptions.profit + 1 )).toFixed(this.minPrice)
        }
    }

}


( async () => {

    let bot = new TradingBot()
    bot.setLimits({ loss: 0.02 , profit: 0.5 })
    await bot.start({ coin : 'BNBUSDT' , usd : 50 })

})()

