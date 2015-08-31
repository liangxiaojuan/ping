/**
 * Created by dxs on 2015-08-30.
 */

Meteor.ping = {

    //ping++ 微信支付
    'wxPingppPay_createCharge': function (order, callback) {

        var pingpp = new Pingpp(order);
        pingpp._createCharge(function (err, charge) {
            if (err) {
                callback(err);
            } else {
                callback(null, charge);
            }
        });
    }

};
//ping++  ---------------------支付---------------------------

var pingpp = Meteor.npmRequire('pingpp')('sk_live_8KSOMvrkEVoT1RnbewiRdM4Z');

var PingRefund = function () {
};
PingRefund.prototype._createRefund = function (ch_id, callback) {
    pingpp.charges.createRefund(
        ch_id,
        {description: "Refund Description"},
        function (err, refund) {
            console.log("-----------_createRefund-------------------------")
            console.log(refund)
            if (err) {
                callback(err);
            } else(
                callback(null, refund)
            )
        }
    );
};

var Pingpp = function (order) {
    this.subject = order.subject;
    this.body = order.body;
    this.order_no = order.order_no;
    this.amount = order.amount;
    this.channel = order.channel;
    this.client_ip = order.client_ip;
    this.app_id = order.app_id;
    this.open_id = order.opneid;
    return this;
};
Pingpp.prototype._createCharge = function (callback) {
    pingpp.charges.create({
        subject: this.subject, //商品标题
        body: this.body,   //商品描述
        amount: this.amount,   //订单金额 单位分
        order_no: this.order_no,  //订单号
        channel: this.channel,   //支付使用的第三方支付渠道
        currency: "cny",    //三位 ISO 货币代码，目前仅支持人民币 cny。
        client_ip: this.client_ip,    //发起支付请求终端的 IP 地址
        app: {id: this.app_id},
        extra: {open_id: this.open_id}
    }, function (err, charge) {
        if (err) {
            console.log(err)
            callback(err);
        } else {
            // 异步调用
            /* console.log("---------------------异步返回-------------------------");
             console.log(charge);*/
            callback(null, charge);
        }

    });
};

