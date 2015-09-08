/**
 * Created by dxs on 2015-08-30.
 */
if (Meteor.isClient) {


    Template.hello.events({
        'click #ping': function () {

            var params = {};
            params.out_trade_no = "5a45as";//订单号
            params.body = "测试";//商品描述
            params.total_fee = $("#ping").val();//钱
            params.openid = '啊啊' //OpenID很重要,在关注者与公众号产生消息交互后，
            // 公众号可获得关注者的OpenID（加密后的微信号，
            // 每个用户对每个公众号的OpenID是唯一的。对于不同公众号，同一用户的openid不同）
            //微信开发文档有.
            console.log('->提交到服务器', params);

                Meteor.call('weChatPay',params,function(data){

                    //最终结果 ping++会返回 一个Charge 对象,data就是Charge对象,Charge 对象是支付凭据,

                    if (data) {
                        alert('/payment/weChat?data=' + encodeURI(JSON.stringify(data))+'&showwxpaytitle=1');
                        window.location = '/payment/weChat?data=' + encodeURI(JSON.stringify(data))+'&showwxpaytitle=1';

                        //这里的window.location是将 Charge对象支付凭据传给 Client
                      //  他会由Picker.route('/payment/weChat) 在 weChatPay.js 接收到数据进行处理

                    } else {
                        alert('err!');
                    }

                },
                function (err) {
                    alert(err)
                    console.log(err)
                }
            )

        }
        , 'click #openid':function(){
            window.location = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx5d6cdb75be61f4d5&redirect_uri='+DXS_Config.appUrl+'/weixin_openid_url&response_type=code&scope=snsapi_base&state='+Meteor.userId()+'#wechat_redirect';
            //openid 应该是在登录之后就要去获取的
            //上面的 window.location  就是微信网站应用获取用户openid可使用的接口： 具体可以去看微信支付的文档
            //appid 是微信公众号 redirect_uri是你在微信访问的商场连接
            //这步执行之后 他会由Picker.route('/weixin_openid_url') 在 weChatPay.js 接收到数据进行处理
            //
        },
    });
}


