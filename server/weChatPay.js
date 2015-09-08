/**
 *
 */
Picker.route('/weixin_openid_url', function (params, req, res, next) {
    var fibers = Meteor.npmRequire('fibers');
    console.log('CODE:' + params.query.code);
    var config = {
        'appid': '',
        'secret': ''
    };
    var configPay = new ConfigPay(config);
    configPay._getOpenid(params.query.code, function (err, data) {
        console.log('data:>>>>' + data);
        fibers(function () {
            var result = Meteor.users.update({_id: params.query.state}, {$set: {openid: data}});
            console.log('result:' + result);
        }).run();
    });
    res.writeHead(302, {'Location': DXS_Config.appUrl + '/membersIndex'});
    res.end();
});

SSR.compileTemplate('weChat', Assets.getText('payment/weChat.html'));
Picker.route('/payment/weChat', function (params, req, res, next) {
    var chargeId = params.query.data;
    console.log("--------------chargeId------------------------");
    var charge = dbCharge.findOne({_id: chargeId});
    var jsStr = '<script>';
    jsStr += Assets.getText('payment/pingpp_pay.js');
    jsStr += '</script>';
    SSR.render('weChat');
    var html = SSR.render('weChat', {charge: JSON.stringify(charge.charge)});
    res.end(jsStr + html);
});

