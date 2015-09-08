/**
 * Created by dxs on 2015-08-30.
 */

Meteor.methods({


    //weChat 正式支付
    'weChatPay': function (order) {
        console.log('order:', order);
        var config = {
            subject: order.body, //商品标题
            body: order.body,   //商品描述
            amount: 1,//order.total_fee,   //订单金额 单位分
            order_no: order.out_trade_no,  //订单号
            channel: "wx_pub",   //支付使用的第三方支付渠道
            currency: "cny",    //三位 ISO 货币代码，目前仅支持人民币 cny。
            client_ip: "127.0.0.1",    //发起支付请求终端的 IP 地址
            app_id: "app_ejfvz1L4aP08WrjT",
            opneid: order.openid

        };
        var wx_charge = Async.wrap(Meteor.dxs.wxPingppPay_createCharge);
        var result = wx_charge(config);
        console.log("----------------------请求ping++后同步返回--charge------------------------");
        console.log(result);
        //return result;
        console.log("---------------------------保存至数据库-----------------------------");
        var chagreId =  dbCharge.insert({
            'charge':result
        });
        if(chagreId){
            return chagreId;
        }else{
            throw new Meteor.Error(400,'save charge error!');
        }
    }
})

