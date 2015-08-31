/**
 *
 */
Picker.route('/weixin_openid_url', function (params, req, res, next) {
    var fibers = Meteor.npmRequire('fibers');
    console.log('CODE:' + params.query.code);
    var config = {
        'appid': 'wx5d6cdb75be61f4d5',  //微信公众号的账号密码
        'secret': '8d809dd7f8e13d3ebb9859795a4bd711'
    };
    var configPay = new ConfigPay(config);
    configPay._getOpenid(params.query.code, function (err, data) {
        console.log('data:>>>>' + data);
        //data 就是openid  存到数据库里面
        fibers(function () {
            var result = Meteor.users.update({_id: params.query.state}, {$set: {openid: data}});
            console.log('result:' + result);
        }).run();
    });
    res.writeHead(302, {'Location': DXS_Config.appUrl + '/index'});  //应该在用户登录我们的网页时的时候就要去获取openid
    res.end();
    //这时候拿到了openid,可以进行支付的功能.
 });

SSR.compileTemplate('weChat', Assets.getText('payment/weChat.html'));
Picker.route('/payment/weChat', function (params, req, res, next) {
    console.log('--------------------------payment----------------------------');
    console.log(params.query.data);
    var jsStr = '<script>';
    jsStr += Assets.getText('payment/pingpp_pay.js');
    jsStr += '</script>';
    SSR.render('weChat');
    var html = SSR.render('weChat', {charge: params.query.data});
    res.end(jsStr + html);
    //这里的ssR 就是把weChat.html里面的js代码打印在html页面中 去执行他.
});

//ping++ 微信支付成功回调
Picker.route('/payment/weChatReturnUrl', function (params, req, res, next) {
    //这里接收接收 Webhooks 通知
    console.log('--------------------------支付时异步回调----------------------------');
    req.setEncoding('utf8');
    //接收Post数据
    var postData = '';
    req.addListener("data", function (postDataChunk) {
        postData += postDataChunk;
    });
    req.addListener("end", function () {
            var fibers = Meteor.npmRequire('fibers');
            var resp = function (ret, status_code) {
                res.writeHead(status_code, {
                    "Content-Type": "text/plain; charset=utf-8"
                });
                res.end(ret);
            };
            var event = {};
            try {
                event = JSON.parse(postData);
            } catch (err) {
                return resp('JSON 解析失败', 400);
            }
            if (event.type === undefined) {
                return resp('Event 对象中缺少 type 字段', 400);
            }
            fibers(function () {
                if (event.type === "charge.succeeded") {
                    // 开发者在此处加入对支付异步通知的处理代码
                    console.log("-----------------------------支付成功--------------------------------")
                    console.log(event);
                    //event
                    //这里对返回的数据进行处理
                    //处理成功后返回200 失败返回400
                    //若返回状态码不是 200，Ping++ 服务器会在 25 小时内向你的服务器进行多次发送，最多 8 次。
                    // Webhooks 首次是即时推送，8 次时间间隔为 2min、10min、10min、1h、2h、6h、15h，
                    // 直到正确回复状态 200 或者超过最大重发次数，ping++将不再发送。

                }

            }).run();
        });

});



var https = Meteor.npmRequire('https');
var ConfigPay = function (config) {
    this.appid = config.appid,
        this.secret = config.secret
};
ConfigPay.prototype._getOpenid = function (code, callback) {
    var send = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=' + this.appid + '&secret=' + this.secret + '&code=' + code + '&grant_type=authorization_code'
    console.log(send);
    var req = https.request(send, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>OPENID<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
            console.log(chunk);
            callback(null, JSON.parse(chunk).openid);
        });
    });
    req.on('error', function (e) {
        callback(e);
    });
    req.end();
}