//ping++ 微信支付成功回调
Picker.route('/payment/weChatReturnUrl', function (params, req, res, next) {
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
                var dxsOrderNum = event.data.object.order_no;
                var dxsOrderData = dbOrder.findOne({num: dxsOrderNum});
                if (dxsOrderData && dxsOrderData.orderStatus == 1) {
                    console.log('1.订单数据查询正确');
                    //查询出用户数据和配置数据
                    var dxsConfig = dbConfig.findOne({code: 'creditsPolicy'}); //积分配置
                    var dxsMember = Meteor.users.findOne({_id: dxsOrderData.userId});

                    //更新订单支付状态orderStatus 1=未支付 ---> 2=待发货
                    //1.增加事务，初始状态：initial
                    var addTransactions = dbTransactions.insert({
                        orderId: dxsOrderData._id,
                        price: dxsOrderData.orderSumMoney,
                        state: 'initial',
                        payModel: 'weChat',
                        event: 'pay'

                    });
                    if (addTransactions) {
                        var transData = dbTransactions.findOne({orderId: dxsOrderData._id, state: 'initial'});
                        if (transData) {
                            console.log('2.事务开启成功');
                            //2.修改事务状态=pending
                            var editTransState = dbTransactions.update({_id: transData._id}, {$set: {state: 'pending'}});
                            if (editTransState) {
                                console.log('3.处理事务。。。。开始');
                                //1.更新订单状态,添加订单操作记录
                                var nowDate = moment().format('YYYY-MM-DD hh:mm:ss');
                                var eventDesc = nowDate + ' 订单号：' + dxsOrderData.num + '，支付成功;';
                                var result1 = dbOrder.update(
                                    {_id: dxsOrderData._id},
                                    {
                                        $set: {
                                            orderStatus: 2,
                                            pendingTransactions: transData._id,
                                            paymentModel: 'weChat',
                                            charge_id: event.data.object.id
                                        },
                                        $push: {
                                            orderRecord: {
                                                time: nowDate,
                                                operatePerson: dxsOrderData.userId,
                                                operateObj: 1, //1表示操作对象客户  2 表示操作对象为商家
                                                operatePersonName: dxsOrderData.userName,
                                                event: eventDesc,
                                                status: '提交订单',
                                                pendingTransactions: transData._id
                                            }
                                        }
                                    }
                                );

                                console.log("result1:" + result1)

                                //3.检查是否增加积分，如是且增加
                                var result3 = true;
                                /*var result3 = false;
                                 if (dxsConfig && dxsMember) {
                                 var score = parseInt(dxsConfig.value) * parseInt(dxsOrderData.orderSumMoney);
                                 if (score <= 0) {
                                 result3 = true;
                                 } else {
                                 result3 = Meteor.users.update(
                                 {_id: dxsOrderData.userId},
                                 {
                                 $set: {score: score + parseInt(dxsMember.score)},
                                 $push: {
                                 pendingTransactions: transData._id
                                 }
                                 }
                                 );
                                 }
                                 }*/
                                console.log("result3:" + result3);
                                //增加支付记录
                                var pendingArr = [transData._id];
                                var result4 = dbPaymentLogs.insert({
                                    pay_model: 'weChat',
                                    created: event.created,
                                    livemode: event.livemode,
                                    request: event.request,
                                    type: event.type,
                                    member_id: dxsOrderData.userId,
                                    mobile: dxsOrderData.userMobile,
                                    dxs_order_id: dxsOrderData._id,
                                    transaction_no: event.data.object.transaction_no,
                                    subject: event.data.object.subject,
                                    amount: event.data.object.amount,
                                    time_expire: event.data.object.time_expire,
                                    extra: event.data.object.extra,
                                    pendingTransactions: pendingArr

                                });
                                console.log("result4:" + result4);
                                //调用ERP增加新订单处理

                                console.log('3.处理事务。。。。完成');
                                //4.判断是否处理成功，成功就更新事务状态
                                if (result1 && result3 && result4) {
                                    console.log('3.处理事务。。。。成功');
                                    //设置事务状态：committed
                                    dbTransactions.update({_id: transData._id}, {$set: {state: 'committed'}});

                                    //移除penging事务
                                    dbOrder.update(
                                        {_id: dxsOrderData._id},
                                        {
                                            $set: {
                                                orderStatus: 2,
                                                pendingTransactions: transData._id,
                                                paymentModel: 'weChat',
                                                charge_id: event.data.object.id
                                            }
                                        }
                                    );
                                    Meteor.users.update({
                                        _id: dxsOrderData.userId
                                    }, {
                                        $pull: {
                                            pendingTransactions: transData._id
                                        }
                                    });
                                    dbPaymentLogs.update({pendingTransactions: transData._id}, {$pull: {pendingTransactions: transData._id}});

                                    //设置事务状态：done
                                    dbTransactions.update({_id: transData._id}, {$set: {state: 'done'}});
                                    console.log("---------------------事务处理成功--------------------")
                                    return resp("OK", 200);
                                } else {
                                    console.log('3.处理事务。。。。失败');
                                    //设置事务状态：canceling
                                    dbTransactions.update({_id: transData._id}, {$set: {state: 'canceling'}});

                                    //失败的处理,以事务ID为条件，回滚处理之前的数据，条件都以事务的ID为准
                                    //失败1:订单状态=1
                                    dbOrder.update({pendingTransactions: transData._id}, {
                                        $set: {orderStatus: 1, paymentModel: '', charge_id: ''},
                                        $pull: {pendingTransactions: transData._id}
                                    });
                                    //失败2:删除订单操作记录
                                    dbOrder.update({_id: dxsOrderData._id}, {$pull: {orderRecord: {pendingTransactions: transData._id}}});
                                    //失败3:检查是否增加积分，回滚
                                    //var score = parseInt(dxsConfig.value) * parseInt(dxsMember.score);
                                    //Meteor.users.update({
                                    //    _id: dxsOrderData.userId
                                    //}, {$set: {score: score}, $pull: {pendingTransactions: transData._id}});
                                    //失败4:删除支付记录
                                    dbPaymentLogs.remove({pendingTransactions: transData._id});

                                    //判断是否回滚成功，成功将事务状态设置成canceled
                                    //更新状态
                                    dbTransactions.update({_id: transData._id}, {$set: {state: 'canceled'}});
                                    //添加处理失败记录
                                    dbLogs.insert({
                                        title: '微信支付成功，处理失败',
                                        type: 'weChat',
                                        desc: 'weChat pay success, operation data fail',
                                        content: event,
                                        member: dxsOrderData.userId,
                                        mobile: dxsOrderData.userMobile,
                                        time: moment().format('YYYY-MM-DD hh:mm:ss')
                                    });
                                    console.log("事务处理失败-------------------------");
                                    return resp("事务处理失败", 400);

                                }
                            }
                        }
                    }
                } else if (dxsOrderData && dxsOrderData.orderStatus == 2) {
                    return resp("OK", 200);
                }
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
