export class StopLimit {

    price = 0

    constructor( startingPrice = 0 , loss = true , percent = 0.1 , threshold = 0.01 ) {
        percent = loss ? percent : percent + 1
        price = startingPrice * percent
    }


    condition( price ) {
        return  loss ? ( startingPrice < price ) : ( startingPrice > price )
    }




}