//notation: js file can only use this kind of comments
//since comments will cause error when use in webview.loadurl,
//comments will be remove by java use regexp
(function() {
    if (window.WebViewJavascriptBridge) {
        return;
    }

    var messagingIframe;
    var sendMessageQueue = [];
    var receiveMessageQueue = [];
    var messageHandlers = {};

    var CUSTOM_PROTOCOL_SCHEME = 'yy';
    var QUEUE_HAS_MESSAGE = '__QUEUE_MESSAGE__/';

    var responseCallbacks = {};
    var uniqueId = 1;

    // 添加一个Element
    function _createQueueReadyIframe(doc) {
        messagingIframe = doc.createElement('iframe');
        messagingIframe.style.display = 'none';
        doc.documentElement.appendChild(messagingIframe);
    }

    //set default messageHandler
    function init(messageHandler) {
        if (WebViewJavascriptBridge._messageHandler) {
            throw new Error('WebViewJavascriptBridge.init called twice');
        }
        WebViewJavascriptBridge._messageHandler = messageHandler;
        var receivedMessages = receiveMessageQueue;
        receiveMessageQueue = null;
        for (var i = 0; i < receivedMessages.length; i++) {
            _dispatchMessageFromNative(receivedMessages[i]);
        }
    }

    // 10. 不指定java层handler时
    function send(data, responseCallback) {
        _doSend({
            data: data
        }, responseCallback);
    }

    // @@@ 50. begin js 层注册handler， java调用, BridgeWebView最下方
    function registerHandler(handlerName, handler) {
        messageHandlers[handlerName] = handler;
    }

    // @@@ 指定java层handler时， java层注册handler，js层调用
    // 11. begin！！！ js can call this Java handler method "submitFromWeb" through:
    function callHandler(handlerName, data, responseCallback) {
        _doSend({
            handlerName: handlerName,
            data: data
        }, responseCallback);
    }

    //sendMessage add message, 触发native处理 sendMessage  // 58 js handler处理完后，发送结果给java， 参数没有responseCallback
    function _doSend(message, responseCallback) {
        if (responseCallback) {
            var callbackId = 'cb_' + (uniqueId++) + '_' + new Date().getTime();
            responseCallbacks[callbackId] = responseCallback;
            message.callbackId = callbackId;
        }

        // 12. 向末尾添加message, 发送时利用的是callbackId字段
        sendMessageQueue.push(message);
        // 13. 设置src，则会触发 WebViewClient : shouldOverrideUrlLoading  59
        messagingIframe.src = CUSTOM_PROTOCOL_SCHEME + '://' + QUEUE_HAS_MESSAGE;
        // 14. 在java端处理后，调用下面_fetchQueue()函数.
        // 注意：！！！java端还有个函数responseCallbacks.put(BridgeUtil.parseFunctionName(jsUrl), returnCallback);
        // 即 responseCallbacks.put(_fetchQueue, returnCallback);
        // 可以保证下次能取到吗？可以因为shouldOverrideUrlLoading会在put()之后调用
    }

    // 提供给native调用,该函数作用:获取sendMessageQueue返回给native,由于android不能直接获取返回的内容,所以使用url shouldOverrideUrlLoading 的方式返回内容
    function _fetchQueue() {
        // 15. 获取所有的包括刚刚push的message，然后清空当前
        var messageQueueString = JSON.stringify(sendMessageQueue);
        sendMessageQueue = [];
        //android can't read directly the return data, so we can reload iframe src to communicate with java
        // 16. 再次触发shouldOverrideUrlLoading，此时已经有了message数据，其中encodeURIComponent为js函数
        messagingIframe.src = CUSTOM_PROTOCOL_SCHEME + '://return/_fetchQueue/' + encodeURIComponent(messageQueueString);
        // 17. 接BridgeWebView--line167
    }

    // 25 56 提供给native使用, 处理结果(java handler处理结束了)message 和 请求(js有handler)message
    function _dispatchMessageFromNative(messageJSON) {
        setTimeout(function() {
            var message = JSON.parse(messageJSON);
            var responseCallback;
            //java call finished, now need to call js callback function
            // 结果message
            if (message.responseId) {
                // 26 步骤12时设置的
                responseCallback = responseCallbacks[message.responseId];
                if (!responseCallback) {
                    return;
                }
                // 27 done！！！
                responseCallback(message.responseData);
                delete responseCallbacks[message.responseId];
            } else {
                //直接发送
                if (message.callbackId) {
                    var callbackResponseId = message.callbackId;
                    // 57 本地handler处理完后，返回结果给java
                    responseCallback = function(responseData) {
                    // 注意参数只有data
                        _doSend({
                            responseId: callbackResponseId,
                            responseData: responseData
                        });
                    };
                }

                // 58 查找 js handler
                var handler = WebViewJavascriptBridge._messageHandler;
                if (message.handlerName) {
                    handler = messageHandlers[message.handlerName];
                }
                //查找指定handler
                try {
                    // 58 处理完后回调到57处
                    handler(message.data, responseCallback);
                } catch (exception) {
                    if (typeof console != 'undefined') {
                        console.log("WebViewJavascriptBridge: WARNING: javascript handler threw.", message, exception);
                    }
                }
            }
        });
    }

    //提供给native调用,receiveMessageQueue 在会在页面加载完后赋值为null,所以
    // 24  55 处理发送过来的message
    function _handleMessageFromNative(messageJSON) {
        console.log(messageJSON);
        if (receiveMessageQueue && receiveMessageQueue.length > 0) {
            receiveMessageQueue.push(messageJSON);
        } else {
            _dispatchMessageFromNative(messageJSON);
        }
    }

    var WebViewJavascriptBridge = window.WebViewJavascriptBridge = {
        init: init,
        send: send,
        registerHandler: registerHandler,
        callHandler: callHandler,
        _fetchQueue: _fetchQueue,
        _handleMessageFromNative: _handleMessageFromNative
    };

    var doc = document;
    _createQueueReadyIframe(doc);
    var readyEvent = doc.createEvent('Events');
    readyEvent.initEvent('WebViewJavascriptBridgeReady');
    readyEvent.bridge = WebViewJavascriptBridge;
    doc.dispatchEvent(readyEvent);
    // This lib will inject a WebViewJavascriptBridge Object to window object.
    // So in your js, before use WebViewJavascriptBridge, you must detect
    // if WebViewJavascriptBridge exist. If WebViewJavascriptBridge does not exit,
    // you can listen to WebViewJavascriptBridgeReady event, as the blow code shows: README.md
})();
